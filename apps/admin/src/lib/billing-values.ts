import type {
  BillingIssuer,
  BillingParty,
  BillingPlanDetails,
  BillingInstallment,
  BillingFlexiblePayments,
} from "@nassican/shared";
import { isFullDay, isPartialDate, parseNumber } from "./draft-fields";

export class BillingInputError extends Error {}
export const emptyBillingParty = (): BillingParty => ({
  name: "",
  identification: "",
  address: "",
  city: "",
  email: "",
  phone: "",
});
export const emptyBillingIssuer = (): BillingIssuer => ({
  ...emptyBillingParty(),
  bank: "",
  accountType: "",
  accountNumber: "",
  paymentInstructions: "",
});
export const billingUuid = (value: string) =>
  /^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value);
export const billingMoney = (amount: number, currency = "COP") =>
  amount.toLocaleString("es-CO", {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "COP" ? 0 : 2,
    maximumFractionDigits: 2,
  });

export function billingMinor(value: number | string): bigint {
  const number = typeof value === "number" ? value : Number(value);
  if (
    (typeof value === "string" && !/^\d+(\.\d{1,2})?$/.test(value)) ||
    !Number.isFinite(number) ||
    number < 0 ||
    number !== Number(number.toFixed(2))
  )
    throw new BillingInputError(
      "Usa un importe positivo con máximo dos decimales, dentro del rango permitido.",
    );
  const result = BigInt(number.toFixed(2).replace(".", ""));
  if (result > BigInt(Number.MAX_SAFE_INTEGER))
    throw new BillingInputError("El importe supera el rango seguro de cobros.");
  return result;
}
export const billingDecimal = (minor: bigint) =>
  `${minor / BigInt(100)}.${(minor % BigInt(100)).toString().padStart(2, "0")}`;
export function billingInputAmount(raw: string) {
  const value = parseNumber(raw);
  if (value === null) throw new BillingInputError("Completa el importe de cada cuota.");
  return billingMinor(value);
}
export function billingText(
  value: unknown,
  label: string,
  maximum = 500,
  required = false,
): string {
  if (
    typeof value !== "string" ||
    value.length > maximum ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  )
    throw new BillingInputError(`Revisa ${label}.`);
  const text = value.trim();
  if (required && !text) throw new BillingInputError(`Completa ${label}.`);
  return text;
}
export function readBillingParty(value: unknown, issuer = false): BillingParty | BillingIssuer {
  if (!value || typeof value !== "object")
    throw new BillingInputError("Revisa los datos de identificación.");
  const source = value as Record<string, unknown>;
  const limits: Record<keyof BillingParty, number> = {
    name: 200,
    identification: 100,
    address: 300,
    city: 140,
    email: 254,
    phone: 80,
  };
  const result = Object.fromEntries(
    (Object.keys(emptyBillingParty()) as (keyof BillingParty)[]).map((key) => [
      key,
      billingText(source[key], key, limits[key]),
    ]),
  ) as BillingParty;
  if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email))
    throw new BillingInputError("Revisa el correo de las partes.");
  if (!issuer) return result;
  return {
    ...result,
    ...Object.fromEntries(
      ["bank", "accountType", "accountNumber", "paymentInstructions"].map((key) => [
        key,
        billingText(source[key], key, key === "paymentInstructions" ? 2000 : 250),
      ]),
    ),
  } as BillingIssuer;
}

export type BillingQuotaDraft = { id: string; label: string; value: string; dueDate: string };
export type BillingPlanDraft = {
  quoteId: string;
  projectId: string;
  revision: number;
  mode: "amount" | "percent" | "flexible";
  issuer: BillingIssuer;
  recipient: BillingParty;
  installments: BillingQuotaDraft[];
  paymentTerms: string;
  deliveryTerms: string;
  period: string;
};
export function readBillingPlan(draft: BillingPlanDraft, total: number): BillingPlanDetails {
  if (
    !["amount", "percent", "flexible"].includes(draft.mode) ||
    !Array.isArray(draft.installments) ||
    (draft.mode !== "flexible" && draft.installments.length < 1) ||
    (draft.mode === "flexible" && draft.installments.length !== 0) ||
    draft.installments.length > 100
  )
    throw new BillingInputError("Elige entre 1 y 100 cuotas por importe o porcentaje.");
  if (!Number.isInteger(draft.revision) || draft.revision < 0)
    throw new BillingInputError("Actualiza el plan de pagos.");
  const totalMinor = billingMinor(total);
  const ids = new Set<string>();
  const shares: bigint[] = [];
  for (const row of draft.installments) {
    if (!billingUuid(row.id) || ids.has(row.id))
      throw new BillingInputError("Cada cuota debe tener un identificador único.");
    ids.add(row.id);
    if (draft.mode === "percent") {
      const percent = parseNumber(row.value);
      if (
        percent === null ||
        percent <= 0 ||
        percent > 100 ||
        Math.abs(percent * 10000 - Math.round(percent * 10000)) > 0.00001
      )
        throw new BillingInputError(
          "Cada porcentaje debe ser mayor que 0 y hasta 100, con máximo cuatro decimales.",
        );
      shares.push(BigInt(Math.round(percent * 10000)));
    } else shares.push(billingInputAmount(row.value));
  }
  const sum = shares.reduce((a, b) => a + b, BigInt(0));
  if (
    draft.mode !== "flexible" &&
    (draft.mode === "percent" ? sum !== BigInt(1000000) : sum !== totalMinor)
  )
    throw new BillingInputError(
      draft.mode === "percent"
        ? "Los porcentajes deben sumar exactamente 100 %."
        : "Los importes de las cuotas deben sumar el total del acuerdo.",
    );
  let distributed = BigInt(0);
  const installments = draft.installments.map((row, index): BillingInstallment => {
    const amount =
      draft.mode === "amount"
        ? shares[index]
        : index === shares.length - 1
          ? totalMinor - distributed
          : (totalMinor * shares[index]) / BigInt(1000000);
    if (amount < BigInt(0) || (totalMinor > BigInt(0) && amount === BigInt(0)))
      throw new BillingInputError(
        "Cada cuota debe tener un importe mayor que cero. Usa menos cuotas para este total.",
      );
    distributed += amount;
    const dueDate = billingText(row.dueDate, "fecha de cuota", 10);
    if (dueDate && !isFullDay(dueDate))
      throw new BillingInputError(
        "Usa una fecha completa para el vencimiento, o déjala por acordar.",
      );
    return {
      id: row.id,
      label: billingText(row.label, "nombre de la cuota", 160, true),
      amount: billingDecimal(amount),
      dueDate: dueDate || null,
    };
  });
  return {
    version: 1,
    issuer: readBillingParty(draft.issuer, true) as BillingIssuer,
    recipient: readBillingParty(draft.recipient) as BillingParty,
    installments,
    ...(draft.mode === "flexible" ? { paymentMode: "flexible" as const } : {}),
    paymentTerms:
      billingText(draft.paymentTerms, "forma de pago", 4000) ||
      (draft.mode === "flexible"
        ? "Pagos por avances, sin número de cuotas definido. Los importes y fechas pendientes se acuerdan durante el proyecto."
        : ""),
    deliveryTerms: billingText(draft.deliveryTerms, "condiciones de entrega", 4000),
    period: billingText(draft.period, "periodo facturado", 250),
  };
}

export function equalBillingQuotas(
  total: number,
  count: number,
  ids: string[],
): BillingQuotaDraft[] {
  if (!Number.isInteger(count) || count < 1 || count > 100 || ids.length !== count)
    throw new BillingInputError("Elige de 1 a 100 cuotas.");
  const value = billingMinor(total);
  const each = value / BigInt(count);
  return ids.map((id, index) => ({
    id,
    label: count === 1 ? "Pago único" : `Cuota ${index + 1}`,
    value: Number(
      billingDecimal(index === count - 1 ? value - each * BigInt(count - 1) : each),
    ).toLocaleString("es-CO", { maximumFractionDigits: 2 }),
    dueDate: "",
  }));
}

/** Validate persisted JSON rather than trusting casts from Prisma. */
export function parseBillingDetails(value: unknown, total: number): BillingPlanDetails {
  if (!value || typeof value !== "object")
    throw new BillingInputError("El plan guardado no es válido.");
  const details = value as BillingPlanDetails;
  if (details.version !== 1 || !Array.isArray(details.installments))
    throw new BillingInputError("Versión de plan no reconocida.");
  const read = readBillingPlan(
    {
      quoteId: "",
      projectId: "",
      revision: 1,
      ...details,
      mode: details.paymentMode === "flexible" ? "flexible" : "amount",
      installments: details.installments.map((row) => {
        if (!row || typeof row.amount !== "string" || !/^\d+(\.\d{1,2})?$/.test(row.amount))
          throw new BillingInputError("Importe guardado de cuota no válido.");
        return {
          id: row.id,
          label: row.label,
          value: Number(row.amount).toLocaleString("es-CO", { maximumFractionDigits: 2 }),
          dueDate: row.dueDate ?? "",
        };
      }),
    },
    total,
  );
  if (details.paymentMode !== undefined && details.paymentMode !== "flexible")
    throw new BillingInputError("Modalidad de pago guardada no reconocida.");
  if (details.flexiblePayments && details.paymentMode !== "flexible")
    throw new BillingInputError("Los pagos por avances necesitan su modalidad correspondiente.");
  return {
    ...read,
    ...(details.scopeDescription === undefined
      ? {}
      : { scopeDescription: billingText(details.scopeDescription, "alcance guardado", 20000) }),
    ...(details.flexiblePayments === undefined
      ? {}
      : { flexiblePayments: readFlexiblePayments(details.flexiblePayments, total) }),
  };
}

/** Stored payment history is validated on every read and never accepted from a plan draft. */
export function readFlexiblePayments(value: unknown, total: number): BillingFlexiblePayments {
  if (!value || typeof value !== "object")
    throw new BillingInputError("Historial de avances no válido.");
  const saved = value as Record<string, unknown>;
  if (!Array.isArray(saved.receipts) || !Array.isArray(saved.expected))
    throw new BillingInputError("Historial de avances incompleto.");
  const ids = new Set<string>();
  const id = (raw: unknown) => {
    if (typeof raw !== "string" || !billingUuid(raw) || ids.has(raw))
      throw new BillingInputError("Cada pago debe tener un identificador único.");
    ids.add(raw);
    return raw;
  };
  const amount = (raw: unknown) => {
    if (typeof raw !== "string" || !/^\d+(\.\d{1,2})?$/.test(raw) || billingMinor(raw) <= BigInt(0))
      throw new BillingInputError("El importe del pago debe ser mayor que cero.");
    return billingDecimal(billingMinor(raw));
  };
  const receipts = saved.receipts.map((raw) => {
    if (!raw || typeof raw !== "object") throw new BillingInputError("Pago recibido no válido.");
    const row = raw as Record<string, unknown>;
    const paidAt = billingText(row.paidAt, "fecha recibida", 10, true);
    if (!isFullDay(paidAt))
      throw new BillingInputError("Un pago recibido necesita una fecha completa.");
    const expectedId = row.expectedId ?? null;
    if (expectedId !== null && (typeof expectedId !== "string" || !billingUuid(expectedId)))
      throw new BillingInputError("Previsión de pago no válida.");
    return {
      id: id(row.id),
      amount: amount(row.amount),
      paidAt,
      concept: billingText(row.concept, "avance o concepto", 500, true),
      reference: billingText(row.reference, "referencia", 500),
      expectedId,
    };
  });
  const expected = saved.expected.map((raw) => {
    if (!raw || typeof raw !== "object") throw new BillingInputError("Pago previsto no válido.");
    const row = raw as Record<string, unknown>;
    const expectedAt = billingText(row.expectedAt ?? "", "fecha prevista", 10);
    if (expectedAt && !isPartialDate(expectedAt))
      throw new BillingInputError("Indica una fecha, mes o año válido para el pago previsto.");
    const receiptId = row.receiptId ?? null;
    if (receiptId !== null && (typeof receiptId !== "string" || !billingUuid(receiptId)))
      throw new BillingInputError("Pago asociado no válido.");
    return {
      id: id(row.id),
      amount: row.amount === null ? null : amount(row.amount),
      expectedAt: expectedAt || null,
      concept: billingText(row.concept, "avance o concepto", 500, true),
      receiptId,
    };
  });
  const sum = receipts.reduce((sum, receipt) => sum + billingMinor(receipt.amount), BigInt(0));
  if (sum > billingMinor(total))
    throw new BillingInputError("Los pagos recibidos superan el valor del acuerdo.");
  for (const receipt of receipts) {
    if (
      receipt.expectedId &&
      !expected.some((e) => e.id === receipt.expectedId && e.receiptId === receipt.id)
    )
      throw new BillingInputError("El pago y su previsión no coinciden.");
  }
  for (const entry of expected) {
    if (
      entry.receiptId &&
      !receipts.some((r) => r.id === entry.receiptId && r.expectedId === entry.id)
    )
      throw new BillingInputError("La previsión y su pago no coinciden.");
  }
  return { receipts, expected };
}

export function requireChargeIdentity(details: BillingPlanDetails) {
  for (const [party, label] of [
    [details.issuer, "emisor"],
    [details.recipient, "cliente"],
  ] as const)
    if (!party.name || !party.identification || !/\d/.test(party.identification))
      throw new BillingInputError(
        `Completa nombre e identificación del ${label} antes de emitir la cuenta de cobro.`,
      );
}
