import type {
  PricingFinancial,
  PricingInput,
  PricingMode,
  PricingOrigin,
  PricingParameters,
  PricingScope,
  PricingStatus,
  PricingUnit,
  PricingTierInput,
} from "@nassican/shared";
import { fieldProblems, parseNumber } from "./draft-fields";

export const originLabels: Record<PricingOrigin, string> = {
  observed: "Observada",
  declared: "Declarada",
  estimated: "Estimada",
  missing: "Sin dato",
};
export const unitLabels: Record<PricingUnit, string> = {
  project: "Por proyecto",
  monthly: "Mensual",
  hour: "Por hora",
};
export const modeLabels: Record<PricingMode, string> = {
  remote: "Remota",
  onsite: "Presencial",
  hybrid: "Híbrida",
};
export const scopeLabels: Record<PricingScope, string> = {
  basic: "Básico",
  standard: "Estándar",
  advanced: "Avanzado",
};
export const quoteStatusLabels: Record<PricingStatus, string> = {
  draft: "Borrador",
  sent: "Enviada",
  accepted: "Aceptada",
  rejected: "Rechazada",
  expired: "Vencida",
};
export const confidenceLabels = { high: "Alta", medium: "Media", low: "Baja" };
export const grouped = (n: number | null) =>
  n === null ? "" : n.toLocaleString("es-CO", { maximumFractionDigits: 6 });
export const pricingMoney = (n: number, currency = "COP") =>
  n.toLocaleString("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "COP" ? 0 : 2,
  });

export type PricingClientDraft = {
  id: string;
  type: "person" | "company";
  name: string;
  country: string;
  department: string;
  municipality: string;
  zone: "urban" | "rural";
  stratum: string;
  monthlyIncome: string;
  incomeOrigin: PricingOrigin;
  activity: string;
  foundedAt: string;
  notes: string;
};
export const emptyPricingClient = (): PricingClientDraft => ({
  id: "",
  type: "person",
  name: "",
  country: "Colombia",
  department: "",
  municipality: "",
  zone: "urban",
  stratum: "",
  monthlyIncome: "",
  incomeOrigin: "estimated",
  activity: "",
  foundedAt: "",
  notes: "",
});
export type PricingServiceDraft = {
  id: string;
  name: string;
  unit: PricingUnit;
  typicalHours: string;
  incomePercent: string;
  minimum: string;
  active: boolean;
};
export const emptyPricingService = (): PricingServiceDraft => ({
  id: "",
  name: "",
  unit: "project",
  typicalHours: "20",
  incomePercent: "10",
  minimum: "0",
  active: true,
});
export type PricingQuoteDraft = {
  financialId: string;
  clientId: string;
  serviceId: string;
  title: string;
  scope: PricingScope;
  description: string;
  hours: string;
  directCosts: string;
  travelDays: string;
  mode: PricingMode;
  unit: PricingUnit;
  hoursOrigin: PricingOrigin;
  costsOrigin: PricingOrigin;
  final: string;
  validUntil: string;
  ownCountry: string;
  ownDepartment: string;
  ownMunicipality: string;
};
export const emptyPricingQuote = (): PricingQuoteDraft => ({
  financialId: "",
  clientId: "",
  serviceId: "",
  title: "",
  scope: "standard",
  description: "",
  hours: "20",
  directCosts: "0",
  travelDays: "0",
  mode: "remote",
  unit: "project",
  hoursOrigin: "estimated",
  costsOrigin: "declared",
  final: "",
  validUntil: "",
  ownCountry: "Colombia",
  ownDepartment: "",
  ownMunicipality: "",
});
export type PricingSettingsDraft = {
  [K in keyof PricingParameters]: PricingParameters[K] extends boolean ? boolean : string;
};
export function settingsDraft(s: PricingParameters): PricingSettingsDraft {
  return Object.fromEntries(
    Object.entries(s).map(([k, v]) => [k, typeof v === "boolean" ? v : grouped(v)]),
  ) as PricingSettingsDraft;
}
export function readPricingSettings(d: PricingSettingsDraft): PricingParameters | null {
  const entries = Object.entries(d).map(([k, v]) => [
    k,
    typeof v === "boolean" ? v : parseNumber(v),
  ]);
  if (entries.some(([, v]) => v === null || (typeof v === "number" && v < 0))) return null;
  const s = Object.fromEntries(entries) as PricingParameters;
  if (s.confidenceMedium > s.confidenceHigh || s.confidenceHigh > 1 || s.outlierMultiplier <= 1)
    return null;
  if (
    s.billableHours < 0.01 ||
    s.rounding < 0.01 ||
    s.margin > 10 ||
    s.profitCap > 1 ||
    s.debtLow > s.debtHigh ||
    s.debtHigh > 1 ||
    s.marginLow > s.marginHigh ||
    s.healthMinimum < 0.5 ||
    s.healthMinimum > 1 ||
    !Number.isInteger(s.quoteMaxMonths) ||
    s.quoteMaxMonths < 1 ||
    s.projectWeight + s.capacityWeight + s.marketWeight <= 0
  )
    return null;
  return s;
}
export function pricingClientProblems(d: PricingClientDraft): string[] {
  const problems = fieldProblems([
    { label: "ingreso mensual", value: d.monthlyIncome, kind: "amount" },
    { label: "creación", value: d.foundedAt, kind: "date" },
  ]);
  if (!d.name.trim() || !d.country.trim()) problems.push("Faltan el nombre y el país del cliente.");
  const stratum = parseNumber(d.stratum);
  if (
    d.stratum.trim() &&
    (stratum === null || !Number.isInteger(stratum) || stratum < 0 || stratum > 6)
  )
    problems.push("El estrato va de 0 a 6; 0 significa sin estrato.");
  if (d.monthlyIncome.trim() && d.incomeOrigin === "missing")
    problems.push("Indica el origen del ingreso.");
  return problems;
}
export function pricingQuoteProblems(d: PricingQuoteDraft, saving = true): string[] {
  const problems = fieldProblems([
    { label: "horas", value: d.hours, kind: "amount" },
    { label: "costos directos", value: d.directCosts, kind: "amount" },
    { label: "días", value: d.travelDays, kind: "amount" },
    { label: "precio final", value: d.final, kind: "amount" },
    { label: "vigencia", value: d.validUntil, kind: "date" },
  ]);
  if (!d.clientId || !d.serviceId) problems.push("Elige cliente y servicio.");
  if (saving && !d.title.trim()) problems.push("Escribe un título para guardar la cotización.");
  if (
    parseNumber(d.directCosts) === null ||
    (d.mode !== "remote" && parseNumber(d.travelDays) === null)
  )
    problems.push(
      "Registra costos directos y días de desplazamiento; escribe cero cuando no existen.",
    );
  if ((parseNumber(d.hours) ?? 0) <= 0 || (d.unit === "hour" && parseNumber(d.hours) !== 1))
    problems.push("Indica horas mayores que cero; por hora utiliza 1 hora.");
  if (d.hoursOrigin === "missing" || d.costsOrigin === "missing")
    problems.push("Indica el origen de las horas y los costos.");
  return problems;
}
export function quoteInput(
  d: PricingQuoteDraft,
  service: { minimum: number; incomePercent: number },
  client: { monthlyIncome: number | null; incomeOrigin: PricingOrigin },
): PricingInput {
  return {
    hours: parseNumber(d.hours) ?? 1,
    directCosts: parseNumber(d.directCosts) ?? 0,
    travelDays: parseNumber(d.travelDays) ?? 0,
    mode: d.mode,
    unit: d.unit,
    minimum: service.minimum,
    incomePercent: service.incomePercent,
    monthlyIncome: client.monthlyIncome,
    incomeOrigin: client.monthlyIncome === null ? "missing" : client.incomeOrigin,
    hoursOrigin: d.hoursOrigin,
    costsOrigin: d.costsOrigin,
    capacity: null,
    capacityOrigin: "missing",
    market: null,
    marketOrigin: "missing",
  };
}

export const financialFields = [
  "assets",
  "currentAssets",
  "liabilities",
  "currentLiabilities",
  "equity",
  "revenue41",
  "revenue42",
  "expense51",
  "expense52",
  "expense53",
  "expense54",
  "cost61",
  "purchases62",
  "class7",
  "depreciation",
  "inventoryStart",
  "inventoryEnd",
  "combinedDeductions",
] as const;
export type FinancialField = (typeof financialFields)[number];
export type PricingFinancialDraft = Omit<PricingFinancial, FinancialField> & {
  id: string;
  clientId: string;
} & Record<FinancialField, string>;
export type PricingTierDraft = {
  fromIncome: string;
  toIncome: string;
  percent: string;
  minimum: string;
  maximum: string;
};

export function readPricingTiers(drafts: PricingTierDraft[]): PricingTierInput[] | null {
  const tiers: PricingTierInput[] = [];
  for (const draft of drafts) {
    const fromIncome = parseNumber(draft.fromIncome);
    const toIncome = parseNumber(draft.toIncome);
    const percent = parseNumber(draft.percent);
    const minimum = parseNumber(draft.minimum);
    const maximum = parseNumber(draft.maximum);
    if (
      fromIncome === null ||
      fromIncome < 0 ||
      (draft.toIncome.trim() && toIncome === null) ||
      (toIncome !== null && toIncome <= fromIncome) ||
      percent === null ||
      percent < 0 ||
      percent > 1 ||
      minimum === null ||
      minimum < 0 ||
      maximum === null ||
      maximum < minimum
    )
      return null;
    tiers.push({ fromIncome, toIncome, percent, minimum, maximum });
  }
  if (
    !tiers.length ||
    tiers[0].fromIncome !== 0 ||
    tiers.at(-1)?.toIncome !== null ||
    tiers.some(
      (tier, index) => index < tiers.length - 1 && tier.toIncome !== tiers[index + 1].fromIncome,
    )
  )
    return null;
  return tiers;
}

/** A month-only validity lasts through its last day, not its first. */
export function pricingExpiryDay(value: string | null): string | null {
  if (!value) return null;
  const date = value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  if (!/^\d{4}(?:-\d{2})?$/.test(date)) return null;
  const year = Number(date.slice(0, 4));
  const month = date.length === 7 ? Number(date.slice(5, 7)) : 12;
  return `${year}-${String(month).padStart(2, "0")}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}`;
}
export type PricingReminderInput = {
  id: string;
  title: string;
  client: string;
  status: PricingStatus;
  sentOn: string | null;
  validUntil: string | null;
};
export function pricingReminders(rows: PricingReminderInput[], today: string) {
  const daysBetween = (from: string, to: string) =>
    Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
  const followUps = rows
    .flatMap((r) => {
      const days = r.sentOn ? daysBetween(r.sentOn, today) : null;
      return r.status === "sent" && days !== null && days > 7
        ? [{ id: r.id, title: r.title, client: r.client, days }]
        : [];
    })
    .sort((a, b) => b.days - a.days);
  const expiring = rows
    .flatMap((r) => {
      const until = pricingExpiryDay(r.validUntil);
      const days = until ? daysBetween(today, until) : null;
      return (r.status === "draft" || r.status === "sent") &&
        days !== null &&
        days >= 0 &&
        days <= 3
        ? [{ id: r.id, title: r.title, client: r.client, days }]
        : [];
    })
    .sort((a, b) => a.days - b.days);
  return { followUps, expiring };
}
