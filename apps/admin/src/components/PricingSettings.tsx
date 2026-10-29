"use client";

import PricingNumberInput from "./PricingNumberInput";

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
import { composePricingPackage } from "@/lib/pricing-package";
import { addMoney, scaleMoney, roundPricingAmount } from "@/lib/pricing-engine";
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
  confidenceHigh: "Evidencia para confianza alta (%)",
  confidenceMedium: "Evidencia para confianza media (%)",
  outlierMultiplier: "Umbral de valor atípico respecto a la mediana",
  targetIncome: "Ingreso mensual objetivo, COP",
  fixedCosts: "Gastos fijos mensuales, COP",
  billableHours: "Horas facturables al mes",
  margin: "Recargo sobre el costo (%)",
  familyDiscount: "Descuento familiar (%)",
  projectWeight: "Peso de proyecto (%)",
  capacityWeight: "Peso de capacidad (%)",
  marketWeight: "Peso de mercado (%)",
  rounding: "Redondeo hacia arriba, COP",
  familyRounding: "Redondeo familiar hacia abajo, COP",
  profitCap: "Tope sobre utilidad (%)",
  debtLow: "Umbral de deuda baja (%)",
  debtHigh: "Umbral de deuda alta (%)",
  debtMediumFactor: "Multiplicador de deuda media",
  debtHighFactor: "Multiplicador de deuda alta",
  negativeEquityFactor: "Multiplicador de patrimonio negativo",
  marginLow: "Umbral de margen bajo (%)",
  marginHigh: "Umbral de margen alto (%)",
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
  const selectedParts = service
    ? view.services.filter((s) => service.componentIds.includes(s.id))
    : [];
  const packagePreview =
    service && selectedParts.length >= 2
      ? composePricingPackage(selectedParts, service.unit, service.id)
      : null;
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
    setService((s) => (s ? { ...s, [k]: v, ...(k === "unit" ? { componentIds: [] } : {}) } : s));
  }
  const serviceEditor = service ? (
    <div
      id={`pricing-service-editor-${service.id || "new"}`}
      role="region"
      aria-label={service.id ? "Editar servicio" : "Nuevo servicio"}
      className="grid w-full basis-full grid-cols-1 gap-3 rounded border border-neutral-800 p-3 sm:grid-cols-2"
    >
      {(
        [
          ["name", "Nombre del servicio"],
          ["typicalHours", "Horas típicas"],
          ["incomePercent", "Porcentaje del ingreso de la persona (0 a 100)"],
          ["minimum", "Mínimo del servicio, COP"],
          ["recommendedPrice", "Precio recomendado, COP"],
        ] as const
      ).map(([k, label]) => (
        <Label key={k} label={label}>
          <PricingNumberInput
            formatted={k !== "name"}
            className={field}
            autoFocus={k === "name"}
            value={
              packagePreview && k === "typicalHours"
                ? grouped(packagePreview.typicalHours)
                : packagePreview && k === "minimum"
                  ? grouped(packagePreview.minimum)
                  : packagePreview && k === "incomePercent"
                    ? grouped(packagePreview.incomePercent * 100)
                    : service[k]
            }
            disabled={
              service.componentIds.length > 0 &&
              ["typicalHours", "incomePercent", "minimum"].includes(k)
            }
            onChange={(e) => updateService(k, e.target.value)}
          />
        </Label>
      ))}
      <Label label="Unidad por defecto">
        <select
          className={field}
          value={service.unit}
          onChange={(e) => updateService("unit", e.target.value as PricingServiceDraft["unit"])}
        >
          {Object.entries(unitLabels).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Label>
      <Label label="Alcance y entregables">
        <textarea
          className={field}
          value={service.description}
          onChange={(e) => updateService("description", e.target.value)}
        />
      </Label>
      <fieldset className="min-w-0 rounded border border-neutral-800 p-3 sm:col-span-2">
        <legend className="px-1 text-sm">Unir servicios en un paquete</legend>
        <p className="mb-3 text-xs text-neutral-500">
          Selecciona dos o más servicios de la misma unidad. Las horas y mínimos se suman; no se
          permiten paquetes dentro de paquetes. Deja el precio recomendado vacío para sumar los
          precios de sus componentes.
        </p>
        {packagePreview ? (
          <p className="mb-3 text-xs">
            {selectedParts.length} servicios: {packagePreview.typicalHours} h, mínimo{" "}
            {grouped(packagePreview.minimum)} COP, recomendado por suma{" "}
            {grouped(packagePreview.recommendedPrice)} COP.
          </p>
        ) : null}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {view.services
            .filter(
              (s) =>
                s.id !== service.id &&
                s.active &&
                !s.componentIds.length &&
                s.unit === service.unit,
            )
            .map((s) => (
              <label key={s.id} className="flex min-w-0 items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  className="mt-0.5 shrink-0"
                  checked={service.componentIds.includes(s.id)}
                  onChange={(e) =>
                    updateService(
                      "componentIds",
                      e.target.checked
                        ? [...service.componentIds, s.id]
                        : service.componentIds.filter((id) => id !== s.id),
                    )
                  }
                />
                <span className="min-w-0 break-words">
                  {s.name}, {s.typicalHours} h
                </span>
              </label>
            ))}
        </div>
      </fieldset>
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
          disabled={pending || service.componentIds.length === 1}
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
  ) : null;
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
      {view.roundingMigrationPending ? (
        <p role="status" className="rounded border border-neutral-800 p-3 text-sm text-neutral-500">
          El redondeo nuevo funciona con pasos de 100.000 COP normal y 1.000.000 COP familiar. Hay
          una migración pendiente para poder guardar ajustes de parámetros.
        </p>
      ) : null}
      <Section title="Tarifa familiar">
        <p className="text-sm text-neutral-500">
          Elige el porcentaje y activa «Aplicar tarifa familiar» al cotizar. El descuento solo
          afecta a los honorarios y conserva los costos directos y viáticos. Se aplica completo,
          aunque el resultado quede por debajo del piso de costos. Después, el precio familiar se
          redondea hacia abajo. Los costos directos y viáticos se conservan.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Label label={labels.familyDiscount}>
            <PricingNumberInput
              className={field}
              inputMode="decimal"
              value={draft.familyDiscount}
              onChange={(e) => setDraft((d) => ({ ...d, familyDiscount: e.target.value }))}
            />
          </Label>
          <Label label={labels.familyRounding!}>
            <PricingNumberInput
              className={field}
              value={draft.familyRounding}
              onChange={(e) => setDraft((d) => ({ ...d, familyRounding: e.target.value }))}
            />
          </Label>
        </div>
        <p className="text-xs text-neutral-500">
          Escribe un número de 0 a 100, por ejemplo 20. Las cotizaciones anteriores conservan su
          porcentaje.
        </p>
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
      <Section title="Costos, referencias y reglas">
        <p className="text-xs text-neutral-500">
          Los campos con % se escriben como porcentajes, por ejemplo 1 o 20. Los multiplicadores se
          escriben como factores, por ejemplo 0,85. Los pesos se normalizan entre los criterios
          disponibles.
        </p>
        <p className="text-xs text-neutral-500">
          Redondeo comercial: normal hacia arriba (9.386.000 → 9.400.000 con pasos de 100.000);
          familiar hacia abajo después del descuento (9.386.000 → 9.000.000 con pasos de 1.000.000).
          Si el importe es menor que el paso, se usa un paso menor automáticamente.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(Object.keys(labels) as (keyof PricingSettingsDraft)[])
            .filter((k) => k !== "familyDiscount" && k !== "familyRounding")
            .map((k) => (
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
                      Evita doble conteo: nunca se resta 62 ni clase 7 junto con 61. Esta casilla
                      solo habilita una alternativa cuando falta 61.
                    </span>
                  </span>
                ) : (
                  <PricingNumberInput
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
            <div className="min-w-0 basis-full sm:basis-64 sm:flex-1">
              <p className="break-words text-sm">
                {s.name}
                {s.active ? "" : " (inactivo)"}
              </p>
              <p className="text-xs text-neutral-500">
                {s.typicalHours} horas, {unitLabels[s.unit]}, {grouped(s.incomePercent * 100)} % del
                ingreso, mínimo {grouped(s.minimum)} COP.
              </p>
              {s.recommendedPrice !== null ? (
                <p className="text-sm">
                  Recomendado: {grouped(s.recommendedPrice)} COP · Familiar:{" "}
                  {grouped(
                    roundPricingAmount(
                      addMoney(
                        s.recommendedPrice,
                        -scaleMoney(s.recommendedPrice, view.parameters.familyDiscount),
                      ),
                      view.parameters.familyRounding ?? 1000000,
                      true,
                    ).amount,
                  )}{" "}
                  COP.
                </p>
              ) : null}
              {s.components.length ? (
                <p className="text-xs text-neutral-500">
                  Paquete: {s.components.map((p) => p.name).join(" + ")}. Las horas y el mínimo se
                  suman una sola vez.
                </p>
              ) : null}
              {s.description ? (
                <p className="mt-1 max-w-prose text-xs text-neutral-500">{s.description}</p>
              ) : null}
            </div>
            <button
              className={button}
              aria-expanded={service?.id === s.id}
              aria-controls={`pricing-service-editor-${s.id}`}
              disabled={pending || service?.id === s.id}
              onClick={() =>
                setService({
                  id: s.id,
                  name: s.name,
                  unit: s.unit,
                  typicalHours: grouped(s.typicalHours),
                  incomePercent: grouped(s.incomePercent * 100),
                  minimum: grouped(s.minimum),
                  active: s.active,
                  description: s.description ?? "",
                  recommendedPrice: grouped(s.recommendedPrice),
                  componentIds: s.componentIds,
                })
              }
            >
              Editar servicio
            </button>
            {service?.id === s.id ? serviceEditor : null}
          </div>
        ))}
        <button className={button} onClick={() => setService(emptyPricingService())}>
          Añadir servicio
        </button>
        <button
          className={button}
          onClick={() => setService({ ...emptyPricingService(), name: "Paquete de servicios" })}
        >
          Crear paquete de servicios
        </button>
        {service && !service.id ? serviceEditor : null}
      </Section>
      <PricingTiers key={JSON.stringify(view.tiers)} tiers={view.tiers} />
      <Toast result={outcome} onDismiss={() => setOutcome(null)} />
    </div>
  );
}
