import "server-only";

import { db, prismaJson } from "@nassican/db";
import type { PricingFinancial, PricingParameters, PricingSnapshot } from "@nassican/shared";
import { companyCapacity, financialAnalysis, financialOrigin } from "./pricing-financial";
import { financialFields, type PricingFinancialDraft } from "./pricing-draft";
import { marketComparables, type MarketQuoteDraft, type MarketQuoteInput } from "./pricing-market";
import { getTrm } from "./trm";
import { calendarDate } from "@nassican/shared";
import { getTimezone } from "./site-config";
import {
  estimatedRegionalIncome,
  resolveRegionFactor,
  type RegionFactorDraft,
  type RegionFactorInput,
  type IncomeEstimateDraft,
  type IncomeEstimateInput,
} from "./pricing-geography";
import { blankToNull, parseNumber } from "./draft-fields";
import {
  calculatePricing,
  defaultPricingParameters,
  scaleMoney,
  divideMoney,
} from "./pricing-engine";
import {
  emptyPricingClient,
  grouped,
  quoteInput,
  type PricingClientDraft,
  type PricingQuoteDraft,
  type PricingServiceDraft,
} from "./pricing-draft";
import { pricingReminders } from "./pricing-draft";

export async function getPricingParameters(): Promise<PricingParameters> {
  let row = await db.pricingSettings.findUnique({ where: { id: "singleton" } });
  if (!row)
    row = await db.pricingSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...defaultPricingParameters },
      update: {},
    });
  return Object.fromEntries(
    Object.entries(defaultPricingParameters).map(([key, value]) => [
      key,
      typeof value === "boolean"
        ? row[key as "useInventory" | "usePurchases" | "useClass7"]
        : Number(row[key as keyof typeof defaultPricingParameters]),
    ]),
  ) as PricingParameters;
}

export async function getPricingTiers() {
  const rows = await db.pricingTier.findMany({ orderBy: { fromIncome: "asc" } });
  if (rows.length)
    return rows.map((r) => ({
      id: r.id,
      fromIncome: Number(r.fromIncome),
      toIncome: r.toIncome === null ? null : Number(r.toIncome),
      percent: Number(r.percent),
      minimum: Number(r.minimum),
      maximum: Number(r.maximum),
    }));
  await db.pricingTier.createMany({
    data: [
      { fromIncome: 0, toIncome: 100000000, percent: 0.01, minimum: 0, maximum: 1000000 },
      { fromIncome: 100000000, toIncome: 1500000000, percent: 0.01, minimum: 0, maximum: 15000000 },
      { fromIncome: 1500000000, toIncome: null, percent: 0.01, minimum: 0, maximum: 100000000 },
    ],
    skipDuplicates: true,
  });
  return getPricingTiers();
}

export async function getPricingClients() {
  const rows = await db.pricingClient.findMany({
    orderBy: { name: "asc" },
    include: { signals: true },
  });
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    monthlyIncome: r.monthlyIncome === null ? null : Number(r.monthlyIncome),
  }));
}
export async function getPricingServices() {
  return (await db.pricingService.findMany({ orderBy: { name: "asc" } })).map((r) => ({
    ...r,
    typicalHours: Number(r.typicalHours),
    incomePercent: Number(r.incomePercent),
    minimum: Number(r.minimum),
  }));
}
export async function getPricingCalculator() {
  const [parameters, tiers, clients, services, financials, geography] = await Promise.all([
    getPricingParameters(),
    getPricingTiers(),
    getPricingClients(),
    getPricingServices(),
    getPricingFinancials(),
    getPricingGeography(),
  ]);
  return { parameters, tiers, clients, services, financials, geography };
}
export type PricingCalculatorView = Awaited<ReturnType<typeof getPricingCalculator>>;

export function clientDraft(
  row: Awaited<ReturnType<typeof getPricingClients>>[number],
): PricingClientDraft {
  return {
    ...emptyPricingClient(),
    id: row.id,
    name: row.name,
    type: row.type,
    country: row.country,
    department: row.department ?? "",
    municipality: row.municipality ?? "",
    zone: row.zone === "rural" ? "rural" : "urban",
    stratum: row.stratum === null ? "" : String(row.stratum),
    monthlyIncome: grouped(row.monthlyIncome),
    incomeOrigin: row.incomeOrigin,
    activity: row.activity ?? "",
    foundedAt: row.foundedAt ?? "",
    notes: row.notes ?? "",
  };
}
export async function savePricingClient(d: PricingClientDraft) {
  const data = {
    type: d.type,
    name: d.name.trim(),
    country: d.country.trim(),
    department: blankToNull(d.department),
    municipality: blankToNull(d.municipality),
    zone: d.zone,
    stratum: parseNumber(d.stratum),
    monthlyIncome: parseNumber(d.monthlyIncome),
    incomeOrigin: d.monthlyIncome.trim() ? d.incomeOrigin : ("missing" as const),
    activity: blankToNull(d.activity),
    foundedAt: blankToNull(d.foundedAt),
    notes: blankToNull(d.notes),
  };
  return d.id
    ? db.pricingClient.update({ where: { id: d.id }, data })
    : db.pricingClient.create({ data });
}
export async function savePricingService(d: PricingServiceDraft) {
  const data = {
    name: d.name.trim(),
    unit: d.unit,
    typicalHours: parseNumber(d.typicalHours) ?? 1,
    incomePercent: (parseNumber(d.incomePercent) ?? 0) / 100,
    minimum: parseNumber(d.minimum) ?? 0,
    active: d.active,
  };
  return d.id
    ? db.pricingService.update({ where: { id: d.id }, data })
    : db.pricingService.create({ data });
}

export async function pricingSnapshot(draft: PricingQuoteDraft): Promise<PricingSnapshot> {
  const [parameters, client, service, tiers, financials, marketQuotes, trm, timezone, geography] =
    await Promise.all([
      getPricingParameters(),
      db.pricingClient.findUniqueOrThrow({ where: { id: draft.clientId } }),
      db.pricingService.findUniqueOrThrow({ where: { id: draft.serviceId } }),
      getPricingTiers(),
      getPricingFinancials(draft.clientId),
      getMarketQuotes(),
      getTrm(),
      getTimezone(),
      getPricingGeography(),
    ]);
  if (!service.active) throw new Error("El servicio está inactivo.");
  const inputs = quoteInput(
    draft,
    { minimum: Number(service.minimum), incomePercent: Number(service.incomePercent) },
    {
      monthlyIncome: client.monthlyIncome === null ? null : Number(client.monthlyIncome),
      incomeOrigin: client.incomeOrigin,
    },
  );
  const financial =
    financials.find((f) => f.id === draft.financialId) ??
    (draft.financialId ? null : financials[0]) ??
    null;
  if (draft.financialId && !financial) throw new Error("El periodo no pertenece al cliente.");
  const notes: string[] = [];
  const explanation: string[] = [];
  let lowConfidence = false;
  if (financial && client.type === "company") {
    const capacity = companyCapacity(financial, tiers, parameters);
    inputs.capacity = capacity.amount;
    inputs.capacityOrigin = capacity.origin;
    inputs.monthlyIncome = null;
    notes.push(...capacity.warnings);
    explanation.push(...capacity.explanation);
    lowConfidence =
      capacity.analysis.costOrigin === "estimated" || capacity.analysis.monthlyProfit === null;
  } else if (financial && client.monthlyIncome === null) {
    const analysis = financialAnalysis(financial, parameters);
    inputs.monthlyIncome = analysis.monthlyRevenue;
    inputs.incomeOrigin = financialOrigin(financial);
    explanation.push(
      ...analysis.explanation,
      "Persona natural: la capacidad usa el ingreso bruto mensual del periodo y el porcentaje del servicio.",
    );
    notes.push(...analysis.warnings);
  }
  if (client.type === "company") {
    inputs.monthlyIncome = null;
    inputs.incomeOrigin = "missing";
    if (!financial) notes.push("Empresa sin periodo financiero: la capacidad queda sin dato.");
  }
  const location = {
    country: client.country,
    department: client.department ?? "",
    municipality: client.municipality ?? "",
  };
  const resolve = resolveRegionFactor(geography.factors);
  const regional = resolve(location, service.id, draft.mode);
  if (client.type === "person" && inputs.monthlyIncome === null) {
    const estimate = estimatedRegionalIncome(geography.incomes, location, client.stratum);
    if (estimate) {
      const source = resolve(estimate, service.id, draft.mode);
      inputs.monthlyIncome = divideMoney(
        scaleMoney(estimate.income, regional.factor),
        source.factor,
      );
      inputs.incomeOrigin = "estimated";
      explanation.push(
        `Ingreso estimado por estrato ${client.stratum}: ${estimate.income} × (${regional.factor} ÷ ${source.factor}) = ${inputs.monthlyIncome} COP al mes. ${estimate.justification} (${estimate.date}).`,
      );
    } else
      notes.push(
        "Sin ingreso conocido ni estimación configurada para el estrato y región: capacidad sin dato.",
      );
  }
  const market = marketComparables(
    marketQuotes,
    {
      serviceId: service.id,
      scope: draft.scope,
      unit: draft.unit,
      mode: draft.mode,
      location,
      today: calendarDate(timezone),
      maxMonths: parameters.quoteMaxMonths,
      outlierMultiplier: parameters.outlierMultiplier,
    },
    trm,
    resolve,
  );
  inputs.market = market.mean;
  inputs.marketOrigin = market.origin;
  notes.push(...market.notes);
  explanation.push(...market.explanation);
  const result = calculatePricing(inputs, parameters);
  result.explanation.push(...explanation);
  if (lowConfidence) {
    result.confidence = "low";
    result.explanation.push(
      "Confianza baja: el costo es estimado o falta utilidad para aplicar su tope.",
    );
  }
  return {
    version: 1,
    parameters,
    inputs,
    result,
    client: {
      name: client.name,
      type: client.type,
      stratum: client.stratum,
      zone: client.zone === "rural" ? "rural" : "urban",
      location,
    },
    providerLocation: {
      country: draft.ownCountry.trim(),
      department: draft.ownDepartment.trim(),
      municipality: draft.ownMunicipality.trim(),
    },
    service: { name: service.name, scope: draft.scope, description: draft.description.trim() },
    geography: regional,
    financial,
    tiers,
    marketEvidence: market.evidence,
    notes,
  };
}
export async function savePricingQuote(draft: PricingQuoteDraft, reviewed?: PricingSnapshot) {
  const snapshot = reviewed ?? (await pricingSnapshot(draft));
  const final = parseNumber(draft.final) ?? snapshot.result.suggested;
  return db.pricingQuote.create({
    data: {
      clientId: draft.clientId,
      serviceId: draft.serviceId,
      title: draft.title.trim(),
      snapshot: prismaJson.pricing(snapshot),
      suggested: snapshot.result.suggested,
      final,
      currency: "COP",
      unit: draft.unit,
      validUntil: blankToNull(draft.validUntil),
    },
  });
}
export async function listPricingQuotes() {
  const rows = await db.pricingQuote.findMany({ orderBy: { createdAt: "desc" }, take: 1000 });
  return rows.map((r) => ({
    ...r,
    suggested: Number(r.suggested),
    final: Number(r.final),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    sentAt: r.sentAt?.toISOString() ?? null,
  }));
}
export type PricingQuoteRow = Awaited<ReturnType<typeof listPricingQuotes>>[number];

export async function getPricingFinancials(clientId?: string) {
  const rows = await db.pricingClientFinancial.findMany({
    where: clientId ? { clientId } : {},
    orderBy: [{ end: "desc" }, { start: "desc" }],
  });
  return rows.map(
    (r): PricingFinancial & { id: string; clientId: string } =>
      ({
        id: r.id,
        clientId: r.clientId,
        start: r.start,
        end: r.end,
        annual: r.annual,
        source: r.source,
        format: r.format === "niif" || r.format === "210" ? r.format : "puc",
        ...Object.fromEntries(financialFields.map((k) => [k, r[k] === null ? null : Number(r[k])])),
      }) as PricingFinancial & { id: string; clientId: string },
  );
}
export async function savePricingFinancial(d: PricingFinancialDraft, data: PricingFinancial) {
  const clean = { ...data, clientId: d.clientId };
  return d.id
    ? db.pricingClientFinancial.update({ where: { id: d.id, clientId: d.clientId }, data: clean })
    : db.pricingClientFinancial.create({ data: clean });
}

export async function getMarketQuotes(): Promise<
  (MarketQuoteInput & { serviceName: string; own: boolean })[]
> {
  const [rows, accepted] = await Promise.all([
    db.marketQuote.findMany({
      orderBy: { createdAt: "desc" },
      take: 1000,
      include: { service: { select: { name: true } } },
    }),
    db.pricingQuote.findMany({
      where: { status: "accepted" },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
  ]);
  return [
    ...rows.map((r) => ({ ...r, price: Number(r.price), serviceName: r.service.name, own: false })),
    ...accepted.map((r): MarketQuoteInput & { serviceName: string; own: boolean } => ({
      id: `own:${r.id}`,
      serviceId: r.serviceId,
      scope: r.snapshot.service.scope,
      description: r.snapshot.service.description,
      price: Number(r.final),
      unit: r.unit,
      currency: r.currency,
      provider: "Mi cotización aceptada",
      ...(r.snapshot.providerLocation ?? r.snapshot.client.location),
      clientCountry: r.snapshot.client.location.country,
      clientDepartment: r.snapshot.client.location.department,
      clientMunicipality: r.snapshot.client.location.municipality,
      mode: r.snapshot.inputs.mode,
      date: r.updatedAt.toISOString().slice(0, 10),
      source: "own",
      url: null,
      origin: "observed",
      serviceName: r.snapshot.service.name,
      own: true,
    })),
  ];
}
export async function saveMarketQuote(d: MarketQuoteDraft) {
  const data = {
    serviceId: d.serviceId,
    scope: d.scope,
    description: d.description.trim(),
    price: parseNumber(d.price) ?? 0,
    unit: d.unit,
    currency: d.currency,
    provider: d.provider.trim(),
    country: d.country.trim(),
    department: d.department.trim(),
    municipality: d.municipality.trim(),
    clientCountry: blankToNull(d.clientCountry),
    clientDepartment: blankToNull(d.clientDepartment),
    clientMunicipality: blankToNull(d.clientMunicipality),
    mode: d.mode,
    date: d.date.trim(),
    source: d.source,
    url: blankToNull(d.url),
    origin: d.origin,
  };
  return d.id
    ? db.marketQuote.update({ where: { id: d.id }, data })
    : db.marketQuote.create({ data });
}
export async function getPricingMarket() {
  const [quotes, services, parameters, trm, timezone, geography] = await Promise.all([
    getMarketQuotes(),
    getPricingServices(),
    getPricingParameters(),
    getTrm(),
    getTimezone(),
    getPricingGeography(),
  ]);
  return { quotes, services, parameters, trm, geography, today: calendarDate(timezone) };
}
export type PricingMarketView = Awaited<ReturnType<typeof getPricingMarket>>;

export async function getPricingGeography() {
  const [factorRows, incomeRows, places] = await Promise.all([
    db.pricingRegionFactor.findMany({ include: { region: true } }),
    db.pricingIncomeEstimate.findMany({ include: { region: true } }),
    db.geoPlace.findMany({ orderBy: [{ department: "asc" }, { municipality: "asc" }] }),
  ]);
  const factors: RegionFactorInput[] = factorRows.map((r) => ({
    id: r.id,
    serviceId: r.serviceId,
    mode: r.mode,
    factor: Number(r.factor),
    origin: r.origin,
    justification: r.justification,
    date: r.date,
    country: r.region.country,
    department: r.region.department,
    municipality: r.region.municipality,
  }));
  const incomes: IncomeEstimateInput[] = incomeRows.map((r) => ({
    id: r.id,
    stratum: r.stratum,
    income: Number(r.income),
    justification: r.justification,
    date: r.date,
    country: r.region.country,
    department: r.region.department,
    municipality: r.region.municipality,
  }));
  return { factors, incomes, places };
}
export async function getPricingRegions() {
  const [geography, services, quotes, trm, timezone] = await Promise.all([
    getPricingGeography(),
    getPricingServices(),
    getMarketQuotes(),
    getTrm(),
    getTimezone(),
  ]);
  return { ...geography, services, quotes, trm, today: calendarDate(timezone) };
}
export type PricingRegionsView = Awaited<ReturnType<typeof getPricingRegions>>;
async function regionFor(d: { country: string; department: string; municipality: string }) {
  const location = {
    country: d.country.trim(),
    department: d.department.trim(),
    municipality: d.municipality.trim(),
  };
  return db.pricingRegion.upsert({
    where: { country_department_municipality: location },
    create: location,
    update: {},
  });
}
export async function saveRegionFactor(
  d: RegionFactorDraft,
  origin: "observed" | "manual" = "manual",
) {
  const region = await regionFor(d);
  const data = {
    regionId: region.id,
    serviceId: blankToNull(d.serviceId),
    mode: d.mode,
    factor: parseNumber(d.factor) ?? 1,
    justification: d.justification.trim(),
    date: d.date.trim(),
    origin,
  };
  if (d.id)
    return {
      ...(await db.pricingRegionFactor.update({ where: { id: d.id }, data })),
      created: false,
    };
  const existing = await db.pricingRegionFactor.findFirst({
    where: { regionId: region.id, serviceId: data.serviceId, mode: data.mode },
  });
  const row = existing
    ? await db.pricingRegionFactor.update({ where: { id: existing.id }, data })
    : await db.pricingRegionFactor.create({ data });
  return { ...row, created: !existing };
}
export async function saveIncomeEstimate(d: IncomeEstimateDraft) {
  const region = await regionFor(d);
  const stratum = parseNumber(d.stratum) ?? 0;
  const data = {
    income: parseNumber(d.income) ?? 0,
    justification: d.justification.trim(),
    date: d.date.trim(),
  };
  if (d.id)
    return {
      ...(await db.pricingIncomeEstimate.update({
        where: { id: d.id },
        data: { regionId: region.id, stratum, ...data },
      })),
      created: false,
    };
  const existing = await db.pricingIncomeEstimate.findUnique({
    where: { regionId_stratum: { regionId: region.id, stratum } },
  });
  const row = await db.pricingIncomeEstimate.upsert({
    where: { regionId_stratum: { regionId: region.id, stratum } },
    create: { regionId: region.id, stratum, ...data },
    update: data,
  });
  return { ...row, created: !existing };
}

/** The conditional update takes the row lock before a work item is created.
 * Two accept clicks therefore produce one job; changing the final price races
 * against the same row and cannot leave the job with a different amount. */
export async function setPricingQuoteStatus(
  id: string,
  status: import("@nassican/shared").PricingStatus,
) {
  const evidence = await db.pricingQuote.findUniqueOrThrow({ where: { id } });
  return db.$transaction(async (tx) => {
    if (status !== "accepted") {
      const current = await tx.pricingQuote.findUniqueOrThrow({ where: { id } });
      if (current.status === "accepted" || current.projectId)
        return {
          ok: false as const,
          message:
            "Una cotización aceptada conserva su trabajo. Crea una nueva cotización para cambiar el acuerdo.",
        };
      const changed = current.status !== status;
      const updated = changed
        ? await tx.pricingQuote.updateMany({
            where: { id, status: current.status, projectId: null },
            data: { status, ...(status === "sent" ? { sentAt: new Date() } : {}) },
          })
        : { count: 0 };
      if (changed && !updated.count)
        return {
          ok: false as const,
          message: "La cotización cambió en otra operación. Actualiza la lista.",
        };
      return {
        ok: true as const,
        row: await tx.pricingQuote.findUniqueOrThrow({ where: { id } }),
        changed,
        projectCreated: false,
        client: evidence.snapshot.client.name,
      };
    }
    const claimed = await tx.pricingQuote.updateMany({
      where: { id, projectId: null },
      data: { status: "accepted" },
    });
    const current = await tx.pricingQuote.findUniqueOrThrow({ where: { id } });
    if (!claimed.count)
      return {
        ok: true as const,
        row: current,
        changed: false,
        projectCreated: false,
        client: evidence.snapshot.client.name,
      };
    const project = await tx.clientProject.create({
      data: {
        title: current.title,
        company: evidence.snapshot.client.name,
        clientId: current.clientId,
        amount: current.final,
        currency: current.currency,
        description:
          evidence.snapshot.service.description ||
          `Cotización aceptada: ${evidence.snapshot.service.name}.`,
        dueDate: null,
      },
    });
    const row = await tx.pricingQuote.update({ where: { id }, data: { projectId: project.id } });
    return {
      ok: true as const,
      row,
      changed: true,
      projectCreated: true,
      client: evidence.snapshot.client.name,
    };
  });
}

export async function pricingToday(today: string, timezone: string) {
  const rows = await db.pricingQuote.findMany({
    where: { status: { in: ["draft", "sent"] } },
    select: { id: true, title: true, snapshot: true, status: true, sentAt: true, validUntil: true },
  });
  return pricingReminders(
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      client: r.snapshot.client.name,
      status: r.status,
      sentOn: r.sentAt ? calendarDate(timezone, r.sentAt) : null,
      validUntil: r.validUntil,
    })),
    today,
  );
}
