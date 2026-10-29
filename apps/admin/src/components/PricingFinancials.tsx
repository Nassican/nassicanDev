"use client";

import PricingNumberInput from "./PricingNumberInput";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PricingParameters } from "@nassican/shared";
import { saveFinancialAction } from "@/app/(panel)/precios/actions";
import {
  emptyFinancial,
  financialAnalysis,
  financialLabels,
  financialProblems,
  financialSourceLabels,
  niifLabels,
  readFinancial,
  financialToDraft,
} from "@/lib/pricing-financial";
import {
  financialFields,
  grouped,
  pricingMoney,
  type PricingFinancialDraft,
} from "@/lib/pricing-draft";
import type { PricingCalculatorView } from "@/lib/pricing";
import { isDirty, useUnsavedChanges } from "@/lib/use-unsaved";
import { parseNumber } from "@/lib/draft-fields";
import DateField from "./DateField";
import Toast, { type ToastResult } from "./Toast";
import PricingHelp from "./PricingHelp";
import { pricingFieldHelp } from "@/lib/pricing-help";
import {
  PricingLabel as Label,
  pricingField as field,
  pricingButton as button,
  pricingPrimary as primary,
} from "./PricingFields";

export default function PricingFinancials({
  clientId,
  person,
  rows,
  selectedId,
  onSelect,
  parameters,
}: {
  clientId: string;
  person: boolean;
  rows: PricingCalculatorView["financials"];
  selectedId: string;
  onSelect: (id: string) => void;
  parameters: PricingParameters;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<PricingFinancialDraft | null>(null);
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<ToastResult | null>(null);
  const selected = rows.find((r) => r.id === selectedId) ?? rows[0];
  const analysis = selected ? financialAnalysis(selected, parameters) : null;
  const live = draft ? financialAnalysis(readFinancial(draft), parameters) : null;
  const automaticEquity =
    draft !== null && parseNumber(draft.assets) !== null && parseNumber(draft.liabilities) !== null;
  useUnsavedChanges(draft !== null && isDirty(emptyFinancial(clientId), draft));
  function update<K extends keyof PricingFinancialDraft>(k: K, v: PricingFinancialDraft[K]) {
    setDraft((d) => (d ? { ...d, [k]: v } : d));
  }
  const visibleFields =
    draft?.format === "210"
      ? financialFields.filter((k) =>
          ["assets", "liabilities", "equity", "revenue41", "combinedDeductions"].includes(k),
        )
      : financialFields.filter((k) => k !== "combinedDeductions");
  return (
    <div className="flex flex-col gap-3 border-t border-neutral-800 pt-4">
      <h3 className="text-sm font-medium">
        Periodos financieros{person ? " y declaración de renta" : ""}
      </h3>
      {rows.length ? (
        <Label label="Periodo usado para calcular">
          <select
            className={field}
            value={selected?.id ?? ""}
            onChange={(e) => onSelect(e.target.value)}
          >
            {rows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.start} a {r.end}, {r.annual ? "anual" : "mensual"},{" "}
                {financialSourceLabels[r.source]}
              </option>
            ))}
          </select>
        </Label>
      ) : (
        <p className="text-xs text-neutral-500">
          Sin periodos registrados. Los campos vacíos son datos ausentes, no ceros.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          className={button}
          disabled={pending}
          onClick={() =>
            setDraft({
              ...emptyFinancial(clientId),
              ...(person ? { format: "210", source: "tax_return" } : {}),
            })
          }
        >
          Añadir periodo
        </button>
        {selected ? (
          <button
            className={button}
            disabled={pending}
            onClick={() => setDraft(financialToDraft(selected))}
          >
            Editar periodo
          </button>
        ) : null}
      </div>
      {analysis ? (
        <div className="grid gap-2 text-xs text-neutral-500 sm:grid-cols-2">
          {(
            [
              ["Utilidad operacional del periodo", analysis.profit],
              ["Utilidad neta del periodo", analysis.net],
              ["EBITDA aproximado", analysis.ebitda],
              ["Ingresos operacionales mensuales", analysis.monthlyRevenue],
            ] as const
          ).map(([label, amount]) => (
            <div key={label}>
              {label}:{" "}
              <span className="text-neutral-200">
                {amount === null ? "Sin dato" : pricingMoney(amount)}
              </span>
              <PricingHelp label={label}>{pricingFieldHelp(label)!}</PricingHelp>
            </div>
          ))}
          <p>
            Margen operacional:{" "}
            {analysis.margin === null ? "Sin dato" : `${grouped(analysis.margin * 100)} %`}
          </p>
          <p>
            Endeudamiento:{" "}
            {analysis.debt === null ? "Sin dato" : `${grouped(analysis.debt * 100)} %`}
          </p>
          <p>Liquidez: {analysis.liquidity === null ? "Sin dato" : grouped(analysis.liquidity)}</p>
          <p>Salud: × {grouped(analysis.health)}</p>
        </div>
      ) : null}
      {analysis?.warnings.map((w) => (
        <p key={w} className="text-xs text-amber-300">
          {w}
        </p>
      ))}
      {draft ? (
        <div className="flex flex-col gap-4 rounded border border-neutral-800 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Label label="Inicio del periodo">
              <DateField
                value={draft.start}
                onChange={(v) => update("start", v)}
                label="Inicio del periodo"
              />
            </Label>
            <Label label="Fin del periodo">
              <DateField
                value={draft.end}
                onChange={(v) => update("end", v)}
                label="Fin del periodo"
              />
            </Label>
            <Label label="Duración de los importes">
              <select
                className={field}
                value={draft.annual ? "annual" : "monthly"}
                onChange={(e) => update("annual", e.target.value === "annual")}
              >
                <option value="annual">Anuales (se dividen entre 12)</option>
                <option value="monthly">Mensuales</option>
              </select>
            </Label>
            <Label label="Fuente financiera">
              <select
                className={field}
                value={draft.source}
                onChange={(e) =>
                  update("source", e.target.value as PricingFinancialDraft["source"])
                }
              >
                {Object.entries(financialSourceLabels).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Label>
            <Label label="Nombres del formulario">
              <select
                className={field}
                value={draft.format}
                onChange={(e) =>
                  update("format", e.target.value as PricingFinancialDraft["format"])
                }
              >
                <option value="puc">PUC colombiano</option>
                <option value="niif">NIIF para pymes</option>
                <option value="210">Declaración de renta, formulario 210</option>
              </select>
            </Label>
          </div>
          <p className="text-xs text-neutral-500">
            Importes en COP para el periodo completo. Si un gasto no existe, escribe 0; dejarlo
            vacío significa que no lo conoces.{" "}
            {draft.format === "210"
              ? "Costos y deducciones van en un solo renglón."
              : "61 ya contiene el costo: nunca se suman 62 ni clase 7."}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {visibleFields.map((k) => (
              <Label
                key={k}
                label={
                  draft.format === "niif"
                    ? (niifLabels[k] ?? financialLabels[k])
                    : financialLabels[k]
                }
              >
                <PricingNumberInput
                  className={field}
                  inputMode="decimal"
                  value={k === "equity" && automaticEquity ? grouped(live!.equity) : draft[k]}
                  readOnly={k === "equity" && automaticEquity}
                  placeholder={k === "equity" ? "Se calcula con activos y pasivos" : undefined}
                  onChange={(e) => update(k, e.target.value)}
                />
                {k === "equity" ? (
                  <span className="mt-1 block text-xs text-neutral-500">
                    {automaticEquity
                      ? "Automático: activos − pasivos. Se guarda este resultado."
                      : "Ingresa activos y pasivos para calcularlo, o registra el patrimonio conocido."}
                  </span>
                ) : null}
              </Label>
            ))}
          </div>
          {live ? (
            <div className="rounded-lg border border-neutral-800 p-3">
              <p className="mb-3 text-sm font-medium">Cálculos automáticos del periodo</p>
              <dl className="grid gap-3 text-xs sm:grid-cols-2">
                {(
                  [
                    ["Patrimonio · activos − pasivos", live.equity],
                    ["Costo utilizado (sin duplicados)", live.cost],
                    ["Utilidad operacional del periodo", live.profit],
                    ["Utilidad neta del periodo", live.net],
                    [
                      draft.annual ? "Ingreso mensual · anual ÷ 12" : "Ingreso mensual",
                      live.monthlyRevenue,
                    ],
                    ["Utilidad operacional mensual", live.monthlyProfit],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <dt className="flex items-center gap-1 text-neutral-500">
                      {label}
                      <PricingHelp label={label}>{pricingFieldHelp(label)!}</PricingHelp>
                    </dt>
                    <dd className="mt-1 font-medium tabular-nums">
                      {value === null ? "Faltan datos" : pricingMoney(value)}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-neutral-500">
                Se actualiza mientras escribes. Los campos vacíos no cuentan como cero.
              </p>
            </div>
          ) : null}
          {financialProblems(draft).length ? (
            <p className="text-xs text-neutral-500">{financialProblems(draft).join(" ")}</p>
          ) : null}
          <div className="flex gap-2">
            <button
              className={primary}
              disabled={pending || financialProblems(draft).length > 0}
              onClick={() =>
                startTransition(async () => {
                  try {
                    const result = await saveFinancialAction(draft);
                    setOutcome(result);
                    if (result.ok) {
                      if (result.id) onSelect(result.id);
                      setDraft(null);
                      router.refresh();
                    }
                  } catch {
                    setOutcome({
                      ok: false,
                      message:
                        "No se pudo guardar el periodo. Revisa si ya existe uno con las mismas fechas.",
                    });
                  }
                })
              }
            >
              Guardar periodo
            </button>
            <button className={button} disabled={pending} onClick={() => setDraft(null)}>
              Cancelar periodo
            </button>
          </div>
          <details>
            <summary className="cursor-pointer text-xs text-neutral-400">
              Comprobar regla contable
            </summary>
            {financialAnalysis(readFinancial(draft), parameters).explanation.map((line) => (
              <p key={line} className="mt-2 text-xs text-neutral-500">
                {line}
              </p>
            ))}
          </details>
        </div>
      ) : null}
      <Toast result={outcome} onDismiss={() => setOutcome(null)} />
    </div>
  );
}
