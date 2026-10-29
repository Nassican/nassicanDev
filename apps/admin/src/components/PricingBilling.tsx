"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { BillingParty, BillingIssuer } from "@nassican/shared";
import type { BillingView } from "@/lib/billing";
import {
  billingMinor,
  billingMoney,
  emptyBillingParty,
  equalBillingQuotas,
  readBillingPlan,
  type BillingPlanDraft,
} from "@/lib/billing-values";
import { grouped } from "@/lib/pricing-draft";
import { isDirty, useUnsavedChanges } from "@/lib/use-unsaved";
import {
  saveBillingIssuerAction,
  saveBillingPlanAction,
  issueBillingChargeAction,
  recordBillingReceiptAction,
  cancelBillingChargeAction,
  type BillingActionResult,
} from "@/app/(panel)/precios/cobros/actions";
import PricingTabs from "./PricingTabs";
import PricingNumberInput from "./PricingNumberInput";
import PricingPdfDownload from "./PricingPdfDownload";
import DateField from "./DateField";
import Toast from "./Toast";
import FlexibleProjectPayments from "./FlexibleProjectPayments";
import { changeQuoteStatusAction } from "@/app/(panel)/precios/actions";
import {
  PricingLabel as Label,
  PricingSection as Section,
  pricingField as field,
  pricingButton as button,
  pricingPrimary as primary,
} from "./PricingFields";

const partyLabels: [keyof BillingParty, string][] = [
  ["name", "Nombre o razón social"],
  ["identification", "Identificación · CC / NIT / otro"],
  ["address", "Dirección"],
  ["city", "Ciudad"],
  ["email", "Correo"],
  ["phone", "Teléfono"],
];

function initialPlan(view: BillingView, initialMode: "amount" | "flexible"): BillingPlanDraft {
  const source = view.source;
  const mode = view.plan
    ? view.plan.details.paymentMode === "flexible"
      ? "flexible"
      : "amount"
    : initialMode;
  return {
    quoteId: source?.quoteId ?? "",
    projectId: source?.projectId ?? "",
    revision: view.plan?.revision ?? 0,
    mode,
    issuer: view.plan?.details.issuer ?? view.issuer,
    recipient: view.plan?.details.recipient ?? {
      ...emptyBillingParty(),
      name: source?.recipient ?? "",
    },
    installments:
      view.plan?.details.installments.map((q) => ({
        id: q.id,
        label: q.label,
        value: grouped(Number(q.amount)),
        dueDate: q.dueDate ?? "",
      })) ??
      (source && mode !== "flexible"
        ? equalBillingQuotas(source.amount, 1, [source.quoteId || source.projectId])
        : []),
    paymentTerms: view.plan?.details.paymentTerms ?? "",
    deliveryTerms: view.plan?.details.deliveryTerms ?? "",
    period: view.plan?.details.period ?? "",
  };
}

export default function PricingBilling({
  view,
  initialMode = "amount",
}: {
  view: BillingView;
  initialMode?: "amount" | "flexible";
}) {
  const router = useRouter();
  const baseline = initialPlan(view, initialMode);
  const [draft, setDraft] = useState(() => baseline);
  const [savedRevision, setSavedRevision] = useState(view.plan?.revision ?? 0);
  const [linkedProjectId, setLinkedProjectId] = useState(baseline.projectId);
  const [issuerOpen, setIssuerOpen] = useState(() => !baseline.issuer.identification);
  const [documentOpen, setDocumentOpen] = useState(() => baseline.mode !== "flexible");
  const [configurationOpen, setConfigurationOpen] = useState(!view.plan);
  const [paymentDirty, setPaymentDirty] = useState(false);
  const [count, setCount] = useState(String(draft.installments.length || 1));
  if (savedRevision !== (view.plan?.revision ?? 0)) {
    const next = baseline;
    setSavedRevision(view.plan?.revision ?? 0);
    setDraft(next);
    setCount(String(next.installments.length || 1));
  }
  if (linkedProjectId !== baseline.projectId) {
    setLinkedProjectId(baseline.projectId);
    setDraft((current) => ({ ...current, projectId: baseline.projectId }));
  }
  const [result, setResult] = useState<BillingActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [concepts, setConcepts] = useState<Record<string, string>>({});
  const dirty = isDirty(baseline, draft);
  useUnsavedChanges(dirty || paymentDirty);
  const source = view.source;
  const locked = view.plan?.locked ?? false;
  const calculation = (() => {
    try {
      return { details: source ? readBillingPlan(draft, source.amount) : null, error: "" };
    } catch (error) {
      return {
        details: null,
        error: error instanceof Error ? error.message : "Revisa las cuotas.",
      };
    }
  })();
  const money = (amount: number) => billingMoney(amount, source?.currency ?? "COP");
  function run(action: () => Promise<BillingActionResult>) {
    startTransition(async () => {
      try {
        const response = await action();
        setResult(response);
        if (response.ok) router.refresh();
      } catch {
        setResult({
          ok: false,
          message: "No se pudo completar la operación. Revisa la conexión.",
        });
      }
    });
  }
  function choose(value: string) {
    if ((dirty || paymentDirty) && !confirm("Tienes cambios sin guardar. ¿Cambiar de acuerdo?"))
      return;
    router.push(`/precios/cobros${value ? `?${value}` : ""}`);
  }
  function updateParty(key: "issuer" | "recipient", property: string, value: string) {
    setDraft((current) => ({ ...current, [key]: { ...current[key], [property]: value } }));
  }
  function equalSplit() {
    if (!source) return;
    try {
      const countNumber = Number(count);
      const rows = equalBillingQuotas(
        source.amount,
        countNumber,
        Array.from(
          { length: Math.max(0, Math.min(100, countNumber || 0)) },
          (_, i) => draft.installments[i]?.id ?? crypto.randomUUID(),
        ),
      );
      setDraft((current) => ({
        ...current,
        mode: "amount",
        installments: rows.map((q, i) => ({
          ...q,
          label: current.installments[i]?.label ?? q.label,
          dueDate: current.installments[i]?.dueDate ?? "",
        })),
      }));
    } catch (error) {
      setResult({
        ok: false,
        message: error instanceof Error ? error.message : "Revisa el número de cuotas.",
      });
    }
  }
  function changeMode(mode: BillingPlanDraft["mode"]) {
    if (mode === draft.mode) return;
    if (mode === "flexible") {
      setDocumentOpen(false);
      setIssuerOpen(false);
      setDraft((current) => ({ ...current, mode, installments: [] }));
      return;
    }
    if (draft.mode === "flexible" && source) {
      setDocumentOpen(true);
      setDraft((current) => ({
        ...current,
        mode: "amount",
        installments: equalBillingQuotas(source.amount, 1, [crypto.randomUUID()]),
      }));
      setCount("1");
      return;
    }
    if (!calculation.details || !source) {
      setResult({
        ok: false,
        message: "Completa la distribución actual antes de cambiar el modo.",
      });
      return;
    }
    if (mode === "amount") {
      setDraft((current) => ({
        ...current,
        mode,
        installments: calculation.details!.installments.map((q) => ({
          id: q.id,
          label: q.label,
          value: grouped(Number(q.amount)),
          dueDate: q.dueDate ?? "",
        })),
      }));
      return;
    }
    const total = billingMinor(source.amount);
    if (total === BigInt(0)) {
      setResult({
        ok: false,
        message: "Para un acuerdo gratuito usa la distribución por importes.",
      });
      return;
    }
    let used = BigInt(0);
    setDraft((current) => ({
      ...current,
      mode,
      installments: calculation.details!.installments.map((q, i, rows) => {
        const share =
          i === rows.length - 1
            ? BigInt(1000000) - used
            : (billingMinor(q.amount) * BigInt(1000000)) / total;
        used += share;
        return {
          id: q.id,
          label: q.label,
          dueDate: q.dueDate ?? "",
          value: grouped(Number(share) / 10000),
        };
      }),
    }));
  }
  return (
    <div className="flex flex-col gap-6">
      <PricingTabs current="billing" />
      <header>
        <h1 className="text-xl font-semibold">Pagos y documentos</h1>
        <p className="mt-1 max-w-prose text-sm text-neutral-500">
          Elige cuotas acordadas o pagos por avances. Registra lo que recibes y lo que esperas
          recibir; el saldo del proyecto se actualiza con los pagos reales.
        </p>
      </header>
      {!view.ready ? (
        <p
          role="status"
          className="rounded border border-neutral-800 p-4 text-sm text-neutral-500"
        >
          La migración de cobros está pendiente. Puedes revisar y preparar las cuotas; guardar y
          emitir se habilitará al activar la base de datos.
        </p>
      ) : null}
      <Section title="Acuerdo de origen">
        <Label
          label="Cotización o proyecto"
          help="Elige una cotización guardada o un trabajo existente. Una cotización aceptada usa el mismo proyecto; no se crea una segunda deuda por abrirla desde Trabajos."
        >
          <select
            className={field}
            value={
              source?.quoteId
                ? `quoteId=${source.quoteId}`
                : source?.projectId
                  ? `projectId=${source.projectId}`
                  : ""
            }
            onChange={(e) => choose(e.target.value)}
          >
            <option value="">Selecciona el acuerdo</option>
            <optgroup label="Cotizaciones">
              {view.quotes.map((q) => (
                <option key={q.id} value={`quoteId=${q.id}`}>
                  {q.title}
                  {q.status === "accepted" ? " · aceptada" : " · propuesta"}
                </option>
              ))}
            </optgroup>
            <optgroup label="Proyectos / Trabajos">
              {view.projects
                .filter((p) => !view.quotes.some((q) => q.projectId === p.id))
                .map((p) => (
                  <option key={p.id} value={`projectId=${p.id}`}>
                    {p.title} · {p.company}
                  </option>
                ))}
            </optgroup>
          </select>
        </Label>
        {view.sourceError ? (
          <p role="alert" className="text-sm text-neutral-500">
            {view.sourceError}{" "}
            <Link href="/trabajos" className="underline">
              Ir a Trabajos
            </Link>
          </p>
        ) : null}
        {source ? (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p>
              <strong>{source.title}</strong>
              <span className="mt-1 block text-neutral-500">
                Total: {money(source.amount)} {source.currency}
                {source.unit === "monthly"
                  ? " por mes"
                  : source.unit === "hour"
                    ? " por hora"
                    : " por el proyecto"}
              </span>
            </p>
            {source.projectId ? (
              <Link className={button} href="/trabajos">
                Ver proyecto en Trabajos
              </Link>
            ) : (
              <p className="max-w-sm text-xs text-neutral-500">
                Al aceptar la cotización se conectará el proyecto. Puedes definir sus cuotas
                desde ahora.
              </p>
            )}
          </div>
        ) : null}
        {!source && !view.sourceError ? (
          <div className="flex flex-wrap gap-3 text-sm">
            <Link className={button} href="/precios">
              Preparar una cotización
            </Link>
            <Link className={button} href="/trabajos">
              Registrar pagos de un trabajo
            </Link>
          </div>
        ) : null}
      </Section>
      {source ? (
        <>
          {!source.canIssue && source.quoteId ? (
            <Section title="Aceptación del cliente">
              <p className="max-w-prose text-sm text-neutral-500">
                Puedes preparar el acuerdo y su PDF antes de la aceptación. Cuando el cliente lo
                haya aceptado, confírmalo aquí para conectar el proyecto y habilitar sus pagos.
              </p>
              <div>
                <button
                  type="button"
                  className={primary}
                  disabled={pending || !view.ready || dirty}
                  onClick={() => run(() => changeQuoteStatusAction(source.quoteId, "accepted"))}
                >
                  Confirmar aceptación del cliente
                </button>
              </div>
              {dirty ? (
                <p className="text-xs text-neutral-500">
                  Guarda los cambios del acuerdo antes de confirmar la aceptación.
                </p>
              ) : null}
            </Section>
          ) : null}
          {view.plan ? (
            <div
              className="flex flex-wrap items-center gap-3"
              aria-label="Acciones del acuerdo guardado"
            >
              <PricingPdfDownload
                id={view.plan.id}
                kind="plan"
                label="Descargar cotización"
                disabled={dirty || pending}
              />
              <button
                type="button"
                className={button}
                onClick={() => setConfigurationOpen((current) => !current)}
                aria-expanded={configurationOpen}
                aria-controls="billing-configuration"
              >
                {configurationOpen ? "Cerrar configuración" : "Editar acuerdo y datos del PDF"}
              </button>
              {dirty ? (
                <p className="text-xs text-neutral-500">
                  Guarda los cambios para actualizar el PDF.
                </p>
              ) : null}
            </div>
          ) : null}
          <details
            id="billing-configuration"
            open={configurationOpen}
            onToggle={(event) => setConfigurationOpen(event.currentTarget.open)}
            className="min-w-0"
          >
            <summary className="cursor-pointer text-sm font-medium">
              {view.plan ? "Configuración del acuerdo y del PDF" : "Preparar el acuerdo"}
              {dirty ? " · cambios sin guardar" : ""}
            </summary>
            <div className="mt-4 flex min-w-0 flex-col gap-6">
              <Section title="Datos del documento">
                <details
                  open={documentOpen}
                  onToggle={(event) => setDocumentOpen(event.currentTarget.open)}
                >
                  <summary className="cursor-pointer text-sm font-medium">
                    {draft.mode === "flexible"
                      ? "Datos para cotizar (opcional)"
                      : "Emisor y cliente"}
                  </summary>
                  <div className="mt-4 flex min-w-0 flex-col gap-4">
                    <details
                      open={issuerOpen}
                      onToggle={(event) => setIssuerOpen(event.currentTarget.open)}
                      className="min-w-0"
                    >
                      <summary className="cursor-pointer text-sm font-medium">
                        Emisor Nassican y datos de pago
                      </summary>
                      <fieldset
                        disabled={pending || locked}
                        className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2"
                      >
                        {partyLabels.map(([key, label]) => (
                          <Label
                            key={key}
                            label={`${label} del emisor`}
                            help="Datos de quien presta el servicio y solicita el pago. Se incluyen en el documento; no se publican en el portafolio."
                          >
                            <input
                              className={field}
                              value={draft.issuer[key]}
                              onChange={(e) => updateParty("issuer", key, e.target.value)}
                            />
                          </Label>
                        ))}
                        {(
                          [
                            ["bank", "Banco / entidad de pago"],
                            ["accountType", "Tipo de cuenta"],
                            ["accountNumber", "Número de cuenta o medio de pago"],
                          ] as const
                        ).map(([key, label]) => (
                          <Label
                            key={key}
                            label={label}
                            help="Información opcional que verá el destinatario para realizar el pago. No se conecta ni se consulta tu banco."
                          >
                            <input
                              className={field}
                              value={draft.issuer[key]}
                              onChange={(e) => updateParty("issuer", key, e.target.value)}
                            />
                          </Label>
                        ))}
                        <Label
                          label="Instrucciones de pago"
                          help="Indica el medio y las instrucciones acordadas. No se inventan anticipos, retenciones ni obligaciones tributarias."
                        >
                          <textarea
                            className={field}
                            value={draft.issuer.paymentInstructions}
                            onChange={(e) =>
                              updateParty("issuer", "paymentInstructions", e.target.value)
                            }
                          />
                        </Label>
                      </fieldset>
                      {!locked ? (
                        <button
                          type="button"
                          className={`${button} mt-3`}
                          disabled={pending || !view.ready}
                          onClick={() =>
                            run(() => saveBillingIssuerAction(draft.issuer as BillingIssuer))
                          }
                        >
                          Guardar emisor como predeterminado
                        </button>
                      ) : null}
                    </details>
                    <fieldset
                      disabled={pending || locked}
                      className="grid min-w-0 gap-4 sm:grid-cols-2"
                    >
                      {partyLabels.map(([key, label]) => (
                        <Label
                          key={key}
                          label={`${label} del cliente`}
                          help="Identificación del destinatario que paga. El nombre y el documento son necesarios para emitir una cuenta de cobro."
                        >
                          <input
                            className={field}
                            value={draft.recipient[key]}
                            onChange={(e) => updateParty("recipient", key, e.target.value)}
                          />
                        </Label>
                      ))}
                    </fieldset>
                    {locked ? (
                      <p className="text-xs text-neutral-500">
                        Los datos y las cuotas quedan congelados al emitir la primera cuenta.
                        Sus PDF conservan la identificación original.
                      </p>
                    ) : null}
                  </div>
                </details>
              </Section>
              <Section
                title={draft.mode === "flexible" ? "Forma de pago" : "Distribución del valor"}
              >
                <Label
                  label="Modalidad de pago"
                  help="Cuotas acordadas si ya conoces el reparto. Pagos por avances si te pagan importes variables y todavía no sabes cuántos pagos serán."
                >
                  <select
                    className={field}
                    value={draft.mode === "flexible" ? "flexible" : "installments"}
                    disabled={
                      pending ||
                      locked ||
                      Boolean(view.plan?.details.flexiblePayments?.receipts.length) ||
                      Boolean(view.plan?.details.flexiblePayments?.expected.length)
                    }
                    onChange={(event) =>
                      changeMode(event.target.value === "flexible" ? "flexible" : "amount")
                    }
                  >
                    <option value="installments">Cuotas acordadas</option>
                    <option value="flexible">Pagos por avances · sin cuotas definidas</option>
                  </select>
                </Label>
                {draft.mode === "flexible" ? (
                  <p className="text-sm text-neutral-500">
                    No necesitas repartir el total ni definir cuántos pagos habrá. Guarda el
                    acuerdo y agrega cada pago cuando lo recibas. También puedes anotar un
                    próximo pago con importe o fecha por acordar.
                  </p>
                ) : null}
                <fieldset disabled={pending || locked} className="flex flex-col gap-4">
                  {draft.mode !== "flexible" ? (
                    <>
                      <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
                        <Label
                          label="Número de cuotas"
                          help="Elige de 1 a 100. El reparto igual deja los centavos restantes en la última cuota; después puedes personalizar cada importe."
                        >
                          <PricingNumberInput
                            className={field}
                            value={count}
                            onChange={(e) => setCount(e.target.value)}
                          />
                        </Label>
                        <Label
                          label="Dividir por"
                          help="Por importes: la suma debe coincidir con el acuerdo. Por porcentajes: deben sumar 100 %. Los centavos residuales se asignan a la última cuota."
                        >
                          <select
                            className={field}
                            value={draft.mode}
                            onChange={(e) => changeMode(e.target.value as "amount" | "percent")}
                          >
                            <option value="amount">Importes personalizados</option>
                            <option value="percent">Porcentajes personalizados</option>
                          </select>
                        </Label>
                        <button type="button" className={button} onClick={equalSplit}>
                          Repartir en cuotas iguales
                        </button>
                      </div>
                      <div className="flex flex-col gap-3">
                        {draft.installments.map((quota, index) => (
                          <div
                            key={quota.id}
                            className="grid min-w-0 gap-3 border-b border-neutral-800 pb-4 sm:grid-cols-[1.3fr_1fr_1fr]"
                            data-quota-id={quota.id}
                          >
                            <Label
                              label={`Nombre de cuota ${index + 1}`}
                              help="Puedes llamarla Anticipo, Diseño, Entrega o el hito que acuerdes con el cliente."
                            >
                              <input
                                className={field}
                                value={quota.label}
                                onChange={(e) =>
                                  setDraft((d) => ({
                                    ...d,
                                    installments: d.installments.map((q) =>
                                      q.id === quota.id ? { ...q, label: e.target.value } : q,
                                    ),
                                  }))
                                }
                              />
                            </Label>
                            <Label
                              label={`${draft.mode === "percent" ? "Porcentaje (%)" : `Importe (${source.currency})`} de cuota ${index + 1}`}
                              help="Escribe el valor sin calcular fracciones. Un porcentaje de 30 significa 30 %. El resumen verifica que el acuerdo esté totalmente distribuido."
                            >
                              <PricingNumberInput
                                className={field}
                                value={quota.value}
                                onChange={(e) =>
                                  setDraft((d) => ({
                                    ...d,
                                    installments: d.installments.map((q) =>
                                      q.id === quota.id ? { ...q, value: e.target.value } : q,
                                    ),
                                  }))
                                }
                              />
                              {calculation.details ? (
                                <span className="text-xs text-neutral-500">
                                  {money(
                                    Number(calculation.details.installments[index].amount),
                                  )}
                                </span>
                              ) : null}
                            </Label>
                            <Label
                              label={`Vencimiento de cuota ${index + 1}`}
                              help="Fecha completa del pago acordado. Déjala vacía si todavía no se acuerda; no se inventa una fecha de vencimiento."
                            >
                              <DateField
                                value={quota.dueDate}
                                onChange={(value) =>
                                  setDraft((d) => ({
                                    ...d,
                                    installments: d.installments.map((q) =>
                                      q.id === quota.id ? { ...q, dueDate: value } : q,
                                    ),
                                  }))
                                }
                                label={`Cuota ${index + 1}`}
                              />
                            </Label>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Label
                      label="Forma y condiciones de pago"
                      help="Texto acordado que acompaña la tabla de cuotas: transferencia, hitos, fecha relativa o condiciones. Se incluye en los PDF."
                    >
                      <textarea
                        className={field}
                        rows={3}
                        value={draft.paymentTerms}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, paymentTerms: e.target.value }))
                        }
                      />
                    </Label>
                    <Label
                      label="Plazo y condiciones de entrega"
                      help="Define el plazo y condiciones que realmente has acordado. Si falta, el documento indicará por acordar."
                    >
                      <textarea
                        className={field}
                        rows={3}
                        value={draft.deliveryTerms}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, deliveryTerms: e.target.value }))
                        }
                      />
                    </Label>
                  </div>
                  {source.unit !== "project" ? (
                    <Label
                      label="Periodo o ciclo del cobro"
                      help="Identifica a qué mes, ciclo o grupo de horas corresponde este acuerdo. No se multiplican meses u horas automáticamente."
                    >
                      <input
                        className={field}
                        value={draft.period}
                        onChange={(e) => setDraft((d) => ({ ...d, period: e.target.value }))}
                      />
                    </Label>
                  ) : null}
                </fieldset>
                {calculation.error ? (
                  <p role="alert" className="text-sm text-neutral-500">
                    {calculation.error}
                  </p>
                ) : draft.mode === "flexible" ? (
                  <p className="text-sm">
                    Valor del acuerdo: <strong>{money(source.amount)}</strong>. El saldo puede
                    quedar sin distribuir.
                  </p>
                ) : (
                  <p className="text-sm">
                    Distribuido: <strong>{money(source.amount)}</strong> en{" "}
                    {draft.installments.length} cuota
                    {draft.installments.length === 1 ? "" : "s"}.
                  </p>
                )}
                <div className="flex flex-wrap gap-3">
                  {!locked ? (
                    <button
                      type="button"
                      className={primary}
                      disabled={
                        pending ||
                        !view.ready ||
                        Boolean(calculation.error) ||
                        Boolean(view.plan && !dirty)
                      }
                      onClick={() => run(() => saveBillingPlanAction(draft))}
                    >
                      {draft.mode === "flexible"
                        ? "Guardar acuerdo por avances"
                        : "Guardar plan de cuotas"}
                    </button>
                  ) : null}
                </div>
              </Section>
            </div>
          </details>
          {view.plan?.details.paymentMode === "flexible" ? (
            <FlexibleProjectPayments
              plan={view.plan}
              source={source}
              today={view.today}
              ready={view.ready}
              dirty={dirty}
              pending={pending}
              run={run}
              onDirtyChange={setPaymentDirty}
            />
          ) : null}
          {view.plan && view.plan.details.paymentMode !== "flexible" ? (
            <Section title="Cuentas de cobro y abonos">
              {!source.canIssue ? (
                <p className="text-sm text-neutral-500">
                  Confirma arriba la aceptación del cliente para habilitar la emisión de
                  cuentas.
                </p>
              ) : null}
              {dirty ? (
                <p className="text-xs text-neutral-500">
                  Guarda los cambios antes de emitir una cuenta.
                </p>
              ) : null}
              {view.plan.details.installments.map((quota, index) => {
                const active = view.plan!.charges.find(
                  (charge) => charge.installmentId === quota.id && !charge.canceled,
                );
                return (
                  <div key={quota.id} className="min-w-0 border-b border-neutral-800 pb-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-medium">
                        {index + 1}. {quota.label} · {money(Number(quota.amount))}
                      </p>
                      <p className="text-xs text-neutral-500">
                        Vencimiento: {quota.dueDate ?? "Por acordar"}
                      </p>
                    </div>
                    {!active ? (
                      <div className="mt-3 flex flex-col gap-3">
                        <Label
                          label={`Concepto para ${quota.label}`}
                          help="Descripción precisa del servicio o hito que estás cobrando. Se conservará junto con la identidad y el valor al emitir."
                        >
                          <textarea
                            className={field}
                            value={concepts[quota.id] ?? `${source.title} — ${quota.label}`}
                            onChange={(e) =>
                              setConcepts((current) => ({
                                ...current,
                                [quota.id]: e.target.value,
                              }))
                            }
                          />
                        </Label>
                        <div>
                          <button
                            type="button"
                            className={button}
                            disabled={pending || !view.ready || !source.canIssue || dirty}
                            aria-label={`Emitir cuenta de cobro: ${quota.label}`}
                            onClick={() =>
                              run(() =>
                                issueBillingChargeAction(
                                  view.plan!.id,
                                  quota.id,
                                  concepts[quota.id] ?? `${source.title} — ${quota.label}`,
                                ),
                              )
                            }
                          >
                            Emitir cuenta de cobro
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {view
                      .plan!.charges.filter((charge) => charge.installmentId === quota.id)
                      .map((charge) => (
                        <ChargeRow
                          key={charge.id}
                          charge={charge}
                          today={view.today}
                          pending={pending}
                          currency={source.currency}
                          run={run}
                        />
                      ))}
                  </div>
                );
              })}
              <p className="text-xs text-neutral-500">
                Una cuenta de cobro no declara tu situación tributaria ni sustituye los
                documentos fiscales que correspondan.{" "}
                <a
                  className="underline"
                  href="https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/documento-soporte-adquisiciones-no-obligados/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Información de DIAN
                </a>
                . Los abonos son registros manuales, sin conexión bancaria.
              </p>
            </Section>
          ) : null}
        </>
      ) : null}
      <Toast result={result} onDismiss={() => setResult(null)} />
    </div>
  );
}

function ChargeRow({
  charge,
  today,
  pending,
  currency,
  run,
}: {
  charge: NonNullable<BillingView["plan"]>["charges"][number];
  today: string;
  pending: boolean;
  currency: string;
  run: (action: () => Promise<BillingActionResult>) => void;
}) {
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(today);
  const [reference, setReference] = useState("");
  const [requestId, setRequestId] = useState("");
  const paid = charge.receipts.reduce(
    (sum, receipt) => sum + billingMinor(receipt.amount),
    BigInt(0),
  );
  const remaining = Number(billingMinor(charge.amount) - paid) / 100;
  return (
    <div className="mt-4 rounded border border-neutral-800 p-3" data-charge-id={charge.id}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <strong>Cuenta NC-{String(charge.sequence).padStart(6, "0")}</strong>
          <p className="mt-1 text-xs text-neutral-500">
            {charge.canceled
              ? "Anulada"
              : remaining === 0
                ? "Pagada"
                : paid > BigInt(0)
                  ? "Con abonos"
                  : "Pendiente"}{" "}
            · Registrado: {billingMoney(Number(paid) / 100, currency)} · Saldo:{" "}
            {billingMoney(remaining, currency)}
          </p>
        </div>
        <PricingPdfDownload id={charge.id} kind="charge" label="Descargar cuenta de cobro" />
      </div>
      {charge.canceled ? (
        <p className="mt-2 text-xs text-neutral-500">{charge.cancellationReason}</p>
      ) : null}
      {charge.receipts.length ? (
        <ul className="mt-3 space-y-1 text-xs text-neutral-500">
          {charge.receipts.map((receipt) => (
            <li key={receipt.id}>
              {receipt.paidAt} · {billingMoney(receipt.amount, currency)} · {receipt.reference}
            </li>
          ))}
        </ul>
      ) : null}
      {!charge.canceled && remaining > 0 ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium">
            Registrar abono recibido
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Label
              label="Importe del abono"
              help="Pago recibido, mayor que cero y sin superar el saldo de esta cuenta. No redondea el acuerdo ni crea movimientos bancarios."
            >
              <PricingNumberInput
                className={field}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setRequestId("");
                }}
              />
            </Label>
            <Label label="Fecha del abono">
              <DateField
                value={paidAt}
                onChange={(value) => {
                  setPaidAt(value);
                  setRequestId("");
                }}
              />
            </Label>
            <Label label="Referencia del abono">
              <input
                className={field}
                value={reference}
                onChange={(e) => {
                  setReference(e.target.value);
                  setRequestId("");
                }}
              />
            </Label>
          </div>
          <button
            type="button"
            className={`${button} mt-3`}
            disabled={pending || !amount || !reference}
            onClick={() => {
              const id = requestId || crypto.randomUUID();
              setRequestId(id);
              run(async () => {
                const response = await recordBillingReceiptAction({
                  id,
                  chargeId: charge.id,
                  amount,
                  paidAt,
                  reference,
                });
                if (response.ok) {
                  setAmount("");
                  setReference("");
                  setRequestId("");
                }
                return response;
              });
            }}
          >
            Guardar abono
          </button>
        </details>
      ) : null}
      {!charge.canceled && !charge.receipts.length ? (
        <button
          type="button"
          className="mt-3 text-xs text-neutral-500 underline"
          disabled={pending}
          onClick={() => {
            const reason = prompt(
              "Motivo de anulación. Se conserva el documento y no se elimina el historial.",
            );
            if (reason?.trim()) run(() => cancelBillingChargeAction(charge.id, reason));
          }}
        >
          Anular cuenta sin abonos
        </button>
      ) : null}
    </div>
  );
}
