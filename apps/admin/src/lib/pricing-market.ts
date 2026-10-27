import type {
  PricingLocation,
  PricingMode,
  PricingOrigin,
  PricingScope,
  PricingUnit,
} from "@nassican/shared";
import { addMoney, divideMoney, scaleMoney } from "./pricing-engine";
import { fieldProblems, parseNumber } from "./draft-fields";

export type MarketQuoteInput = {
  id: string;
  serviceId: string;
  scope: PricingScope;
  description: string;
  price: number;
  unit: PricingUnit;
  currency: "COP" | "USD" | "EUR";
  provider: string;
  country: string;
  department: string;
  municipality: string;
  clientCountry: string | null;
  clientDepartment: string | null;
  clientMunicipality: string | null;
  mode: PricingMode;
  date: string;
  source: "received" | "published" | "own" | "other";
  url: string | null;
  origin: PricingOrigin;
};
export type MarketQuoteDraft = Omit<
  MarketQuoteInput,
  "price" | "clientCountry" | "clientDepartment" | "clientMunicipality" | "url"
> & {
  price: string;
  clientCountry: string;
  clientDepartment: string;
  clientMunicipality: string;
  url: string;
};
export const marketSourceLabels = {
  received: "Cotización recibida",
  published: "Precio publicado",
  own: "Propia",
  other: "Otra",
};
export const emptyMarketQuote = (): MarketQuoteDraft => ({
  id: "",
  serviceId: "",
  scope: "standard",
  description: "",
  price: "",
  unit: "project",
  currency: "COP",
  provider: "",
  country: "Colombia",
  department: "",
  municipality: "",
  clientCountry: "",
  clientDepartment: "",
  clientMunicipality: "",
  mode: "remote",
  date: "",
  source: "received",
  url: "",
  origin: "observed",
});
export function marketQuoteProblems(d: MarketQuoteDraft): string[] {
  const problems = fieldProblems([
    { label: "precio", value: d.price, kind: "amount" },
    { label: "fecha", value: d.date, kind: "date" },
  ]);
  if (
    !d.serviceId ||
    !d.provider.trim() ||
    !d.description.trim() ||
    !d.country.trim() ||
    !d.date.trim() ||
    parseNumber(d.price) === null
  )
    problems.push("Faltan servicio, alcance descrito, proveedor, país, fecha o precio.");
  if (d.url.trim() && !/^https?:\/\//i.test(d.url.trim()))
    problems.push("El enlace debe empezar por http:// o https://.");
  if (d.origin === "missing") problems.push("Una cotización necesita un origen para su precio.");
  return problems;
}
export const median = (values: number[]): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : divideMoney(addMoney(sorted[mid - 1], sorted[mid]), 2);
};
export function marketStats(prices: number[], outlierMultiplier = 3) {
  const count = prices.length;
  if (!count)
    return { count: 0, mean: null, minimum: null, maximum: null, median: null, outlier: false };
  const centre = median(prices)!;
  // A median-relative test also catches a lone outlier in a three-quote sample,
  // where interpolated quartiles otherwise absorb the very outlier in question.
  const outlier =
    count >= 3 &&
    prices.some((n) =>
      centre > 0 ? n > centre * outlierMultiplier || n < centre / outlierMultiplier : n > 0,
    );
  return {
    count,
    mean: divideMoney(addMoney(...prices), count),
    minimum: Math.min(...prices),
    maximum: Math.max(...prices),
    median: centre,
    outlier,
  };
}
export type MarketFactor = {
  factor: number;
  origin: PricingOrigin;
  level: string;
  explanation: string;
};
export type FactorResolver = (
  location: PricingLocation,
  serviceId: string,
  mode: PricingMode,
) => MarketFactor;
export const generalFactor: FactorResolver = () => ({
  factor: 1,
  origin: "missing",
  level: "general",
  explanation: "Sin datos para esta región: factor general 1.",
});
export function marketLocation(q: MarketQuoteInput): PricingLocation {
  return q.clientCountry
    ? {
        country: q.clientCountry,
        department: q.clientDepartment ?? "",
        municipality: q.clientMunicipality ?? "",
      }
    : { country: q.country, department: q.department, municipality: q.municipality };
}
export function marketComparables(
  quotes: MarketQuoteInput[],
  request: {
    serviceId: string;
    scope: PricingScope;
    unit: PricingUnit;
    mode: PricingMode;
    location: PricingLocation;
    today: string;
    maxMonths: number;
    outlierMultiplier?: number;
  },
  trm: { value: number; date: string } | null,
  resolve: FactorResolver = generalFactor,
) {
  const notes: string[] = [];
  const explanation: string[] = [];
  const target = resolve(request.location, request.serviceId, request.mode);
  const evidence: {
    id: string;
    price: number;
    adjusted: number;
    factor: number;
    origin: PricingOrigin;
    date: string;
    source: string;
  }[] = [];
  const month = (date: string) =>
    Number(date.slice(0, 4)) * 12 + (date.length >= 7 ? Number(date.slice(5, 7)) - 1 : 11);
  for (const q of quotes) {
    if (q.serviceId !== request.serviceId) continue;
    if (q.scope !== request.scope) {
      notes.push(`${q.provider}: alcance distinto, no comparable.`);
      continue;
    }
    if (q.unit !== request.unit) {
      notes.push(`${q.provider}: otra unidad, no se mezcla.`);
      continue;
    }
    if (q.mode !== request.mode)
      notes.push(`${q.provider}: otra modalidad, revisa su comparabilidad.`);
    if (month(request.today) - month(q.date) > request.maxMonths)
      notes.push(`${q.provider}: cotización de más de ${request.maxMonths} meses.`);
    if (q.date.slice(0, 10) > request.today.slice(0, q.date.slice(0, 10).length)) {
      notes.push(`${q.provider}: fecha futura, no comparable.`);
      continue;
    }
    const cop =
      q.currency === "COP"
        ? q.price
        : q.currency === "USD" && trm
          ? scaleMoney(q.price, trm.value)
          : null;
    if (cop === null) {
      notes.push(`${q.provider}: sin tasa oficial para ${q.currency}, no se mezcla esa moneda.`);
      continue;
    }
    const source = resolve(marketLocation(q), q.serviceId, q.mode);
    const factor = target.factor / source.factor;
    const adjusted = divideMoney(scaleMoney(cop, target.factor), source.factor);
    const unchanged =
      factor === 1 && JSON.stringify(marketLocation(q)) === JSON.stringify(request.location);
    const origin =
      q.origin === "estimated" ||
      (!unchanged && (source.origin !== "observed" || target.origin !== "observed"))
        ? "estimated"
        : q.origin;
    evidence.push({
      id: q.id,
      price: cop,
      adjusted,
      factor,
      origin,
      date: q.date,
      source: `${marketSourceLabels[q.source]}: ${q.provider}`,
    });
    if (q.currency === "USD")
      explanation.push(`${q.provider}: USD convertido con TRM ${trm!.value} del ${trm!.date}.`);
    explanation.push(
      `${q.provider}: ${cop} × (${target.factor} ÷ ${source.factor}) = ${adjusted} COP. Región de origen: ${source.level}.`,
    );
  }
  const stats = marketStats(
    evidence.map((e) => e.adjusted),
    request.outlierMultiplier,
  );
  const origin: PricingOrigin = !evidence.length
    ? "missing"
    : evidence.some((q) => q.origin === "estimated")
      ? "estimated"
      : evidence.every((q) => q.origin === "observed")
        ? "observed"
        : "declared";
  if (stats.outlier)
    notes.push(
      `Hay un valor atípico. Se muestra la mediana (${stats.median} COP), junto al promedio usado (${stats.mean} COP).`,
    );
  explanation.push(
    `Mercado: ${stats.count} comparables, mínimo ${stats.minimum ?? "sin dato"}, máximo ${stats.maximum ?? "sin dato"}, promedio ${stats.mean ?? "sin dato"} COP.`,
  );
  return { ...stats, evidence, origin, notes, explanation, target };
}
