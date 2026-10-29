"use client";

import PricingNumberInput from "./PricingNumberInput";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PricingLocation, PricingMode, PricingScope, PricingUnit } from "@nassican/shared";
import {
  saveIncomeEstimateAction,
  saveObservedFactorAction,
  saveRegionFactorAction,
} from "@/app/(panel)/precios/regiones/actions";
import type { PricingRegionsView } from "@/lib/pricing";
import {
  emptyIncomeEstimate,
  estimatedRegionalIncome,
  resolveRegionalIncome,
  incomeCityOptions,
  sameIncomeLocation,
  resolveRegionFactor,
  emptyRegionFactor,
  incomeEstimateProblems,
  observedRegionalFactor,
  regionFactorProblems,
  type IncomeEstimateDraft,
  type RegionFactorDraft,
} from "@/lib/pricing-geography";
import { grouped, modeLabels, pricingMoney, scopeLabels, unitLabels } from "@/lib/pricing-draft";
import { isDirty, useUnsavedChanges } from "@/lib/use-unsaved";
import { parseNumber } from "@/lib/draft-fields";
import DateField from "./DateField";
import Toast, { type ToastResult } from "./Toast";
import PricingTabs from "./PricingTabs";
import PricingLocationFields from "./PricingLocationFields";
import PricingRegionMap from "./PricingRegionMap";
import { pricingMapDepartments, pricingDepartmentCode } from "@/lib/pricing-map";
import ListFilters from "./ListFilters";
import { Pager, usePage } from "./Pager";
import { filterList, fold, type ListFilters as Filters } from "@/lib/list-filters";
import {
  PricingLabel as Label,
  PricingSection as Section,
  pricingField as field,
  pricingButton as button,
  pricingPrimary as primary,
} from "./PricingFields";

const regionName = (location: PricingLocation) =>
  [location.country, location.department, location.municipality].filter(Boolean).join(", ");
export default function PricingRegions({
  view,
  filters,
}: {
  view: PricingRegionsView;
  filters: Filters;
}) {
  const router = useRouter();
  const [factor, setFactor] = useState<RegionFactorDraft | null>(null);
  const [income, setIncome] = useState<IncomeEstimateDraft | null>(null);
  const incomeEditor = useRef<HTMLDivElement>(null);
  const incomeCities = useMemo(
    () => incomeCityOptions(view.places, view.incomes),
    [view.places, view.incomes],
  );
  const [incomeLocation, setIncomeLocation] = useState<PricingLocation>(() => {
    const bogota = view.places.find((p) => p.code === "11001");
    return {
      country: "Colombia",
      department: bogota?.department ?? "",
      municipality: bogota?.municipality ?? "",
    };
  });
  const incomeCoverage = Array.from({ length: 7 }, (_, stratum) => ({
    stratum,
    estimate: resolveRegionalIncome(view.incomes, incomeLocation, stratum),
  }));
  const regionalAverage = estimatedRegionalIncome(view.incomes, incomeLocation, null);
  const selectedIncomeCity = incomeCities.find((city) => sameIncomeLocation(city, incomeLocation));
  const incomeMapCode = pricingDepartmentCode(incomeLocation, view.places);
  const displayedIncomeCities =
    fold(incomeLocation.country) === "colombia"
      ? incomeCities.filter((city) => !incomeMapCode || city.departmentCode === incomeMapCode)
      : [];
  const incomeMapEntries = Object.fromEntries(
    pricingMapDepartments(view.places).map((department) => {
      const location = { country: "Colombia", department: department.name, municipality: "" };
      const base = estimatedRegionalIncome(
        view.incomes,
        department.code === incomeMapCode && incomeLocation.municipality
          ? incomeLocation
          : location,
        null,
      );
      return [
        department.code,
        {
          optionLabel: base
            ? base.municipality
              ? "base municipal registrada"
              : base.department
                ? "base departamental"
                : "base nacional heredada"
            : "sin base de ingresos",
          available: view.incomes.some((estimate) =>
            sameIncomeLocation({ ...estimate, municipality: "" }, location),
          ),
          detail: base
            ? `${base.municipality ? `Base municipal de ${base.municipality}` : base.department ? "Base departamental" : "Base nacional heredada"}: ${pricingMoney(base.income)} per cápita/mes (${base.date}). Consulta los estratos y la fuente debajo.`
            : "Sin base de ingresos configurada",
        },
      ];
    }),
  );
  const incomeFactorResolver = resolveRegionFactor(view.factors);
  const [target, setTarget] = useState<PricingLocation>({
    country: "Colombia",
    department: "",
    municipality: "",
  });
  const [reference, setReference] = useState<PricingLocation>({
    country: "Colombia",
    department: "",
    municipality: "",
  });
  const [selection, setSelection] = useState<{
    serviceId: string;
    scope: PricingScope;
    unit: PricingUnit;
    mode: PricingMode;
  }>({ serviceId: view.services[0]?.id ?? "", scope: "standard", unit: "project", mode: "remote" });
  const [outcome, setOutcome] = useState<ToastResult | null>(null);
  const [pending, startTransition] = useTransition();
  useUnsavedChanges(
    (factor !== null && isDirty(emptyRegionFactor(), factor)) ||
      (income !== null && isDirty(emptyIncomeEstimate(), income)),
  );
  const observed = observedRegionalFactor(view.quotes, target, reference, selection, view.trm);
  const filteredFactors = filterList(view.factors, filters, (f) => ({
    title: `${regionName(f)} ${view.services.find((s) => s.id === f.serviceId)?.name ?? "Todos los servicios"} ${modeLabels[f.mode]} ${f.justification}`,
    handle: f.id,
    status: f.origin,
    date: f.date,
  }));
  const filteredIncomes = filterList(view.incomes, filters, (r) => ({
    title: `${regionName(r)} ${r.justification}`,
    handle: r.id,
    status: "manual",
    date: r.date,
  }));
  const factorsPage = usePage(filteredFactors, 12);
  const incomesPage = usePage(filteredIncomes, 12);
  function run(action: () => Promise<ToastResult>, done?: () => void) {
    startTransition(async () => {
      try {
        const result = await action();
        setOutcome(result);
        if (result.ok) {
          done?.();
          router.refresh();
        }
      } catch {
        setOutcome({
          ok: false,
          message: "No se pudo guardar. Revisa la región, la justificación y la fecha.",
        });
      }
    });
  }
  function updateFactor<K extends keyof RegionFactorDraft>(k: K, value: RegionFactorDraft[K]) {
    setFactor((d) => (d ? { ...d, [k]: value } : d));
  }
  function updateIncome<K extends keyof IncomeEstimateDraft>(k: K, value: IncomeEstimateDraft[K]) {
    setIncome((d) =>
      d
        ? k === "stratum"
          ? draftForIncome(d, value.trim() ? parseNumber(value) : null)
          : { ...d, [k]: value }
        : d,
    );
  }
  function draftForIncome(location: PricingLocation, stratum: number | null): IncomeEstimateDraft {
    const existing = estimatedRegionalIncome(view.incomes, location, stratum);
    const local = existing && sameIncomeLocation(existing, location) ? existing : null;
    return {
      ...emptyIncomeEstimate(),
      country: location.country,
      department: location.department,
      municipality: location.municipality,
      stratum: stratum === null ? "" : String(stratum),
      ...(local
        ? {
            id: local.id,
            income: grouped(local.income),
            date: local.date,
            justification: local.justification,
          }
        : {}),
    };
  }
  function openIncome(stratum: number | null = null) {
    setIncome(draftForIncome(incomeLocation, stratum));
    requestAnimationFrame(() =>
      incomeEditor.current?.scrollIntoView({ block: "start", behavior: "smooth" }),
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <PricingTabs current="regions" />
      <header>
        <h1 className="text-xl font-semibold">Regiones</h1>
        <p className="mt-1 max-w-prose text-sm text-neutral-500">
          Los factores se buscan por municipio, departamento y país. Sin evidencia regional, se usa
          1 y se indica que no había datos.
        </p>
        <p className="mt-2 text-xs text-neutral-500">
          Catálogo DIVIPOLA: {view.places.length} lugares.{" "}
          <a
            className="underline"
            href="https://www.datos.gov.co/Mapas-Nacionales/DIVIPOLA-C-digos-municipios/gdxc-w37w"
            target="_blank"
            rel="noreferrer"
          >
            Fuente: DANE
          </a>
          .
        </p>
        <p className="mt-2 max-w-prose text-xs text-neutral-500">
          La base DANE 2025 usa ingreso per cápita de hogares como referencia de presupuesto. El
          factor de precio es un proxy comercial estimado, no una tarifa observada: raíz de la razón
          regional/nacional, limitada entre 0,8 y 1,2. Hereda entre municipio, departamento y país
          para todos los servicios y modalidades.{" "}
          <a
            className="underline"
            href="https://www.dane.gov.co/index.php/estadisticas-por-tema/pobreza-y-condiciones-de-vida/pobreza-monetaria"
            target="_blank"
            rel="noreferrer"
          >
            Estudio y anexos del DANE
          </a>
          .
        </p>
      </header>
      <ListFilters
        base="/precios/regiones"
        filters={filters}
        statuses={[
          { value: "manual", label: "Estimados o manuales" },
          { value: "observed", label: "Observados" },
        ]}
        total={view.factors.length + view.incomes.length}
        shown={filteredFactors.length + filteredIncomes.length}
      />
      <Section title="Factores regionales">
        <button className={button} onClick={() => setFactor(emptyRegionFactor())}>
          Añadir factor manual
        </button>
        {factorsPage.rows.map((f) => (
          <article
            key={f.id}
            className="flex min-w-0 flex-wrap items-start justify-between gap-3 border-b border-neutral-900 pb-3"
          >
            <div className="min-w-0 basis-full sm:basis-64 sm:flex-1">
              <h3 className="break-words text-sm">
                {regionName(f)}: × {grouped(f.factor)}
              </h3>
              <p className="mt-1 text-xs text-neutral-500">
                {f.origin === "observed" ? "Observado" : "Manual, estimado"}, {modeLabels[f.mode]},{" "}
                {view.services.find((s) => s.id === f.serviceId)?.name ?? "todos los servicios"},{" "}
                {f.date}. {f.justification}
              </p>
            </div>
            <button
              className={button}
              onClick={() =>
                setFactor({ ...f, serviceId: f.serviceId ?? "", factor: grouped(f.factor) })
              }
            >
              Editar factor
            </button>
          </article>
        ))}
        <Pager
          {...factorsPage}
          shown={factorsPage.rows.length}
          label="factores"
          onPage={factorsPage.setPage}
        />
        {factor ? (
          <div className="flex flex-col gap-4 rounded border border-neutral-800 p-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <PricingLocationFields
                value={factor}
                places={view.places}
                onChange={(location) => setFactor((d) => (d ? { ...d, ...location } : d))}
                labels={["País del factor", "Departamento del factor", "Municipio del factor"]}
              />
              <Label label="Servicio del factor">
                <select
                  className={field}
                  value={factor.serviceId}
                  onChange={(e) => updateFactor("serviceId", e.target.value)}
                >
                  <option value="">Todos los servicios</option>
                  {view.services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Label>
              <Label label="Modalidad del factor">
                <select
                  className={field}
                  value={factor.mode}
                  onChange={(e) => updateFactor("mode", e.target.value as PricingMode)}
                >
                  {Object.entries(modeLabels).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Label>
              <Label label="Factor manual">
                <PricingNumberInput
                  className={field}
                  inputMode="decimal"
                  value={factor.factor}
                  onChange={(e) => updateFactor("factor", e.target.value)}
                />
              </Label>
              <Label label="Fecha del factor">
                <DateField
                  value={factor.date}
                  onChange={(v) => updateFactor("date", v)}
                  label="Fecha del factor"
                />
              </Label>
            </div>
            <Label label="Justificación del factor">
              <textarea
                className={field}
                value={factor.justification}
                onChange={(e) => updateFactor("justification", e.target.value)}
              />
            </Label>
            <p className="break-words text-xs text-neutral-500">
              Un factor distinto de 1 exige justificación y fecha. Al editar aquí, su origen será
              manual y se mostrará como estimado.
            </p>
            {regionFactorProblems(factor).length ? (
              <p className="text-xs text-amber-300">{regionFactorProblems(factor).join(" ")}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                className={primary}
                disabled={pending || regionFactorProblems(factor).length > 0}
                onClick={() =>
                  run(
                    () => saveRegionFactorAction(factor),
                    () => setFactor(null),
                  )
                }
              >
                Guardar factor manual
              </button>
              <button className={button} onClick={() => setFactor(null)}>
                Cancelar factor
              </button>
            </div>
          </div>
        ) : null}
      </Section>
      <Section title="Factor observado a partir del mercado">
        <p className="break-words text-xs text-neutral-500">
          Mediana regional dividida por la mediana de referencia. Se necesitan al menos tres precios
          observados en cada región, del mismo servicio, alcance, unidad y modalidad; cada
          referencia cuenta una sola vez.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-3">
            <h3 className="text-sm">Región que ajustar</h3>
            <PricingLocationFields
              value={target}
              onChange={setTarget}
              places={view.places}
              labels={["País observado", "Departamento observado", "Municipio observado"]}
            />
          </div>
          <div className="grid gap-3">
            <h3 className="text-sm">Región de referencia</h3>
            <PricingLocationFields
              value={reference}
              onChange={setReference}
              places={view.places}
              labels={[
                "País de referencia",
                "Departamento de referencia",
                "Municipio de referencia",
              ]}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Label label="Servicio observado">
            <select
              className={field}
              value={selection.serviceId}
              onChange={(e) => setSelection((s) => ({ ...s, serviceId: e.target.value }))}
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
              ["scope", "Alcance observado", scopeLabels],
              ["unit", "Unidad observada", unitLabels],
              ["mode", "Modalidad observada", modeLabels],
            ] as const
          ).map(([k, label, choices]) => (
            <Label key={k} label={label}>
              <select
                className={field}
                value={selection[k]}
                onChange={(e) => setSelection((s) => ({ ...s, [k]: e.target.value }))}
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
        <p className="text-sm text-neutral-400">{observed.explanation}</p>
        <button
          className={primary}
          disabled={pending || observed.factor === null || !selection.serviceId}
          onClick={() => run(() => saveObservedFactorAction(target, reference, selection))}
        >
          Guardar factor observado
        </button>
      </Section>
      <Section title="Ingresos estimados por estrato y región">
        <p className="break-words text-xs text-neutral-500">
          Solo se usan si no hay ingreso conocido. Siempre se marcan como estimados. El estrato 0
          significa sin estrato o vivienda informal en este panel. Un promedio regional no es un
          desglose por estrato. Cuando falta un valor registrado, el modelo comercial estima un
          escenario desde la base municipal, departamental o nacional, en ese orden. Las referencias
          per cápita del hogar no son salarios personales ni ingresos verificados.
        </p>
        <PricingRegionMap
          places={view.places}
          selectedCode={incomeMapCode}
          entries={incomeMapEntries}
          title="Mapa de bases de ingresos"
          municipality={{
            value: selectedIncomeCity?.code ?? "",
            options: displayedIncomeCities.map((city) => ({
              value: city.code,
              label: `${city.municipality}: ${city.label}`,
            })),
            label: "Municipio para consultar en el mapa",
            emptyText: "Selecciona un departamento para consultar sus municipios.",
            onChange: (code) => {
              const city = displayedIncomeCities.find((p) => p.code === code);
              setIncomeLocation((location) => ({
                ...location,
                municipality: city?.municipality ?? "",
              }));
            },
          }}
          onSelect={(code) => {
            const place = view.places.find((p) => p.departmentCode === code);
            setIncomeLocation({
              country: "Colombia",
              department: place?.department ?? "",
              municipality: code === "11" ? (place?.municipality ?? "") : "",
            });
          }}
        />
        <p className="text-xs text-neutral-500">
          El mapa muestra cobertura de referencias registradas, no ingresos observados de todos los
          municipios. Selecciona el municipio para distinguir una base local de una heredada y de
          los escenarios comerciales por estrato.
        </p>
        <div
          className="flex flex-wrap gap-3 text-xs text-neutral-500"
          aria-label="Factores generales de la ubicación"
        >
          {(["remote", "onsite", "hybrid"] as const).map((mode) => {
            const factor = incomeFactorResolver(incomeLocation, "", mode);
            return (
              <p key={mode}>
                {modeLabels[mode]}: × {grouped(factor.factor)} ({factor.level},{" "}
                {factor.origin === "observed"
                  ? "observado"
                  : factor.origin === "missing"
                    ? "sin dato, neutro"
                    : "estimado"}
                )
              </p>
            );
          })}
        </div>
        <Label label="Ciudad o municipio para consultar ingresos">
          <select
            className={field}
            value={selectedIncomeCity?.code ?? ""}
            onChange={(e) => {
              const city = incomeCities.find((city) => city.code === e.target.value);
              if (city)
                setIncomeLocation({
                  country: city.country,
                  department: city.department,
                  municipality: city.municipality,
                });
              else setIncomeLocation({ country: "Colombia", department: "", municipality: "" });
            }}
          >
            <option value="">Otra región o municipio</option>
            {displayedIncomeCities.map((city) => (
              <option key={city.code} value={city.code}>
                {city.municipality}, {city.department}: {city.label}
              </option>
            ))}
          </select>
        </Label>
        <p className="text-xs text-neutral-500">
          El catálogo contiene {incomeCities.length} lugares de DIVIPOLA. El selector muestra{" "}
          {displayedIncomeCities.length} opciones de la región elegida. Cambia el departamento para
          consultar sus municipios; cada opción indica las referencias registradas y la base del
          modelo.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <PricingLocationFields
            value={incomeLocation}
            places={view.places}
            onChange={setIncomeLocation}
            labels={[
              "País para consultar ingresos",
              "Departamento para consultar ingresos",
              "Municipio para consultar ingresos",
            ]}
          />
        </div>
        {regionalAverage ? (
          <p className="text-sm text-neutral-400" role="status">
            {sameIncomeLocation(regionalAverage, incomeLocation)
              ? "Promedio de la ciudad"
              : "Referencia general heredada"}
            : {pricingMoney(regionalAverage.income)} / mes ({regionName(regionalAverage)},{" "}
            {regionalAverage.date}). Sin desglose por estrato; sirve de base para los escenarios
            comerciales cuando falta una referencia específica.
          </p>
        ) : (
          <p className="text-xs text-neutral-500">
            No hay promedio regional configurado para esta ubicación.
          </p>
        )}
        <div className="overflow-x-auto">
          <table
            className="w-full min-w-[36rem] text-left text-xs"
            aria-label="Cobertura de ingresos por estrato"
          >
            <thead className="text-neutral-500">
              <tr>
                <th className="py-2 pr-3">Estrato</th>
                <th className="px-2 py-2">Referencia mensual, COP</th>
                <th className="px-2 py-2">Año de la base o referencia</th>
                <th className="px-2 py-2">Región y fuente</th>
                <th className="px-2 py-2">Acción</th>
              </tr>
            </thead>
            <tbody>
              {incomeCoverage.map(({ stratum, estimate }) => (
                <tr key={stratum} className="border-t border-neutral-800 align-top">
                  <th className="py-3 pr-3 font-normal">
                    {stratum === 0 ? "0 · Sin estrato" : stratum}
                  </th>
                  <td className="px-2 py-3 tabular-nums">
                    {estimate ? pricingMoney(estimate.income) : "Sin dato por estrato"}
                  </td>
                  <td className="px-2 py-3">{estimate?.date ?? "—"}</td>
                  <td className="px-2 py-3">
                    {estimate ? (
                      <>
                        <p>
                          {estimate.modeled
                            ? "Estimación del modelo comercial"
                            : "Referencia registrada"}
                        </p>
                        <p>
                          {estimate.baseline
                            ? `Base: ${regionName(estimate.baseline)}`
                            : regionName(estimate)}
                        </p>
                        <details className="mt-1">
                          <summary className="cursor-pointer underline">
                            Fuente y metodología
                          </summary>
                          <p className="mt-2 max-w-prose break-words">{estimate.justification}</p>
                          {estimate.justification.match(/https?:\/\/\S+/)?.[0] ? (
                            <a
                              className="mt-2 block underline"
                              href={estimate.justification.match(/https?:\/\/\S+/)![0]}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Ver fuente
                            </a>
                          ) : null}
                        </details>
                      </>
                    ) : (
                      "No hay una estimación configurada para este estrato y región."
                    )}
                  </td>
                  <td className="px-2 py-3">
                    <button className={button} onClick={() => openIncome(stratum)}>
                      {estimate && !estimate.modeled && sameIncomeLocation(estimate, incomeLocation)
                        ? "Editar valor"
                        : "Ingresar valor"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-neutral-500">
          Bogotá, estratos 1–6: la tabla de SDM usa la Encuesta Multipropósito 2021 y valores de
          referencia de 2024. Las demás celdas sin referencia registrada usan escenarios
          comerciales: base × 0,5; 0,75; 1; 1,5; 2,25; 3 para estratos 1–6, redondeados a $10.000.
          Estos coeficientes son supuestos de presupuesto, no resultados del DANE ni ingresos
          medidos. Estrato 0 usa la base × 1 porque no permite inferir capacidad económica. El año
          mostrado pertenece a la base; no representa ingresos medidos en 2026.
        </p>
        <button className={button} onClick={() => openIncome()}>
          Añadir ingreso estimado
        </button>
        {incomesPage.rows.map((r) => (
          <article
            key={r.id}
            className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-900 pb-3"
          >
            <div className="min-w-0 basis-full sm:basis-64 sm:flex-1">
              <p className="text-sm">
                {regionName(r)},{" "}
                {r.stratum === null
                  ? "promedio regional sin desglose por estrato"
                  : `estrato ${r.stratum}`}
                : {pricingMoney(r.income)} / mes
              </p>
              <p className="break-words text-xs text-neutral-500">
                Estimado, {r.date}. {r.justification}
              </p>
            </div>
            <button
              className={button}
              onClick={() =>
                setIncome({
                  ...r,
                  stratum: r.stratum === null ? "" : String(r.stratum),
                  income: grouped(r.income),
                })
              }
            >
              Editar estimación
            </button>
          </article>
        ))}
        <Pager
          {...incomesPage}
          shown={incomesPage.rows.length}
          label="estimaciones"
          onPage={incomesPage.setPage}
        />
        {income ? (
          <div
            ref={incomeEditor}
            className="flex scroll-mt-20 flex-col gap-4 rounded border border-neutral-800 p-3"
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <PricingLocationFields
                value={income}
                places={view.places}
                onChange={(location) =>
                  setIncome((d) =>
                    d
                      ? draftForIncome(location, d.stratum.trim() ? parseNumber(d.stratum) : null)
                      : d,
                  )
                }
                labels={[
                  "País del ingreso estimado",
                  "Departamento del ingreso estimado",
                  "Municipio del ingreso estimado",
                ]}
              />
              <Label label="Estrato estimado">
                <select
                  className={field}
                  value={income.stratum}
                  onChange={(e) => updateIncome("stratum", e.target.value)}
                >
                  <option value="">Sin desglose, promedio regional</option>
                  {Array.from({ length: 7 }, (_, n) => (
                    <option key={n} value={n}>
                      {n}:{" "}
                      {estimatedRegionalIncome(view.incomes, income, n)
                        ? "con referencia registrada"
                        : resolveRegionalIncome(view.incomes, income, n)
                          ? "modelo disponible"
                          : "sin valor"}
                    </option>
                  ))}
                </select>
              </Label>
              <Label label="Ingreso mensual estimado, COP">
                <PricingNumberInput
                  className={field}
                  inputMode="decimal"
                  value={income.income}
                  onChange={(e) => updateIncome("income", e.target.value)}
                />
              </Label>
              <Label label="Fecha del ingreso estimado">
                <DateField
                  value={income.date}
                  onChange={(v) => updateIncome("date", v)}
                  label="Fecha del ingreso estimado"
                />
              </Label>
            </div>
            <Label label="Justificación del ingreso estimado">
              <textarea
                className={field}
                value={income.justification}
                onChange={(e) => updateIncome("justification", e.target.value)}
              />
            </Label>
            {incomeEstimateProblems(income).length ? (
              <p className="break-words text-xs text-neutral-500">
                {incomeEstimateProblems(income).join(" ")}
              </p>
            ) : null}
            <div className="flex gap-2">
              <button
                className={primary}
                disabled={pending || incomeEstimateProblems(income).length > 0}
                onClick={() =>
                  run(
                    () => saveIncomeEstimateAction(income),
                    () => setIncome(null),
                  )
                }
              >
                Guardar ingreso estimado
              </button>
              <button className={button} onClick={() => setIncome(null)}>
                Cancelar estimación
              </button>
            </div>
          </div>
        ) : null}
      </Section>
      <Toast result={outcome} onDismiss={() => setOutcome(null)} />
    </div>
  );
}
