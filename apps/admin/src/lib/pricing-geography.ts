import type { PricingLocation, PricingMode, PricingScope, PricingUnit } from "@nassican/shared";
import { fold } from "./list-filters";
import { fieldProblems, parseNumber } from "./draft-fields";
import { scaleMoney } from "./pricing-engine";
import {
  marketLocation,
  median,
  type FactorResolver,
  type MarketQuoteInput,
} from "./pricing-market";

export type RegionFactorInput = PricingLocation & {
  id: string;
  serviceId: string | null;
  mode: PricingMode;
  factor: number;
  origin: "observed" | "manual";
  justification: string;
  date: string;
};
export type RegionFactorDraft = PricingLocation & {
  id: string;
  serviceId: string;
  mode: PricingMode;
  factor: string;
  justification: string;
  date: string;
};
export type IncomeEstimateInput = PricingLocation & {
  id: string;
  stratum: number;
  income: number;
  justification: string;
  date: string;
};
export type IncomeEstimateDraft = PricingLocation & {
  id: string;
  stratum: string;
  income: string;
  justification: string;
  date: string;
};
export const emptyRegionFactor = (): RegionFactorDraft => ({
  id: "",
  country: "Colombia",
  department: "",
  municipality: "",
  serviceId: "",
  mode: "remote",
  factor: "1",
  justification: "",
  date: "",
});
export const emptyIncomeEstimate = (): IncomeEstimateDraft => ({
  id: "",
  country: "Colombia",
  department: "",
  municipality: "",
  stratum: "0",
  income: "",
  justification: "",
  date: "",
});
export function regionContains(region: PricingLocation, location: PricingLocation): boolean {
  return (
    fold(region.country) === fold(location.country) &&
    (!region.department || fold(region.department) === fold(location.department)) &&
    (!region.municipality || fold(region.municipality) === fold(location.municipality))
  );
}
function specificity(region: PricingLocation): number {
  return region.municipality ? 3 : region.department ? 2 : 1;
}
const levels: Record<number, string> = { 1: "país", 2: "departamento", 3: "municipio" };
export function resolveRegionFactor(factors: RegionFactorInput[]): FactorResolver {
  return (location, serviceId, mode) => {
    const matches = factors.filter(
      (f) =>
        f.factor > 0 &&
        f.mode === mode &&
        (!f.serviceId || f.serviceId === serviceId) &&
        regionContains(f, location),
    );
    matches.sort(
      (a, b) =>
        specificity(b) - specificity(a) ||
        Number(!!b.serviceId) - Number(!!a.serviceId) ||
        b.date.localeCompare(a.date) ||
        Number(b.origin === "observed") - Number(a.origin === "observed"),
    );
    const match = matches[0];
    return match
      ? {
          factor: match.factor,
          origin: match.origin === "observed" ? "observed" : "estimated",
          level: levels[specificity(match)],
          explanation: `${match.origin === "manual" ? "Factor manual" : "Factor observado"}: ${match.justification || "factor neutro"} (${match.date}).`,
        }
      : {
          factor: 1,
          origin: "missing",
          level: "general",
          explanation: "No había datos para esa región. Se usa el factor general 1.",
        };
  };
}
export function regionFactorProblems(d: RegionFactorDraft): string[] {
  const problems = fieldProblems([
    { label: "factor", value: d.factor, kind: "amount" },
    { label: "fecha del factor", value: d.date, kind: "date" },
  ]);
  const factor = parseNumber(d.factor);
  if (
    !d.country.trim() ||
    !d.date.trim() ||
    factor === null ||
    factor <= 0 ||
    (d.municipality && !d.department)
  )
    problems.push("Indica país, fecha, factor positivo y departamento si hay municipio.");
  if (factor !== 1 && !d.justification.trim())
    problems.push("Un factor distinto de 1 exige una justificación escrita.");
  return problems;
}
export function incomeEstimateProblems(d: IncomeEstimateDraft): string[] {
  const problems = fieldProblems([
    { label: "ingreso estimado", value: d.income, kind: "amount" },
    { label: "fecha de estimación", value: d.date, kind: "date" },
  ]);
  const stratum = parseNumber(d.stratum);
  if (
    !d.country.trim() ||
    !d.justification.trim() ||
    !d.date.trim() ||
    parseNumber(d.income) === null ||
    stratum === null ||
    !Number.isInteger(stratum) ||
    stratum < 0 ||
    stratum > 6 ||
    (d.municipality && !d.department)
  )
    problems.push("Indica región, estrato entre 0 y 6, ingreso, justificación y fecha.");
  return problems;
}
export function estimatedRegionalIncome(
  estimates: IncomeEstimateInput[],
  location: PricingLocation,
  stratum: number | null,
) {
  if (stratum === null) return null;
  return (
    estimates
      .filter((e) => e.stratum === stratum && regionContains(e, location))
      .sort((a, b) => specificity(b) - specificity(a) || b.date.localeCompare(a.date))[0] ?? null
  );
}
export function observedRegionalFactor(
  quotes: MarketQuoteInput[],
  target: PricingLocation,
  reference: PricingLocation,
  selection: { serviceId: string; scope: PricingScope; unit: PricingUnit; mode: PricingMode },
  trm: { value: number; date: string } | null,
) {
  const local: number[] = [];
  const baseline: number[] = [];
  for (const q of quotes) {
    if (
      q.serviceId !== selection.serviceId ||
      q.scope !== selection.scope ||
      q.unit !== selection.unit ||
      q.mode !== selection.mode ||
      q.origin !== "observed"
    )
      continue;
    const price =
      q.currency === "COP"
        ? q.price
        : q.currency === "USD" && trm
          ? scaleMoney(q.price, trm.value)
          : null;
    if (price === null) continue;
    const location = marketLocation(q);
    if (regionContains(target, location)) local.push(price);
    else if (regionContains(reference, location)) baseline.push(price);
  }
  const localMedian = median(local);
  const referenceMedian = median(baseline);
  const factor =
    local.length >= 3 &&
    baseline.length >= 3 &&
    referenceMedian !== null &&
    referenceMedian > 0 &&
    localMedian !== null &&
    localMedian > 0
      ? localMedian / referenceMedian
      : null;
  return {
    factor,
    localCount: local.length,
    referenceCount: baseline.length,
    localMedian,
    referenceMedian,
    explanation:
      factor === null
        ? `Faltan muestras: ${local.length} en la región y ${baseline.length} distintas en referencia. Se necesitan al menos 3 en cada una, con mediana positiva.`
        : `Mediana regional ${localMedian} ÷ mediana de referencia ${referenceMedian} = ${factor}. Muestras observadas: ${local.length} y ${baseline.length}, mismo servicio, alcance, unidad y modalidad.`,
  };
}
