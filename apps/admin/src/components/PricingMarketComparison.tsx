"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PricingMarketView } from "@/lib/pricing";
import {
  marketComparisonOverview,
  marketMunicipalityOptions,
  type MarketComparisonFilters,
} from "@/lib/pricing-comparison";
import {
  modeLabels,
  scopeLabels,
  unitLabels,
  originLabels,
  pricingMoney,
  grouped,
} from "@/lib/pricing-draft";
import { marketSourceLabels } from "@/lib/pricing-market";
import { pricingMapDepartments } from "@/lib/pricing-map";
import PricingRegionMap from "./PricingRegionMap";
import {
  PricingSection,
  PricingLabel,
  pricingField,
  pricingPrimary,
  pricingButton,
} from "./PricingFields";

export default function PricingMarketComparison({
  view,
  filters,
}: {
  view: PricingMarketView;
  filters: MarketComparisonFilters;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(filters);
  const [pending, startTransition] = useTransition();
  const comparison = useMemo(
    () =>
      marketComparisonOverview(
        view.quotes,
        filters,
        {
          today: view.today,
          maxMonths: view.parameters.quoteMaxMonths,
          outlierMultiplier: view.parameters.outlierMultiplier,
        },
        view.trm,
        view.geography.places,
      ),
    [view, filters],
  );
  const names = new Map(view.services.map((s) => [s.id, s.name]));
  const coverage = useMemo(
    () =>
      marketComparisonOverview(
        view.quotes,
        draft,
        {
          today: view.today,
          maxMonths: view.parameters.quoteMaxMonths,
          outlierMultiplier: view.parameters.outlierMultiplier,
        },
        view.trm,
        view.geography.places,
      ),
    [view, draft],
  );
  const unapplied = JSON.stringify(draft) !== JSON.stringify(filters);
  const municipalities = marketMunicipalityOptions(
    coverage.allRows,
    filters.departmentCode,
    view.geography.places,
  );
  const scopes = ["basic", "standard", "advanced"];
  const units = ["project", "monthly", "hour"];
  const modes = ["remote", "onsite", "hybrid"];
  const rows = [...comparison.rows].sort(
    (a, b) =>
      (names.get(a.serviceId) ?? "").localeCompare(names.get(b.serviceId) ?? "", "es") ||
      scopes.indexOf(a.scope) - scopes.indexOf(b.scope) ||
      units.indexOf(a.unit) - units.indexOf(b.unit) ||
      modes.indexOf(a.mode) - modes.indexOf(b.mode) ||
      a.label.localeCompare(b.label, "es"),
  );
  const mapEntries = Object.fromEntries(
    pricingMapDepartments(view.geography.places).map((d) => {
      const count = coverage.allRows
        .filter((r) => r.departmentCode === d.code)
        .reduce((n, r) => n + r.count, 0);
      return [
        d.code,
        {
          available: count > 0,
          optionLabel: `${count} ${count === 1 ? "comparable" : "comparables"}`,
          detail: count
            ? `${count} ${count === 1 ? "referencia local" : "referencias locales"} para los filtros aplicados`
            : "Sin precios locales para los filtros aplicados",
        },
      ];
    }),
  );
  function compare(next: MarketComparisonFilters) {
    const params = new URLSearchParams(window.location.search);
    for (const key of [
      "serviceId",
      "scope",
      "unit",
      "mode",
      "departmentCode",
      "municipalityCode",
    ] as const) {
      if (next[key]) params.set(key, next[key]);
      else params.delete(key);
    }
    startTransition(() => router.push(`/precios/mercado?${params}`, { scroll: false }));
  }
  return (
    <PricingSection title="Comparar regiones">
      <p className="max-w-prose text-sm text-neutral-500">
        Consulta todas las formas de contratar o elige una combinación. Cada servicio, alcance,
        unidad y modalidad conserva sus propios precios y fuentes.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          compare(draft);
        }}
      >
        <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <PricingLabel label="Servicio a comparar">
            <select
              className={pricingField}
              value={draft.serviceId}
              onChange={(e) =>
                setDraft((d) => ({ ...d, serviceId: e.target.value, municipalityCode: "" }))
              }
            >
              <option value="all">Todos los servicios</option>
              {view.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </PricingLabel>
          <PricingLabel label="Alcance a comparar">
            <select
              className={pricingField}
              value={draft.scope}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  scope: e.target.value as MarketComparisonFilters["scope"],
                  municipalityCode: "",
                }))
              }
            >
              <option value="all">Todos los alcances</option>
              {Object.entries(scopeLabels).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </PricingLabel>
          <PricingLabel label="Unidad a comparar">
            <select
              className={pricingField}
              value={draft.unit}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  unit: e.target.value as MarketComparisonFilters["unit"],
                  municipalityCode: "",
                }))
              }
            >
              <option value="all">Todas las unidades</option>
              {Object.entries(unitLabels).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </PricingLabel>
          <PricingLabel label="Modalidad a comparar">
            <select
              className={pricingField}
              value={draft.mode}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  mode: e.target.value as MarketComparisonFilters["mode"],
                  municipalityCode: "",
                }))
              }
            >
              <option value="all">Todas las modalidades</option>
              {Object.entries(modeLabels).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </PricingLabel>
        </fieldset>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className={pricingPrimary} disabled={pending} type="submit">
            {pending ? "Comparando…" : "Comparar regiones"}
          </button>
          <button
            className={pricingButton}
            disabled={pending}
            type="button"
            onClick={() => {
              const all: MarketComparisonFilters = {
                serviceId: "all",
                scope: "all",
                unit: "all",
                mode: "all",
                departmentCode: "",
                municipalityCode: "",
              };
              setDraft(all);
              compare(all);
            }}
          >
            Mostrar todo
          </button>
        </div>
        {unapplied ? (
          <p className="mt-2 text-xs text-neutral-500" role="status">
            Las zonas disponibles ya reflejan tu selección. Pulsa Comparar regiones para actualizar
            los resultados, o elige una zona para aplicar todo.
          </p>
        ) : null}
      </form>
      <details className="text-sm text-neutral-500">
        <summary className="cursor-pointer underline">Cómo leer esta comparación</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <p>
            <strong className="text-neutral-300">Alcance:</strong> básico, estándar y avanzado son
            etiquetas comerciales. Abre las fuentes para comprobar pantallas, funciones, horas,
            revisiones y soporte; dos etiquetas iguales pueden tener entregables distintos.
          </p>
          <p>
            <strong className="text-neutral-300">Unidad y modalidad:</strong> un proyecto, una
            mensualidad y una hora se muestran por separado. Lo mismo ocurre con trabajo remoto,
            presencial e híbrido.
          </p>
          <p>
            <strong className="text-neutral-300">Promedio y mediana:</strong> el promedio reparte el
            total entre las referencias; la mediana es el valor central ordenado. Una sola
            referencia describe una oferta, no todo el mercado.
          </p>
          <p>
            <strong className="text-neutral-300">Región:</strong> se usa la ubicación del cliente si
            está registrada; de lo contrario, la del proveedor. Una oferta nacional no se convierte
            en un precio de cada municipio.
          </p>
        </div>
      </details>
      <PricingRegionMap
        places={view.geography.places}
        selectedCode={filters.departmentCode}
        title="Mapa de precios registrados"
        entries={mapEntries}
        disabled={pending}
        selectorLabel="Zona a comparar"
        coverageLabel="datos comparables"
        showShortcuts
        municipality={{
          value: draft.municipalityCode,
          options: municipalities,
          selectedLabel: view.geography.places.find((p) => p.code === draft.municipalityCode)
            ?.municipality,
          label: "Municipio a comparar",
          emptyText:
            "No hay municipios con comparables en este departamento para las condiciones elegidas. Puedes consultar las referencias departamentales o nacionales.",
          onChange: (municipalityCode) => {
            const next = { ...draft, municipalityCode };
            setDraft(next);
            compare(next);
          },
        }}
        extraZones={[
          {
            value: "national",
            label: `Colombia, referencias nacionales (${coverage.nationalCount})`,
            available: coverage.nationalCount > 0,
            detail: `${coverage.nationalCount} referencias nacionales para los filtros elegidos. Sus precios no se asignan a un departamento concreto.`,
          },
        ]}
        onSelect={(departmentCode) => {
          const next = { ...draft, departmentCode, municipalityCode: "" };
          setDraft(next);
          compare(next);
        }}
      />
      <p className="text-xs text-neutral-500">
        Las referencias nacionales también están en Zona a comparar. El color del mapa indica
        cobertura local para los filtros elegidos, no una tarifa promedio.
      </p>
      <p className="text-xs text-neutral-500">
        Importes en COP, sin ajustar por factor regional.
        {view.trm
          ? ` USD convertido con TRM ${grouped(view.trm.value)} del ${view.trm.date}.`
          : " Sin TRM no se incluyen USD."}{" "}
        EUR queda separado por falta de tasa oficial.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Resultados por servicio y condiciones</h3>
        <p className="text-xs text-neutral-500" role="status">
          {comparison.count} referencias en {comparison.rows.length} grupos.{" "}
          {comparison.excluded ? `${comparison.excluded} sin incluir por fecha o moneda.` : ""}
        </p>
      </div>
      {!comparison.rows.length ? (
        <div className="flex flex-col gap-3 rounded border border-neutral-800 p-3">
          <p className="text-sm text-neutral-500">
            No hay referencias para esta selección. Consulta las zonas con comparables en el
            selector o amplía las condiciones.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              className={pricingButton}
              disabled={pending}
              onClick={() => {
                const next: MarketComparisonFilters = {
                  ...filters,
                  scope: "all",
                  unit: "all",
                  mode: "all",
                  departmentCode: "",
                  municipalityCode: "",
                };
                setDraft(next);
                compare(next);
              }}
            >
              Ver otras condiciones de este servicio
            </button>
            {comparison.nationalCount > 0 && filters.departmentCode !== "national" ? (
              <button
                className={pricingButton}
                disabled={pending}
                onClick={() => {
                  const next = { ...filters, departmentCode: "national", municipalityCode: "" };
                  setDraft(next);
                  compare(next);
                }}
              >
                Consultar referencias nacionales ({comparison.nationalCount})
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <div
        className="flex flex-col divide-y divide-neutral-800"
        aria-label="Resultados de comparación regional"
      >
        {rows.map((row) => (
          <details key={row.key} className="py-4">
            <summary className="grid cursor-pointer gap-3 rounded p-1 outline-offset-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
              <span className="min-w-0">
                <strong className="block break-words text-sm">
                  {names.get(row.serviceId) ?? "Servicio"}
                </strong>
                <span className="mt-1 block text-xs text-neutral-500">
                  {scopeLabels[row.scope]}, {unitLabels[row.unit]}, {modeLabels[row.mode]}
                </span>
              </span>
              <span className="text-xs">
                <span className="block">{row.label}</span>
                <span className="mt-1 block text-neutral-500">
                  {row.count} {row.count === 1 ? "referencia" : "referencias"}, {row.providers}{" "}
                  {row.providers === 1 ? "proveedor" : "proveedores"}
                </span>
              </span>
              <span className="text-xs">
                <span className="block tabular-nums">
                  {pricingMoney(row.minimum!)} a {pricingMoney(row.maximum!)}
                </span>
                <span className="mt-1 block text-neutral-500">
                  Mediana {pricingMoney(row.median!)}
                  {row.outlier ? ", valor atípico" : ""}
                </span>
                <span className="mt-1 block underline">Ver fuentes y entregables</span>
              </span>
            </summary>
            <div className="mt-3 flex flex-col gap-3 border-l-2 border-teal-700 pl-3">
              <p className="text-xs text-neutral-500">
                Promedio {pricingMoney(row.mean!)}. Estos importes corresponden únicamente a esta
                combinación y región.
              </p>
              {row.quotes.map((q) => (
                <article key={q.id} className="min-w-0 text-xs">
                  <p className="font-medium">
                    {q.provider}: {pricingMoney(q.price, q.currency)}
                  </p>
                  <p className="mt-1 text-neutral-500">
                    {marketSourceLabels[q.source]}, {originLabels[q.origin]}, {q.date}.
                  </p>
                  <p className="mt-1 max-w-prose break-words text-neutral-500">{q.description}</p>
                  {q.url ? (
                    <a
                      className="mt-1 inline-block underline"
                      href={q.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir fuente de {q.provider}
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          </details>
        ))}
      </div>
      <details className="text-xs text-neutral-500">
        <summary className="cursor-pointer underline">Avisos de fecha y moneda</summary>
        {comparison.notes.length ? (
          comparison.notes.map((note) => (
            <p key={note} className="mt-2">
              {note}
            </p>
          ))
        ) : (
          <p className="mt-2">No hay avisos para las combinaciones seleccionadas.</p>
        )}
      </details>
    </PricingSection>
  );
}
