"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveMarketQuoteAction,
  deleteMarketQuoteAction,
} from "@/app/(panel)/precios/mercado/actions";
import type { PricingMarketView } from "@/lib/pricing";
import {
  grouped,
  modeLabels,
  originLabels,
  pricingMoney,
  scopeLabels,
  unitLabels,
} from "@/lib/pricing-draft";
import {
  emptyMarketQuote,
  marketRegionComparison,
  marketSelectionForService,
  marketSelectionOptions,
  marketQuoteProblems,
  marketSourceLabels,
  type MarketSelection,
  type MarketQuoteDraft,
} from "@/lib/pricing-market";
import { filterList, type ListFilters as Filters } from "@/lib/list-filters";
import { isDirty, useUnsavedChanges } from "@/lib/use-unsaved";
import DateField from "./DateField";
import ListFilters from "./ListFilters";
import { Pager, usePage } from "./Pager";
import Toast, { type ToastResult } from "./Toast";
import PricingTabs from "./PricingTabs";
import PricingLocationFields from "./PricingLocationFields";
import {
  PricingLabel as Label,
  PricingSection as Section,
  pricingField as field,
  pricingButton as button,
  pricingPrimary as primary,
} from "./PricingFields";

export default function PricingMarket({
  view,
  filters,
  selection,
}: {
  view: PricingMarketView;
  filters: Filters;
  selection: MarketSelection;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<MarketQuoteDraft | null>(null);
  const [outcome, setOutcome] = useState<ToastResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [comparisonDraft, setComparisonDraft] = useState(selection);
  const [comparing, startComparison] = useTransition();
  useUnsavedChanges(draft !== null && isDirty(emptyMarketQuote(), draft));
  const filtered = filterList(view.quotes, filters, (q) => ({
    title: `${q.description} ${q.provider} ${q.serviceName}`,
    handle: q.id,
    status: q.origin,
    date: q.date,
  }));
  const page = usePage(filtered, 20);
  const comparison = marketRegionComparison(
    view.quotes,
    {
      ...selection,
      today: view.today,
      maxMonths: view.parameters.quoteMaxMonths,
      outlierMultiplier: view.parameters.outlierMultiplier,
    },
    view.trm,
  );
  const combinations = marketSelectionOptions(view.quotes, selection.serviceId);
  function compare(next: MarketSelection) {
    const params = new URLSearchParams(window.location.search);
    for (const key of ["serviceId", "scope", "unit", "mode"] as const) params.set(key, next[key]);
    startComparison(() => router.push(`/precios/mercado?${params}`, { scroll: false }));
  }
  function update<K extends keyof MarketQuoteDraft>(k: K, v: MarketQuoteDraft[K]) {
    setDraft((d) => (d ? { ...d, [k]: v } : d));
  }
  return (
    <div className="flex flex-col gap-6">
      <PricingTabs current="market" />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Mercado</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Cotizaciones comparables y precios por región. Las propias aceptadas aparecen como
            referencias observadas.
          </p>
        </div>
        <button
          className={button}
          onClick={() => setDraft({ ...emptyMarketQuote(), ...selection })}
        >
          Añadir referencia
        </button>
      </header>
      <Section title="Comparar regiones">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            compare(comparisonDraft);
          }}
        >
          <fieldset disabled={comparing} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Label label="Servicio a comparar">
              <select
                className={field}
                value={comparisonDraft.serviceId}
                onChange={(e) =>
                  setComparisonDraft(
                    marketSelectionForService(
                      e.target.value,
                      view.services,
                      view.quotes,
                      comparisonDraft,
                    ),
                  )
                }
              >
                <option value="">Selecciona un servicio</option>
                {view.services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Label>
            {(
              [
                ["scope", "Alcance a comparar", scopeLabels],
                ["unit", "Unidad a comparar", unitLabels],
                ["mode", "Modalidad a comparar", modeLabels],
              ] as const
            ).map(([k, label, choices]) => (
              <Label key={k} label={label}>
                <select
                  className={field}
                  value={comparisonDraft[k]}
                  onChange={(e) => setComparisonDraft((d) => ({ ...d, [k]: e.target.value }))}
                >
                  {Object.entries(choices).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Label>
            ))}
          </fieldset>
          <button
            className={`${primary} mt-3`}
            type="submit"
            disabled={comparing || !comparisonDraft.serviceId}
          >
            {comparing ? "Comparando…" : "Comparar regiones"}
          </button>
        </form>
        <p className="text-xs text-neutral-500">
          Mismo servicio, alcance, unidad y modalidad para esta tabla. Precios en COP
          {view.trm
            ? `, USD convertido con TRM ${grouped(view.trm.value)} del ${view.trm.date}`
            : "; sin TRM, no se incluye USD"}
          . EUR queda separado por falta de tasa oficial. Se muestran precios registrados, sin
          ajuste por factor regional; se usa la ubicación del cliente cuando está registrada.
        </p>
        {!comparison.groups.length ? (
          <div className="flex flex-col gap-2 text-sm text-neutral-500">
            <p>
              {!selection.serviceId
                ? "Selecciona un servicio y pulsa Comparar regiones."
                : combinations.length
                  ? "No hay precios comparables para los filtros aplicados. Revisa el alcance, la unidad, la modalidad y los avisos de fecha o moneda."
                  : "Este servicio todavía no tiene referencias de mercado. Añade una referencia para compararlo."}
            </p>
            {combinations.length ? (
              <div className="flex flex-wrap gap-2">
                {combinations.map((option) => (
                  <button
                    key={`${option.scope}:${option.unit}:${option.mode}`}
                    className={button}
                    disabled={comparing}
                    onClick={() => compare(option)}
                  >
                    Ver {scopeLabels[option.scope]} · {unitLabels[option.unit]} ·{" "}
                    {modeLabels[option.mode]} ({option.count})
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <p className="text-sm text-neutral-500" role="status">
              {comparison.count}{" "}
              {comparison.count === 1 ? "referencia comparable" : "referencias comparables"} en{" "}
              {comparison.groups.length} {comparison.groups.length === 1 ? "región" : "regiones"}.
              {comparison.groups.length === 1
                ? " Solo hay precios para esta región; añade referencias de otra región para contrastarlas."
                : ""}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[38rem] text-left text-xs">
                <thead className="text-neutral-500">
                  <tr>
                    <th className="py-2">Región</th>
                    <th className="px-2 py-2 whitespace-nowrap">Cantidad</th>
                    <th className="px-2 py-2 whitespace-nowrap">Promedio</th>
                    <th className="px-2 py-2 whitespace-nowrap">Mínimo</th>
                    <th className="px-2 py-2 whitespace-nowrap">Máximo</th>
                    <th className="px-2 py-2 whitespace-nowrap">Mediana</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.groups.map((stats) => (
                    <tr key={stats.key} className="border-t border-neutral-800">
                      <td className="py-3 pr-3">{stats.label}</td>
                      <td className="px-2">{stats.count}</td>
                      <td className="pr-3">{pricingMoney(stats.mean!)}</td>
                      <td className="pr-3">{pricingMoney(stats.minimum!)}</td>
                      <td className="pr-3">{pricingMoney(stats.maximum!)}</td>
                      <td>
                        {pricingMoney(stats.median!)}
                        {stats.outlier ? " (atípico)" : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <details>
          <summary className="cursor-pointer text-xs text-neutral-400">
            Avisos de comparabilidad
          </summary>
          {comparison.notes.length === 0 ? (
            <p className="mt-2 text-xs text-neutral-500">
              No hay avisos para los filtros aplicados.
            </p>
          ) : null}
          {comparison.notes.map((n, i) => (
            <p key={i} className="mt-2 text-xs text-neutral-500">
              {n}
            </p>
          ))}
        </details>
      </Section>
      {draft ? (
        <Section title={draft.id ? "Editar referencia" : "Nueva referencia"}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Label label="Servicio de referencia">
              <select
                className={field}
                value={draft.serviceId}
                onChange={(e) => update("serviceId", e.target.value)}
              >
                <option value="">Selecciona</option>
                {view.services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Label>
            {(
              [
                ["scope", "Nivel de alcance", scopeLabels],
                ["unit", "Unidad", unitLabels],
                ["mode", "Modalidad de referencia", modeLabels],
                ["source", "Fuente de referencia", marketSourceLabels],
                ["origin", "Origen del precio", originLabels],
              ] as const
            ).map(([k, label, choices]) => (
              <Label key={k} label={label}>
                <select
                  className={field}
                  value={draft[k]}
                  onChange={(e) => update(k, e.target.value as MarketQuoteDraft[typeof k])}
                >
                  {Object.entries(choices).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Label>
            ))}
            {(
              [
                ["description", "Descripción del alcance"],
                ["price", "Precio de referencia"],
                ["provider", "Proveedor"],
                ["url", "Enlace de la fuente"],
              ] as const
            ).map(([k, label]) => (
              <Label key={k} label={label}>
                <input
                  className={field}
                  value={draft[k]}
                  onChange={(e) => update(k, e.target.value)}
                />
              </Label>
            ))}
            <PricingLocationFields
              value={draft}
              places={view.geography.places}
              labels={[
                "País del proveedor",
                "Departamento del proveedor",
                "Municipio del proveedor",
              ]}
              onChange={(location) => setDraft((d) => (d ? { ...d, ...location } : d))}
            />
            <PricingLocationFields
              value={{
                country: draft.clientCountry,
                department: draft.clientDepartment,
                municipality: draft.clientMunicipality,
              }}
              places={view.geography.places}
              labels={[
                "País del cliente (si se conoce)",
                "Departamento del cliente",
                "Municipio del cliente",
              ]}
              onChange={(location) =>
                setDraft((d) =>
                  d
                    ? {
                        ...d,
                        clientCountry: location.country,
                        clientDepartment: location.department,
                        clientMunicipality: location.municipality,
                      }
                    : d,
                )
              }
            />
            <Label label="Moneda de referencia">
              <select
                className={field}
                value={draft.currency}
                onChange={(e) => update("currency", e.target.value as MarketQuoteDraft["currency"])}
              >
                {["COP", "USD", "EUR"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Label>
            <Label label="Fecha de referencia">
              <DateField
                value={draft.date}
                onChange={(v) => update("date", v)}
                label="Fecha de referencia"
              />
            </Label>
          </div>
          {marketQuoteProblems(draft).length ? (
            <p className="text-xs text-neutral-500">{marketQuoteProblems(draft).join(" ")}</p>
          ) : null}
          <div className="flex gap-2">
            <button
              className={primary}
              disabled={pending || marketQuoteProblems(draft).length > 0}
              onClick={() =>
                startTransition(async () => {
                  try {
                    const result = await saveMarketQuoteAction(draft);
                    setOutcome(result);
                    if (result.ok) {
                      setDraft(null);
                      router.refresh();
                    }
                  } catch {
                    setOutcome({
                      ok: false,
                      message:
                        "No se pudo guardar la referencia. Revisa los datos e inténtalo de nuevo.",
                    });
                  }
                })
              }
            >
              Guardar referencia
            </button>
            <button className={button} onClick={() => setDraft(null)}>
              Cancelar referencia
            </button>
          </div>
        </Section>
      ) : null}
      <ListFilters
        base="/precios/mercado"
        filters={filters}
        extraParams={selection}
        statuses={Object.entries(originLabels)
          .filter(([v]) => v !== "missing")
          .map(([value, label]) => ({ value, label }))}
        total={view.quotes.length}
        shown={filtered.length}
      />
      {page.rows.map((q) => (
        <article
          key={q.id}
          className="flex min-w-0 flex-wrap items-start justify-between gap-3 rounded-lg border border-neutral-800 p-4"
        >
          <div className="min-w-0 basis-full sm:basis-64 sm:flex-1">
            <h2 className="break-words text-sm font-medium">{q.description}</h2>
            <p className="mt-1 text-xs text-neutral-500">
              {q.serviceName}, {scopeLabels[q.scope]}, {unitLabels[q.unit]}, {modeLabels[q.mode]}.{" "}
              {q.provider}, {[q.country, q.department, q.municipality].filter(Boolean).join(", ")}.
            </p>
            <p className="mt-2 text-sm">
              {pricingMoney(q.price, q.currency)}{" "}
              <span className="text-xs text-neutral-500">
                ({originLabels[q.origin]}, {marketSourceLabels[q.source]}, {q.date})
              </span>
            </p>
            {q.url ? (
              <a
                href={q.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-neutral-400 underline"
              >
                Ver fuente
              </a>
            ) : null}
          </div>
          {q.own ? (
            <span className="text-xs text-neutral-500">Cotización aceptada</span>
          ) : (
            <button
              className={button}
              onClick={() =>
                setDraft({
                  ...q,
                  price: grouped(q.price),
                  clientCountry: q.clientCountry ?? "",
                  clientDepartment: q.clientDepartment ?? "",
                  clientMunicipality: q.clientMunicipality ?? "",
                  url: q.url ?? "",
                })
              }
            >
              Editar referencia
            </button>
          )}
          {!q.own ? (
            <button
              className={button}
              disabled={pending}
              onClick={() => {
                if (
                  !confirm(
                    `¿Mover esta referencia a la papelera? Puede restaurarse durante 30 días.`,
                  )
                )
                  return;
                startTransition(async () => {
                  try {
                    const result = await deleteMarketQuoteAction(q.id);
                    setOutcome(result);
                    if (result.ok) router.refresh();
                  } catch {
                    setOutcome({
                      ok: false,
                      message: "No se pudo mover la referencia a la papelera.",
                    });
                  }
                });
              }}
            >
              Mover referencia a la papelera
            </button>
          ) : null}
        </article>
      ))}
      {!filtered.length ? (
        <p className="text-sm text-neutral-500">No hay referencias en esta vista.</p>
      ) : null}
      <Pager {...page} shown={page.rows.length} label="referencias" onPage={page.setPage} />
      <Toast result={outcome} onDismiss={() => setOutcome(null)} />
    </div>
  );
}
