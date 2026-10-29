import "server-only";
import { db, dbBase, prismaJson, Prisma } from "@nassican/db";
import {
  calendarDate,
  type BillingIssuer,
  type ChargeSnapshot,
  type PricingUnit,
  type BillingFlexiblePayments,
} from "@nassican/shared";
import { getTimezone } from "./site-config";
import {
  BillingInputError,
  billingDecimal,
  billingInputAmount,
  billingMinor,
  billingText,
  billingUuid,
  emptyBillingIssuer,
  parseBillingDetails,
  readBillingParty,
  readBillingPlan,
  readFlexiblePayments,
  requireChargeIdentity,
  type BillingPlanDraft,
} from "./billing-values";
import { isFullDay } from "./draft-fields";

export async function billingAvailable(): Promise<boolean> {
  const rows = await db.$queryRaw<
    { ready: boolean }[]
  >`SELECT to_regclass('billing_plans') IS NOT NULL AND to_regclass('billing_charges') IS NOT NULL AND to_regclass('billing_receipts') IS NOT NULL AND to_regclass('billing_issuer_settings') IS NOT NULL AS ready`;
  return rows[0].ready;
}
async function requireBilling() {
  if (!(await billingAvailable()))
    throw new BillingInputError(
      "Falta aplicar la migración de cuotas y cobros. Puedes revisar el formulario; el guardado se habilitará después de migrar.",
    );
}
type Tx = Prisma.TransactionClient;
export type BillingSource = {
  quoteId: string;
  projectId: string;
  title: string;
  description: string;
  recipient: string;
  amount: number;
  currency: string;
  unit: PricingUnit;
  canIssue: boolean;
};

export async function billingSource(
  ref: { quoteId?: string; projectId?: string },
  tx: Tx = dbBase,
): Promise<BillingSource> {
  if (ref.quoteId) {
    if (!billingUuid(ref.quoteId)) throw new BillingInputError("Elige una cotización válida.");
    const quote = await tx.pricingQuote.findUnique({
      where: { id: ref.quoteId },
      include: {
        client: { select: { name: true } },
        project: { select: { id: true, amount: true, currency: true } },
      },
    });
    if (!quote) throw new BillingInputError("La cotización ya no está disponible.");
    const amount = Number(quote.final);
    billingMinor(amount);
    if (
      quote.project &&
      (Number(quote.project.amount) !== amount || quote.project.currency !== quote.currency)
    )
      throw new BillingInputError(
        "El proyecto y su cotización tienen importes distintos. Revisa el acuerdo antes de cobrar.",
      );
    const saved =
      quote.snapshot && typeof quote.snapshot === "object" && !Array.isArray(quote.snapshot)
        ? quote.snapshot
        : {};
    const service =
      "service" in saved &&
      saved.service &&
      typeof saved.service === "object" &&
      !Array.isArray(saved.service)
        ? saved.service
        : {};
    const description =
      "description" in service && typeof service.description === "string"
        ? service.description
        : "";
    return {
      quoteId: quote.id,
      projectId: quote.projectId ?? "",
      title: quote.title,
      description,
      recipient: quote.client?.name ?? "",
      amount,
      currency: quote.currency,
      unit: quote.unit,
      canIssue: quote.status === "accepted" && Boolean(quote.projectId),
    };
  }
  if (!ref.projectId || !billingUuid(ref.projectId))
    throw new BillingInputError("Elige una cotización o un proyecto.");
  const project = await tx.clientProject.findUnique({
    where: { id: ref.projectId },
    include: { pricingQuote: { select: { id: true } } },
  });
  if (!project) throw new BillingInputError("El proyecto ya no está disponible.");
  if (project.pricingQuote) return billingSource({ quoteId: project.pricingQuote.id }, tx);
  if (project.amount === null || project.currency === null)
    throw new BillingInputError(
      "Registra primero el importe y la moneda del proyecto en Trabajos.",
    );
  const amount = Number(project.amount);
  billingMinor(amount);
  return {
    quoteId: "",
    projectId: project.id,
    title: project.title,
    description: project.description ?? "",
    recipient: project.company,
    amount,
    currency: project.currency,
    unit: "project",
    canIssue: true,
  };
}

export function parseChargeSnapshot(value: unknown): ChargeSnapshot {
  if (!value || typeof value !== "object")
    throw new BillingInputError("La cuenta guardada no es válida.");
  const record = value as Record<string, unknown>;
  if (record.version !== 1) throw new BillingInputError("Versión de cuenta no reconocida.");
  const text = Object.fromEntries(
    [
      "projectTitle",
      "quoteReference",
      "concept",
      "installmentLabel",
      "amount",
      "currency",
      "issuedDate",
      "paymentTerms",
      "period",
    ].map((key) => [
      key,
      billingText(record[key], key, key === "concept" || key === "paymentTerms" ? 4000 : 500),
    ]),
  );
  billingMinor(text.amount);
  if (!Number.isInteger(record.installmentNumber) || !Number.isInteger(record.installmentCount))
    throw new BillingInputError("Cuota guardada no válida.");
  return {
    version: 1,
    ...text,
    issuer: readBillingParty(record.issuer, true),
    recipient: readBillingParty(record.recipient),
    installmentNumber: record.installmentNumber,
    installmentCount: record.installmentCount,
    dueDate: record.dueDate,
  } as ChargeSnapshot;
}

export async function getBillingView(ref: { quoteId?: string; projectId?: string } = {}) {
  const [ready, quotes, projects, profile, timezone] = await Promise.all([
    billingAvailable(),
    db.pricingQuote.findMany({
      select: { id: true, title: true, status: true, projectId: true },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
    db.clientProject.findMany({
      select: { id: true, title: true, company: true, amount: true, currency: true },
      orderBy: { updatedAt: "desc" },
      take: 1000,
    }),
    db.profile.findUnique({ where: { id: 1 }, select: { fullName: true, email: true } }),
    getTimezone(),
  ]);
  const fallbackIssuer = {
    ...emptyBillingIssuer(),
    name: profile?.fullName ?? "",
    email: profile?.email ?? "",
  };
  const issuerRow = ready
    ? await db.billingIssuerSettings.findUnique({ where: { id: "singleton" } })
    : null;
  const issuer = issuerRow
    ? (readBillingParty(issuerRow.details, true) as BillingIssuer)
    : fallbackIssuer;
  let source: BillingSource | null = null;
  let sourceError = "";
  try {
    if (ref.quoteId || ref.projectId) source = await billingSource(ref);
  } catch (error) {
    if (error instanceof BillingInputError) sourceError = error.message;
    else throw error;
  }
  const selectedPlan =
    ready && source
      ? await db.billingPlan.findFirst({
          where: {
            OR: [
              ...(source.quoteId ? [{ quoteId: source.quoteId }] : []),
              ...(source.projectId ? [{ projectId: source.projectId }] : []),
            ],
          },
          include: {
            charges: {
              include: { receipts: { orderBy: { paidAt: "asc" } } },
              orderBy: { sequence: "asc" },
            },
          },
        })
      : null;
  const plan = selectedPlan
    ? {
        id: selectedPlan.id,
        revision: selectedPlan.revision,
        amount: Number(selectedPlan.amount),
        currency: selectedPlan.currency,
        details: parseBillingDetails(selectedPlan.details, Number(selectedPlan.amount)),
        locked: selectedPlan.charges.length > 0,
        charges: selectedPlan.charges.map((charge) => ({
          id: charge.id,
          sequence: charge.sequence,
          installmentId: charge.installmentId,
          amount: Number(charge.amount),
          canceled: charge.canceledAt !== null,
          cancellationReason: charge.cancellationReason,
          snapshot: parseChargeSnapshot(charge.snapshot),
          receipts: charge.receipts.map((receipt) => ({
            id: receipt.id,
            amount: Number(receipt.amount),
            paidAt: receipt.paidAt,
            reference: receipt.reference,
          })),
        })),
      }
    : null;
  return {
    ready,
    quotes,
    projects: projects.map((p) => ({ ...p, amount: p.amount === null ? null : Number(p.amount) })),
    issuer,
    source,
    sourceError,
    plan,
    today: calendarDate(timezone),
  };
}
export type BillingView = Awaited<ReturnType<typeof getBillingView>>;

export async function saveBillingIssuer(value: BillingIssuer) {
  await requireBilling();
  const issuer = readBillingParty(value, true) as BillingIssuer;
  await db.billingIssuerSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", details: prismaJson.billing(issuer) },
    update: { details: prismaJson.billing(issuer) },
  });
}

export async function saveBillingPlan(draft: BillingPlanDraft) {
  await requireBilling();
  return dbBase.$transaction(
    async (tx) => {
      const source = await billingSource(draft, tx);
      const details = {
        ...readBillingPlan(draft, source.amount),
        scopeDescription: source.description,
      };
      const where = {
        OR: [
          ...(source.quoteId ? [{ quoteId: source.quoteId }] : []),
          ...(source.projectId ? [{ projectId: source.projectId }] : []),
        ],
      };
      const existing = await tx.billingPlan.findFirst({
        where,
        include: { _count: { select: { charges: true } } },
      });
      if (existing && existing._count.charges)
        throw new BillingInputError(
          "El plan ya tiene cuentas emitidas y conserva sus cuotas. No puede redistribuirse; cancela o acuerda un nuevo alcance sin modificar documentos anteriores.",
        );
      const previous = existing
        ? parseBillingDetails(existing.details, Number(existing.amount))
        : null;
      if (previous?.flexiblePayments?.expected.length && draft.mode !== "flexible")
        throw new BillingInputError(
          "Retira las previsiones pendientes antes de cambiar de modalidad de pago.",
        );
      if (previous?.flexiblePayments?.receipts.length) {
        if (draft.mode !== "flexible")
          throw new BillingInputError(
            "El acuerdo ya tiene pagos recibidos. Conserva la modalidad por avances para mantener su historial.",
          );
        if (
          billingMinor(existing!.amount.toString()) !== billingMinor(source.amount) ||
          existing!.currency !== source.currency
        )
          throw new BillingInputError(
            "El valor o moneda del acuerdo con pagos recibidos no puede cambiar.",
          );
      }
      if (draft.mode === "flexible" && previous?.flexiblePayments)
        Object.assign(details, { flexiblePayments: previous.flexiblePayments });
      if ((existing?.revision ?? 0) !== draft.revision)
        throw new BillingInputError("El plan cambió en otra ventana. Actualiza antes de guardar.");
      const data = {
        quoteId: source.quoteId || null,
        projectId: source.projectId || null,
        title: source.title,
        amount: source.amount,
        currency: source.currency as "COP" | "USD" | "EUR",
        unit: source.unit,
        details: prismaJson.billing(details),
      };
      if (!existing) return tx.billingPlan.create({ data });
      const updated = await tx.billingPlan.updateMany({
        where: { id: existing.id, revision: draft.revision },
        data: { ...data, revision: { increment: 1 } },
      });
      if (!updated.count) throw new BillingInputError("El plan cambió. Actualiza la página.");
      return tx.billingPlan.findUniqueOrThrow({ where: { id: existing.id } });
    },
    { isolationLevel: "Serializable" },
  );
}

export type FlexibleReceiptDraft = {
  planId: string;
  id: string;
  amount: string;
  paidAt: string;
  concept: string;
  reference: string;
  expectedId: string;
};
export type ExpectedPaymentDraft = {
  planId: string;
  id: string;
  amount: string;
  expectedAt: string;
  concept: string;
};

/** The plan revision serializes append-only receipts against edits and parallel payments. */
async function changeFlexiblePayments(
  planId: string,
  change: (ledger: BillingFlexiblePayments, amount: number) => BillingFlexiblePayments,
) {
  await requireBilling();
  if (!billingUuid(planId)) throw new BillingInputError("Selecciona un acuerdo válido.");
  return dbBase.$transaction(
    async (tx) => {
      const plan = await tx.billingPlan.findUniqueOrThrow({ where: { id: planId } });
      const source = await billingSource(
        { quoteId: plan.quoteId ?? "", projectId: plan.projectId ?? "" },
        tx,
      );
      if (!source.canIssue)
        throw new BillingInputError(
          "Acepta primero la cotización para conectar los pagos con su proyecto.",
        );
      if (
        billingMinor(source.amount) !== billingMinor(plan.amount.toString()) ||
        source.currency !== plan.currency
      )
        throw new BillingInputError(
          "El valor del acuerdo cambió. Actualiza el plan antes de registrar pagos.",
        );
      const details = parseBillingDetails(plan.details, Number(plan.amount));
      if (details.paymentMode !== "flexible")
        throw new BillingInputError("Selecciona y guarda Pagos por avances para usar esta opción.");
      const ledger = details.flexiblePayments ?? { receipts: [], expected: [] };
      const next = change(ledger, Number(plan.amount));
      if (next === ledger) return plan;
      const validated = readFlexiblePayments(next, Number(plan.amount));
      const updated = await tx.billingPlan.updateMany({
        where: { id: planId, revision: plan.revision },
        data: {
          details: prismaJson.billing({ ...details, flexiblePayments: validated }),
          revision: { increment: 1 },
          projectId: source.projectId || null,
        },
      });
      if (!updated.count)
        throw new BillingInputError(
          "Otro pago cambió el saldo. Actualiza antes de volver a guardar.",
        );
      return tx.billingPlan.findUniqueOrThrow({ where: { id: planId } });
    },
    { isolationLevel: "Serializable" },
  );
}

export async function recordFlexibleReceipt(input: FlexibleReceiptDraft) {
  if (!billingUuid(input.id) || !isFullDay(input.paidAt))
    throw new BillingInputError("Indica una fecha completa para el dinero recibido.");
  if (input.paidAt > calendarDate(await getTimezone()))
    throw new BillingInputError("Un pago recibido no puede tener fecha futura.");
  const receipt = {
    id: input.id,
    amount: billingDecimal(billingInputAmountForReceipt(input.amount)),
    paidAt: input.paidAt,
    concept: billingText(input.concept, "avance o concepto", 500, true),
    reference: billingText(input.reference, "referencia", 500),
    expectedId: input.expectedId || null,
  };
  return changeFlexiblePayments(input.planId, (ledger) => {
    const existing = ledger.receipts.find((r) => r.id === input.id);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(receipt))
        throw new BillingInputError("Este identificador de pago ya tiene otros datos.");
      return ledger;
    }
    if (receipt.expectedId) {
      const expected = ledger.expected.find((e) => e.id === receipt.expectedId);
      if (!expected || expected.receiptId)
        throw new BillingInputError("Este pago previsto ya fue recibido o no está disponible.");
    }
    return {
      receipts: [...ledger.receipts, receipt],
      expected: ledger.expected.map((e) =>
        e.id === receipt.expectedId ? { ...e, receiptId: receipt.id } : e,
      ),
    };
  });
}

export async function saveExpectedPayment(input: ExpectedPaymentDraft) {
  if (!billingUuid(input.id)) throw new BillingInputError("Identificador de previsión no válido.");
  const entry = {
    id: input.id,
    amount: input.amount.trim() ? billingDecimal(billingInputAmountForReceipt(input.amount)) : null,
    expectedAt: input.expectedAt || null,
    concept: billingText(input.concept, "avance o concepto", 500, true),
    receiptId: null,
  };
  return changeFlexiblePayments(input.planId, (ledger) => {
    const existing = ledger.expected.find((e) => e.id === input.id);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(entry))
        throw new BillingInputError("Esta previsión ya fue guardada con otros datos.");
      return ledger;
    }
    return { ...ledger, expected: [...ledger.expected, entry] };
  });
}

export async function removeExpectedPayment(planId: string, id: string) {
  if (!billingUuid(id)) throw new BillingInputError("Selecciona un pago previsto válido.");
  return changeFlexiblePayments(planId, (ledger) => {
    const entry = ledger.expected.find((e) => e.id === id);
    if (!entry) return ledger;
    if (entry.receiptId)
      throw new BillingInputError(
        "La previsión ya está asociada a un pago recibido y conserva su historial.",
      );
    return { ...ledger, expected: ledger.expected.filter((e) => e.id !== id) };
  });
}

export async function issueBillingCharge(planId: string, installmentId: string, concept: string) {
  await requireBilling();
  if (!billingUuid(planId) || !billingUuid(installmentId))
    throw new BillingInputError("Selecciona una cuota válida.");
  const issuedDate = calendarDate(await getTimezone());
  return dbBase.$transaction(
    async (tx) => {
      const plan = await tx.billingPlan.findUniqueOrThrow({ where: { id: planId } });
      const source = await billingSource(
        { quoteId: plan.quoteId ?? "", projectId: plan.projectId ?? "" },
        tx,
      );
      if (!source.canIssue)
        throw new BillingInputError(
          "Acepta primero la cotización para conectarla con su proyecto antes de emitir cobros.",
        );
      if (
        billingMinor(source.amount) !== billingMinor(plan.amount.toString()) ||
        source.currency !== plan.currency
      )
        throw new BillingInputError(
          "El total del acuerdo cambió. Actualiza el plan antes de emitir cuentas.",
        );
      const details = parseBillingDetails(plan.details, Number(plan.amount));
      requireChargeIdentity(details);
      if (source.unit !== "project" && !details.period)
        throw new BillingInputError(
          "Indica el periodo o ciclo que corresponde a este cobro por mes u hora.",
        );
      const index = details.installments.findIndex((i) => i.id === installmentId);
      if (index < 0) throw new BillingInputError("La cuota ya no pertenece al plan.");
      const quota = details.installments[index];
      if (billingMinor(quota.amount) === BigInt(0))
        throw new BillingInputError("Una cuota de cero no genera una cuenta de cobro.");
      const existing = await tx.billingCharge.findFirst({
        where: { planId, installmentId, canceledAt: null },
      });
      if (existing) return existing;
      const snapshot: ChargeSnapshot = {
        version: 1,
        issuer: details.issuer,
        recipient: details.recipient,
        projectTitle: source.title,
        quoteReference: source.quoteId
          ? `NAS-${source.quoteId.replace(/-/g, "").slice(0, 12).toUpperCase()}`
          : "",
        concept: billingText(concept, "concepto del cobro", 4000, true),
        installmentLabel: quota.label,
        installmentNumber: index + 1,
        installmentCount: details.installments.length,
        amount: quota.amount,
        currency: plan.currency,
        dueDate: quota.dueDate,
        issuedDate,
        paymentTerms: details.paymentTerms,
        period: details.period,
      };
      // Lock the plan revision against a concurrent redistribution.
      await tx.billingPlan.update({
        where: { id: plan.id },
        data: { revision: { increment: 1 }, projectId: source.projectId || null },
      });
      return tx.billingCharge.create({
        data: {
          planId,
          installmentId,
          amount: quota.amount,
          currency: plan.currency,
          snapshot: prismaJson.billing(snapshot),
        },
      });
    },
    { isolationLevel: "Serializable" },
  );
}

export async function recordBillingReceipt(input: {
  id: string;
  chargeId: string;
  amount: string;
  paidAt: string;
  reference: string;
}) {
  await requireBilling();
  if (!billingUuid(input.id) || !billingUuid(input.chargeId) || !isFullDay(input.paidAt))
    throw new BillingInputError("Indica cuenta, fecha completa e identificador de abono válidos.");
  const today = calendarDate(await getTimezone());
  if (input.paidAt > today)
    throw new BillingInputError("Un abono recibido no puede tener fecha futura.");
  const amount = billingInputAmountForReceipt(input.amount);
  const reference = billingText(input.reference, "referencia del abono", 500, true);
  return dbBase.$transaction(
    async (tx) => {
      const old = await tx.billingReceipt.findUnique({ where: { id: input.id } });
      if (old) {
        if (
          old.chargeId !== input.chargeId ||
          billingMinor(old.amount.toString()) !== amount ||
          old.paidAt !== input.paidAt ||
          old.reference !== reference
        )
          throw new BillingInputError("Este identificador de abono ya tiene otros datos.");
        return old;
      }
      const charge = await tx.billingCharge.findUniqueOrThrow({
        where: { id: input.chargeId },
        include: { receipts: true },
      });
      if (charge.canceledAt)
        throw new BillingInputError("No puedes registrar abonos de una cuenta anulada.");
      const paid = charge.receipts.reduce(
        (sum, receipt) => sum + billingMinor(receipt.amount.toString()),
        BigInt(0),
      );
      if (paid + amount > billingMinor(charge.amount.toString()))
        throw new BillingInputError("El abono supera el saldo pendiente de esta cuenta.");
      // A row lock serializes receipts and cancellation; the serializable snapshot
      // rejects a race that read an old balance.
      await tx.billingCharge.update({
        where: { id: charge.id },
        data: { cancellationReason: charge.cancellationReason },
      });
      return tx.billingReceipt.create({
        data: {
          id: input.id,
          chargeId: charge.id,
          amount: billingDecimal(amount),
          paidAt: input.paidAt,
          reference,
        },
      });
    },
    { isolationLevel: "Serializable" },
  );
}
function billingInputAmountForReceipt(value: string) {
  const amount = billingInputAmount(value);
  if (amount <= BigInt(0)) throw new BillingInputError("El abono debe ser mayor que cero.");
  return amount;
}

export async function cancelBillingCharge(id: string, raw: string) {
  await requireBilling();
  const reason = billingText(raw, "motivo de anulación", 1000, true);
  return dbBase.$transaction(
    async (tx) => {
      const charge = await tx.billingCharge.findUniqueOrThrow({
        where: { id },
        include: { _count: { select: { receipts: true } } },
      });
      if (charge._count.receipts)
        throw new BillingInputError(
          "Una cuenta con abonos no puede anularse. Conserva el historial y concilia primero los pagos.",
        );
      if (charge.canceledAt) return charge;
      return tx.billingCharge.update({
        where: { id },
        data: { canceledAt: new Date(), cancellationReason: reason },
      });
    },
    { isolationLevel: "Serializable" },
  );
}
