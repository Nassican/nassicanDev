"use client";

import { useState, useTransition } from "react";
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
  emptyRegionFactor,
  incomeEstimateProblems,
  observedRegionalFactor,
  regionFactorProblems,
  type IncomeEstimateDraft,
  type RegionFactorDraft,
} from "@/lib/pricing-geography";
import { grouped, modeLabels, pricingMoney, scopeLabels, unitLabels } from "@/lib/pricing-draft";
import { isDirty, useUnsavedChanges } from "@/lib/use-unsaved";
import DateField from "./DateField";
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

const regionName = (location: PricingLocation) =>
  [location.country, location.department, location.municipality].filter(Boolean).join(", ");
export default function PricingRegions({ view }: { view: PricingRegionsView }) {
  const router = useRouter();
  const [factor, setFactor] = useState<RegionFactorDraft | null>(null);
  const [income, setIncome] = useState<IncomeEstimateDraft | null>(null);
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
    setIncome((d) => (d ? { ...d, [k]: value } : d));
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
      </header>
      <Section title="Factores regionales">
        <button className={button} onClick={() => setFactor(emptyRegionFactor())}>
          Añadir factor manual
        </button>
        {view.factors.map((f) => (
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
                <input
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
            <p className="text-xs text-neutral-500">
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
        <p className="text-xs text-neutral-500">
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
        <p className="text-xs text-neutral-500">
          Solo se usan si no hay ingreso conocido. Siempre se marcan como estimados. El estrato 0
          significa sin estrato o vivienda informal.
        </p>
        <button className={button} onClick={() => setIncome(emptyIncomeEstimate())}>
          Añadir ingreso estimado
        </button>
        {view.incomes.map((r) => (
          <article
            key={r.id}
            className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-900 pb-3"
          >
            <div className="min-w-0 basis-full sm:basis-64 sm:flex-1">
              <p className="text-sm">
                {regionName(r)}, estrato {r.stratum}: {pricingMoney(r.income)} / mes
              </p>
              <p className="text-xs text-neutral-500">
                Estimado, {r.date}. {r.justification}
              </p>
            </div>
            <button
              className={button}
              onClick={() =>
                setIncome({ ...r, stratum: String(r.stratum), income: grouped(r.income) })
              }
            >
              Editar estimación
            </button>
          </article>
        ))}
        {income ? (
          <div className="flex flex-col gap-4 rounded border border-neutral-800 p-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <PricingLocationFields
                value={income}
                places={view.places}
                onChange={(location) => setIncome((d) => (d ? { ...d, ...location } : d))}
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
                  {Array.from({ length: 7 }, (_, n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </Label>
              <Label label="Ingreso mensual estimado, COP">
                <input
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
              <p className="text-xs text-neutral-500">{incomeEstimateProblems(income).join(" ")}</p>
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
