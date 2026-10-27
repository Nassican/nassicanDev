"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PricingMode, PricingScope, PricingUnit } from "@nassican/shared";
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
  marketComparables,
  marketLocation,
  marketQuoteProblems,
  marketSourceLabels,
  marketStats,
  type MarketQuoteDraft,
} from "@/lib/pricing-market";
import { filterList, type ListFilters as Filters } from "@/lib/list-filters";
import { isDirty, useUnsavedChanges } from "@/lib/use-unsaved";
import { scaleMoney } from "@/lib/pricing-engine";
import { resolveRegionFactor } from "@/lib/pricing-geography";
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

export type MarketSelection = {
  serviceId: string;
  scope: PricingScope;
  unit: PricingUnit;
  mode: PricingMode;
};
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
  useUnsavedChanges(draft !== null && isDirty(emptyMarketQuote(), draft));
  const filtered = filterList(view.quotes, filters, (q) => ({
    title: `${q.description} ${q.provider} ${q.serviceName}`,
    handle: q.id,
    status: q.origin,
    date: q.date,
  }));
  const page = usePage(filtered, 20);
  const comparables = marketComparables(
    view.quotes,
    {
      ...selection,
      location: { country: "Colombia", department: "", municipality: "" },
      today: view.today,
      maxMonths: view.parameters.quoteMaxMonths,
      outlierMultiplier: view.parameters.outlierMultiplier,
    },
    view.trm,
    resolveRegionFactor(view.geography.factors),
  );
  const byRegion = new Map<string, number[]>();
  for (const q of view.quotes) {
    if (
      q.serviceId !== selection.serviceId ||
      q.scope !== selection.scope ||
      q.unit !== selection.unit ||
      q.mode !== selection.mode
    )
      continue;
    const cop =
      q.currency === "COP"
        ? q.price
        : q.currency === "USD" && view.trm
          ? scaleMoney(q.price, view.trm.value)
          : null;
    if (cop === null) continue;
    const loc = marketLocation(q);
    const key = [loc.country, loc.department, loc.municipality].filter(Boolean).join(", ");
    byRegion.set(key, [...(byRegion.get(key) ?? []), cop]);
  }
  function selectSelection(k: keyof MarketSelection, value: string) {
    const params = new URLSearchParams(window.location.search);
    params.set(k, value);
    router.push(`/precios/mercado?${params}`);
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
          onClick={() => setDraft({ ...emptyMarketQuote(), serviceId: selection.serviceId })}
        >
          Añadir referencia
        </button>
      </header>
      <Section title="Comparar regiones">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Label label="Servicio a comparar">
            <select
              className={field}
              value={selection.serviceId}
              onChange={(e) => selectSelection("serviceId", e.target.value)}
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
                value={selection[k]}
                onChange={(e) => selectSelection(k, e.target.value)}
              >
                {Object.entries(choices).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Label>
          ))}
        </div>
        <p className="text-xs text-neutral-500">
          Mismo servicio, alcance, unidad y modalidad para esta tabla. Precios en COP
          {view.trm
            ? `, USD convertido con TRM ${grouped(view.trm.value)} del ${view.trm.date}`
            : "; sin TRM, no se incluye USD"}
          . EUR queda separado por falta de tasa oficial.
        </p>
        {!byRegion.size ? (
          <p className="text-sm text-neutral-500">
            Añade referencias para comparar regiones de este servicio.
          </p>
        ) : (
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
                {[...byRegion].map(([region, prices]) => {
                  const stats = marketStats(prices, view.parameters.outlierMultiplier);
                  return (
                    <tr key={region} className="border-t border-neutral-800">
                      <td className="py-3 pr-3">{region}</td>
                      <td className="px-2">{stats.count}</td>
                      <td className="pr-3">{pricingMoney(stats.mean!)}</td>
                      <td className="pr-3">{pricingMoney(stats.minimum!)}</td>
                      <td className="pr-3">{pricingMoney(stats.maximum!)}</td>
                      <td>
                        {stats.outlier
                          ? `${pricingMoney(stats.median!)} (atípico)`
                          : "Sin atípicos"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <details>
          <summary className="cursor-pointer text-xs text-neutral-400">
            Avisos de comparabilidad
          </summary>
          {[...comparables.notes, ...comparables.explanation].map((n, i) => (
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
