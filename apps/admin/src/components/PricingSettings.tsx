"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PricingParameters } from "@nassican/shared";
import { saveServiceAction, saveSettingsAction } from "@/app/(panel)/precios/parametros/actions";
import type { PricingCalculatorView } from "@/lib/pricing";
import {
  emptyPricingService,
  grouped,
  settingsDraft,
  unitLabels,
  type PricingServiceDraft,
  type PricingSettingsDraft,
} from "@/lib/pricing-draft";
import { isDirty, useUnsavedChanges } from "@/lib/use-unsaved";
import Toast, { type ToastResult } from "./Toast";
import PricingTabs from "./PricingTabs";
import PricingTiers from "./PricingTiers";
import {
  PricingLabel as Label,
  PricingSection as Section,
  pricingButton as button,
  pricingPrimary as primary,
  pricingField as field,
} from "./PricingFields";

const labels: Record<keyof PricingParameters, string> = {
  confidenceHigh: "Evidencia para confianza alta (0 a 1)",
  confidenceMedium: "Evidencia para confianza media (0 a 1)",
  outlierMultiplier: "Umbral de valor atípico respecto a la mediana",
  targetIncome: "Ingreso mensual objetivo, COP",
  fixedCosts: "Gastos fijos mensuales, COP",
  billableHours: "Horas facturables al mes",
  margin: "Margen (0,3 equivale al 30 %)",
  projectWeight: "Peso de proyecto",
  capacityWeight: "Peso de capacidad",
  marketWeight: "Peso de mercado",
  rounding: "Redondeo hacia arriba, COP",
  profitCap: "Tope sobre utilidad (0,2 equivale al 20 %)",
  debtLow: "Umbral de deuda baja",
  debtHigh: "Umbral de deuda alta",
  debtMediumFactor: "Multiplicador de deuda media",
  debtHighFactor: "Multiplicador de deuda alta",
  negativeEquityFactor: "Multiplicador de patrimonio negativo",
  marginLow: "Umbral de margen bajo",
  marginHigh: "Umbral de margen alto",
  negativeMarginFactor: "Multiplicador de margen negativo",
  lowMarginFactor: "Multiplicador de margen bajo",
  highMarginFactor: "Multiplicador de margen alto",
  liquidityThreshold: "Umbral de liquidez",
  liquidityFactor: "Multiplicador de baja liquidez",
  healthMinimum: "Mínimo de salud (al menos 0,5)",
  useInventory: "Sin 61: usar inventario inicial + 62 menos inventario final",
  usePurchases: "Sin 61 ni inventarios: aproximar con 62",
  useClass7: "Sin 61 ni 62: aproximar con clase 7",
  quoteMaxMonths: "Antigüedad máxima de referencias, meses",
  transport: "Transporte por día, COP",
  lodging: "Alojamiento por día, COP",
  food: "Alimentación por día, COP",
};
export default function PricingSettings({ view }: { view: PricingCalculatorView }) {
  const router = useRouter();
  const initial = settingsDraft(view.parameters);
  const [draft, setDraft] = useState(initial);
  const [service, setService] = useState<PricingServiceDraft | null>(null);
  const [outcome, setOutcome] = useState<ToastResult | null>(null);
  const [pending, startTransition] = useTransition();
  useUnsavedChanges(
    isDirty(initial, draft) || (service !== null && isDirty(emptyPricingService(), service)),
  );
  function run(action: () => Promise<ToastResult>, onOk?: () => void) {
    startTransition(async () => {
      try {
        const result = await action();
        setOutcome(result);
        if (result.ok) {
          onOk?.();
          router.refresh();
        }
      } catch {
        setOutcome({
          ok: false,
          message: "No se pudo guardar. Revisa los datos e inténtalo de nuevo.",
        });
      }
    });
  }
  function updateService<K extends keyof PricingServiceDraft>(k: K, v: PricingServiceDraft[K]) {
    setService((s) => (s ? { ...s, [k]: v } : s));
  }
  return (
    <div className="flex flex-col gap-6">
      <PricingTabs current="settings" />
      <header>
        <h1 className="text-xl font-semibold">Parámetros</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Los cambios afectan a cálculos nuevos. Las cotizaciones guardadas conservan sus
          parámetros.
        </p>
      </header>
      <Section title="Costos, referencias y reglas">
        <p className="text-xs text-neutral-500">
          Las tasas se escriben como fracción: 0,01 equivale al 1 %. Los pesos se normalizan entre
          los criterios disponibles.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(Object.keys(labels) as (keyof PricingSettingsDraft)[]).map((k) => (
            <Label key={k} label={labels[k]}>
              {typeof draft[k] === "boolean" ? (
                <span className="flex flex-col gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={draft[k] as boolean}
                    onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.checked }))}
                  />
                  <span className="text-amber-300">
                    Evita doble conteo: nunca se resta 62 ni clase 7 junto con 61. Esta casilla solo
                    habilita una alternativa cuando falta 61.
                  </span>
                </span>
              ) : (
                <input
                  className={field}
                  inputMode="decimal"
                  value={draft[k] as string}
                  onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                />
              )}
            </Label>
          ))}
        </div>
        <div>
          <button
            className={primary}
            disabled={pending}
            onClick={() => run(() => saveSettingsAction(draft))}
          >
            Guardar parámetros
          </button>
        </div>
      </Section>
      <Section title="Catálogo de servicios">
        {view.services.map((s) => (
          <div
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-900 pb-3"
          >
            <div>
              <p className="text-sm">
                {s.name}
                {s.active ? "" : " (inactivo)"}
              </p>
              <p className="text-xs text-neutral-500">
                {s.typicalHours} horas, {unitLabels[s.unit]}, {grouped(s.incomePercent * 100)} % del
                ingreso, mínimo {grouped(s.minimum)} COP.
              </p>
            </div>
            <button
              className={button}
              onClick={() =>
                setService({
                  id: s.id,
                  name: s.name,
                  unit: s.unit,
                  typicalHours: grouped(s.typicalHours),
                  incomePercent: grouped(s.incomePercent * 100),
                  minimum: grouped(s.minimum),
                  active: s.active,
                })
              }
            >
              Editar servicio
            </button>
          </div>
        ))}
        <button className={button} onClick={() => setService(emptyPricingService())}>
          Añadir servicio
        </button>
        {service ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["name", "Nombre del servicio"],
                ["typicalHours", "Horas típicas"],
                ["incomePercent", "Porcentaje del ingreso de la persona (0 a 100)"],
                ["minimum", "Mínimo del servicio, COP"],
              ] as const
            ).map(([k, label]) => (
              <Label key={k} label={label}>
                <input
                  className={field}
                  value={service[k]}
                  onChange={(e) => updateService(k, e.target.value)}
                />
              </Label>
            ))}
            <Label label="Unidad por defecto">
              <select
                className={field}
                value={service.unit}
                onChange={(e) =>
                  updateService("unit", e.target.value as PricingServiceDraft["unit"])
                }
              >
                {Object.entries(unitLabels).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Label>
            <Label label="Activo">
              <input
                type="checkbox"
                checked={service.active}
                onChange={(e) => updateService("active", e.target.checked)}
              />
            </Label>
            <div className="flex gap-2">
              <button
                className={primary}
                disabled={pending}
                onClick={() =>
                  run(
                    () => saveServiceAction(service),
                    () => setService(null),
                  )
                }
              >
                Guardar servicio
              </button>
              <button className={button} onClick={() => setService(null)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : null}
      </Section>
      <PricingTiers key={JSON.stringify(view.tiers)} tiers={view.tiers} />
      <Toast result={outcome} onDismiss={() => setOutcome(null)} />
    </div>
  );
}
