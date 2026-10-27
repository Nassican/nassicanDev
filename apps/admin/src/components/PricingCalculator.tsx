"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PricingSnapshot } from "@nassican/shared";
import {
  saveClientAction,
  previewQuoteAction,
  saveQuoteAction,
  deletePricingClientAction,
  type PricingActionResult,
} from "@/app/(panel)/precios/actions";
import type { PricingCalculatorView } from "@/lib/pricing";
import { calculatePricing } from "@/lib/pricing-engine";
import {
  emptyPricingClient,
  emptyPricingQuote,
  grouped,
  modeLabels,
  originLabels,
  pricingClientProblems,
  pricingMoney,
  pricingQuoteProblems,
  quoteInput,
  scopeLabels,
  unitLabels,
  type PricingClientDraft,
  type PricingQuoteDraft,
} from "@/lib/pricing-draft";
import { parseNumber } from "@/lib/draft-fields";
import { isDirty, useUnsavedChanges } from "@/lib/use-unsaved";
import DateField from "./DateField";
import Toast from "./Toast";
import PricingTabs from "./PricingTabs";
import PricingResult from "./PricingResult";
import PricingFinancials from "./PricingFinancials";
import PricingLocationFields from "./PricingLocationFields";
import PricingClientSignals from "./PricingClientSignals";
import {
  PricingLabel as Label,
  PricingSection as Section,
  pricingField as field,
  pricingButton as button,
  pricingPrimary as primary,
} from "./PricingFields";

export default function PricingCalculator({ view }: { view: PricingCalculatorView }) {
  const router = useRouter();
  const [draft, setDraft] = useState(emptyPricingQuote);
  const [clientDraft, setClientDraft] = useState<PricingClientDraft | null>(null);
  const [outcome, setOutcome] = useState<PricingActionResult | null>(null);
  const [preview, setPreview] = useState<{ key: string; snapshot: PricingSnapshot } | null>(null);
  const [savedKey, setSavedKey] = useState("");
  const [pending, startTransition] = useTransition();
  const key = JSON.stringify(draft);
  const calculationKey = JSON.stringify({ ...draft, title: "", final: "", validUntil: "" });
  const dirty = savedKey !== key && isDirty(emptyPricingQuote(), draft);
  useUnsavedChanges(dirty || (clientDraft !== null && isDirty(emptyPricingClient(), clientDraft)));
  const client = view.clients.find((c) => c.id === draft.clientId);
  const service = view.services.find((s) => s.id === draft.serviceId);
  const snapshot = preview?.key === calculationKey ? preview.snapshot : undefined;
  const local =
    service && client && (parseNumber(draft.hours) ?? 0) > 0
      ? calculatePricing(
          quoteInput(draft, service, {
            ...client,
            monthlyIncome: client.type === "company" ? null : client.monthlyIncome,
          }),
          view.parameters,
        )
      : null;
  const result = snapshot?.result ?? local;
  const problems = pricingQuoteProblems(draft);
  const calculationProblems = pricingQuoteProblems(draft, false);
  function update<K extends keyof PricingQuoteDraft>(k: K, value: PricingQuoteDraft[K]) {
    setDraft((d) => ({ ...d, [k]: value, ...(k === "clientId" ? { financialId: "" } : {}) }));
  }
  function updateClient<K extends keyof PricingClientDraft>(k: K, value: PricingClientDraft[K]) {
    setClientDraft((d) => (d ? { ...d, [k]: value } : d));
  }
  function run(
    action: () => Promise<PricingActionResult>,
    onOk?: (r: PricingActionResult) => void,
  ) {
    startTransition(async () => {
      try {
        const r = await action();
        setOutcome(r);
        if (r.ok) {
          onOk?.(r);
          router.refresh();
        }
      } catch {
        setOutcome({
          ok: false,
          message: "No se pudo guardar. Revisa la conexión e inténtalo de nuevo.",
        });
      }
    });
  }
  return (
    <div className="flex flex-col gap-6">
      <PricingTabs current="calculate" />
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Precios</h1>
        <p className="mt-1 max-w-prose text-sm text-neutral-500">
          Tus costos fijan el piso. El cliente y el mercado ayudan a decidir cuánto cobrar por
          encima.
        </p>
      </header>
      {!view.services.length ? (
        <p className="rounded border border-neutral-800 p-4 text-sm">
          Primero{" "}
          <Link className="underline" href="/precios/parametros">
            añade un servicio y revisa tus costos en Parámetros
          </Link>
          .
        </p>
      ) : null}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.7fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Section title="Cliente">
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Label label="Elegir cliente">
                  <select
                    className={field}
                    value={draft.clientId}
                    onChange={(e) => update("clientId", e.target.value)}
                  >
                    <option value="">Selecciona un cliente</option>
                    {view.clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.type === "person" ? "persona" : "empresa"})
                      </option>
                    ))}
                  </select>
                </Label>
              </div>
              <button className={button} onClick={() => setClientDraft(emptyPricingClient())}>
                Crear
              </button>
              {client ? (
                <button
                  className={button}
                  onClick={() =>
                    setClientDraft({
                      ...emptyPricingClient(),
                      ...client,
                      department: client.department ?? "",
                      municipality: client.municipality ?? "",
                      zone: client.zone === "rural" ? "rural" : "urban",
                      stratum: client.stratum === null ? "" : String(client.stratum),
                      monthlyIncome: grouped(client.monthlyIncome),
                      foundedAt: client.foundedAt ?? "",
                      activity: client.activity ?? "",
                      notes: client.notes ?? "",
                    })
                  }
                >
                  Editar
                </button>
              ) : null}
            </div>
            {client ? (
              <p className="text-xs text-neutral-500">
                {client.type === "person"
                  ? `Ingreso mensual: ${client.monthlyIncome === null ? "Sin dato" : pricingMoney(client.monthlyIncome)} (${originLabels[client.incomeOrigin]}). Estrato ${client.stratum ?? "sin dato"}.`
                  : "Empresa: registra sus periodos financieros para calcular la capacidad."}{" "}
                {client.country}, {client.department}, {client.municipality}, zona{" "}
                {client.zone === "rural" ? "rural" : "urbana"}.
              </p>
            ) : null}
            {clientDraft ? (
              <div className="flex flex-col gap-4 border-t border-neutral-800 pt-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Label label="Nombre">
                    <input
                      className={field}
                      value={clientDraft.name}
                      onChange={(e) => updateClient("name", e.target.value)}
                    />
                  </Label>
                  <Label label="Tipo">
                    <select
                      className={field}
                      value={clientDraft.type}
                      onChange={(e) =>
                        updateClient("type", e.target.value as PricingClientDraft["type"])
                      }
                    >
                      <option value="person">Persona natural</option>
                      <option value="company">Empresa</option>
                    </select>
                  </Label>
                  <PricingLocationFields
                    value={clientDraft}
                    places={view.geography.places}
                    onChange={(location) => setClientDraft((d) => (d ? { ...d, ...location } : d))}
                  />
                  {(
                    [
                      ["activity", "Actividad económica"],
                      ["stratum", "Estrato (0 a 6)"],
                      ["monthlyIncome", "Ingreso mensual, COP"],
                    ] as const
                  ).map(([k, label]) => (
                    <Label key={k} label={label}>
                      <input
                        className={field}
                        value={clientDraft[k]}
                        onChange={(e) => updateClient(k, e.target.value)}
                      />
                    </Label>
                  ))}
                  <Label label="Origen del ingreso">
                    <select
                      className={field}
                      value={clientDraft.incomeOrigin}
                      onChange={(e) =>
                        updateClient(
                          "incomeOrigin",
                          e.target.value as PricingClientDraft["incomeOrigin"],
                        )
                      }
                    >
                      {Object.entries(originLabels).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </Label>
                  <Label label="Zona">
                    <select
                      className={field}
                      value={clientDraft.zone}
                      onChange={(e) =>
                        updateClient("zone", e.target.value as PricingClientDraft["zone"])
                      }
                    >
                      <option value="urban">Urbana</option>
                      <option value="rural">Rural</option>
                    </select>
                  </Label>
                  <Label label="Fecha de creación">
                    <DateField
                      value={clientDraft.foundedAt}
                      onChange={(v) => updateClient("foundedAt", v)}
                      label="Creación del cliente"
                    />
                  </Label>
                  <Label label="Notas">
                    <textarea
                      className={field}
                      value={clientDraft.notes}
                      onChange={(e) => updateClient("notes", e.target.value)}
                    />
                  </Label>
                </div>
                <p className="text-xs text-neutral-500">
                  Sin declaración de renta: usa el promedio mensual de consignaciones o lo dicho por
                  el cliente, con origen estimado.
                </p>
                <div className="flex gap-2">
                  <button
                    className={primary}
                    disabled={pending || pricingClientProblems(clientDraft).length > 0}
                    onClick={() =>
                      run(
                        () => saveClientAction(clientDraft),
                        (r) => {
                          if (r.id) update("clientId", r.id);
                          setClientDraft(null);
                        },
                      )
                    }
                  >
                    Guardar cliente
                  </button>
                  <button className={button} onClick={() => setClientDraft(null)}>
                    Cancelar
                  </button>
                </div>
              </div>
            ) : null}
            {client ? (
              <PricingFinancials
                key={client.id}
                clientId={client.id}
                person={client.type === "person"}
                rows={view.financials.filter((f) => f.clientId === client.id)}
                selectedId={draft.financialId}
                onSelect={(id) => update("financialId", id)}
                parameters={view.parameters}
              />
            ) : null}
            {client ? (
              <>
                <PricingClientSignals
                  key={`signals:${client.id}`}
                  clientId={client.id}
                  signals={client.signals}
                />
                <button
                  className={button}
                  disabled={pending}
                  onClick={() => {
                    if (
                      confirm(
                        `¿Mover a «${client.name}» a la papelera con sus periodos y señales? Sus cotizaciones conservan el snapshot.`,
                      )
                    )
                      run(
                        () => deletePricingClientAction(client.id),
                        () => update("clientId", ""),
                      );
                  }}
                >
                  Mover cliente a la papelera
                </button>
              </>
            ) : null}
          </Section>
          <Section title="Proyecto y costos">
            <div className="grid gap-3 sm:grid-cols-2">
              <Label label="Título de la cotización">
                <input
                  className={field}
                  value={draft.title}
                  onChange={(e) => update("title", e.target.value)}
                />
              </Label>
              <Label label="Servicio">
                <select
                  className={field}
                  value={draft.serviceId}
                  onChange={(e) => {
                    const s = view.services.find((s) => s.id === e.target.value);
                    setDraft((d) => ({
                      ...d,
                      serviceId: e.target.value,
                      hours: s?.unit === "hour" ? "1" : grouped(s?.typicalHours ?? 20),
                      unit: s?.unit ?? "project",
                    }));
                  }}
                >
                  <option value="">Selecciona un servicio</option>
                  {view.services
                    .filter((s) => s.active)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </Label>
              <Label label="Nivel de alcance">
                <select
                  className={field}
                  value={draft.scope}
                  onChange={(e) => update("scope", e.target.value as PricingQuoteDraft["scope"])}
                >
                  {Object.entries(scopeLabels).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Label>
              <Label label="Cobro">
                <select
                  className={field}
                  value={draft.unit}
                  onChange={(e) => {
                    const unit = e.target.value as PricingQuoteDraft["unit"];
                    setDraft((d) => ({ ...d, unit, ...(unit === "hour" ? { hours: "1" } : {}) }));
                  }}
                >
                  {Object.entries(unitLabels).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Label>
              <Label
                label={draft.unit === "monthly" ? "Horas estimadas al mes" : "Horas estimadas"}
              >
                <input
                  inputMode="decimal"
                  className={field}
                  value={draft.hours}
                  onChange={(e) => update("hours", e.target.value)}
                />
              </Label>
              <Label label="Origen de las horas">
                <select
                  className={field}
                  value={draft.hoursOrigin}
                  onChange={(e) =>
                    update("hoursOrigin", e.target.value as PricingQuoteDraft["hoursOrigin"])
                  }
                >
                  {Object.entries(originLabels).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Label>
              <Label label="Costos directos, COP">
                <input
                  inputMode="decimal"
                  className={field}
                  value={draft.directCosts}
                  onChange={(e) => update("directCosts", e.target.value)}
                />
              </Label>
              <Label label="Origen de los costos">
                <select
                  className={field}
                  value={draft.costsOrigin}
                  onChange={(e) =>
                    update("costsOrigin", e.target.value as PricingQuoteDraft["costsOrigin"])
                  }
                >
                  {Object.entries(originLabels).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Label>
            </div>
            <Label label="Descripción del alcance">
              <textarea
                className={field}
                rows={3}
                value={draft.description}
                onChange={(e) => update("description", e.target.value)}
              />
            </Label>
          </Section>
          <Section title="Ubicación y modalidad">
            <div className="grid gap-3 sm:grid-cols-2">
              <Label label="Modalidad">
                <select
                  className={field}
                  value={draft.mode}
                  onChange={(e) => update("mode", e.target.value as PricingQuoteDraft["mode"])}
                >
                  {Object.entries(modeLabels).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Label>
              <Label label="Días de desplazamiento">
                <input
                  className={field}
                  inputMode="decimal"
                  value={draft.travelDays}
                  onChange={(e) => update("travelDays", e.target.value)}
                />
              </Label>
              <PricingLocationFields
                value={{
                  country: draft.ownCountry,
                  department: draft.ownDepartment,
                  municipality: draft.ownMunicipality,
                }}
                places={view.geography.places}
                labels={["Mi país", "Mi departamento", "Mi municipio"]}
                onChange={(location) =>
                  setDraft((d) => ({
                    ...d,
                    ownCountry: location.country,
                    ownDepartment: location.department,
                    ownMunicipality: location.municipality,
                  }))
                }
              />
            </div>
            <p className="text-xs text-neutral-500">
              En remoto, la región ajusta el mercado y el ingreso estimado. En presencial o híbrido,
              los viáticos se suman al piso.
            </p>
          </Section>
          <Section title="Comparables y evidencia">
            <p className="text-sm text-neutral-500">
              La revisión consulta el servicio, alcance y unidad elegidos. Incluye los parámetros
              vigentes y explica los datos ausentes.
            </p>
            <button
              className={button}
              disabled={pending || calculationProblems.length > 0}
              onClick={() =>
                startTransition(async () => {
                  try {
                    const r = await previewQuoteAction(draft);
                    if (r.ok) setPreview({ key: calculationKey, snapshot: r.snapshot });
                    else setOutcome(r);
                  } catch {
                    setOutcome({
                      ok: false,
                      message: "No se pudo revisar la cotización. Inténtalo de nuevo.",
                    });
                  }
                })
              }
            >
              {pending ? "Revisando…" : "Revisar cálculo y comparables"}
            </button>
            {snapshot?.marketEvidence.map((q) => (
              <p key={q.id} className="text-xs text-neutral-500">
                {q.source}, {q.date}: {pricingMoney(q.price)} → {pricingMoney(q.adjusted)},{" "}
                {originLabels[q.origin]}.
              </p>
            ))}
          </Section>
        </div>
        <aside
          className="flex min-w-0 flex-col gap-5 rounded-lg border border-neutral-700 p-4 sm:p-5 xl:sticky xl:top-20 xl:max-h-[calc(100dvh-6rem)] xl:overflow-y-auto"
          aria-label="Resultado de precios"
        >
          {result ? (
            <PricingResult result={result} snapshot={snapshot} />
          ) : (
            <p className="text-sm text-neutral-500">
              Elige cliente y servicio para calcular tu piso y una referencia inicial.
            </p>
          )}
          {local && !snapshot ? (
            <p className="text-xs text-neutral-500">
              Vista inicial con costos. Pulsa «Revisar cálculo y comparables» para incorporar toda
              la evidencia.
            </p>
          ) : null}
          <Label label="Precio final editable, COP">
            <input
              className={field}
              inputMode="decimal"
              value={draft.final}
              placeholder={grouped(result?.suggested ?? null)}
              onChange={(e) => update("final", e.target.value)}
            />
          </Label>
          {result ? (
            <p className="text-xs text-neutral-500">
              Tarifa final efectiva:{" "}
              {pricingMoney(
                (parseNumber(draft.final) ?? result.suggested) / (parseNumber(draft.hours) ?? 1),
              )}{" "}
              / hora.{" "}
              {parseNumber(draft.final) !== null && (parseNumber(draft.final) ?? 0) < result.floor
                ? "El precio final elegido queda por debajo de tus costos."
                : ""}
            </p>
          ) : null}
          <Label label="Vigencia">
            <DateField
              value={draft.validUntil}
              onChange={(v) => update("validUntil", v)}
              label="Vigencia de cotización"
            />
          </Label>
          {problems.length ? (
            <p className="text-xs text-neutral-500">{problems.join(" ")}</p>
          ) : null}
          <button
            className={primary}
            disabled={pending || problems.length > 0 || !snapshot}
            onClick={() =>
              run(
                () => saveQuoteAction(draft, snapshot?.result.suggested),
                () => setSavedKey(key),
              )
            }
          >
            {pending ? "Guardando…" : "Guardar cotización"}
          </button>
          <Link href="/precios/cotizaciones" className="text-xs text-neutral-500 underline">
            Ver cotizaciones guardadas
          </Link>
        </aside>
      </div>
      <Toast result={outcome} onDismiss={() => setOutcome(null)} />
    </div>
  );
}
