import "server-only";

import { db, prismaJson } from "@nassican/db";
import type { Prisma } from "@nassican/db";
import { composePricingPackage, composeQuoteServices } from "./pricing-package";
import type { PricingFinancial, PricingParameters, PricingSnapshot } from "@nassican/shared";
import { companyCapacity, financialAnalysis, financialOrigin } from "./pricing-financial";
import { financialFields, type PricingFinancialDraft } from "./pricing-draft";
import { marketComparables, type MarketQuoteDraft, type MarketQuoteInput } from "./pricing-market";
import { getTrm } from "./trm";
import { calendarDate } from "@nassican/shared";
import { getTimezone } from "./site-config";
import {
  regionalIncomeForLocation,
  resolveRegionFactor,
  type RegionFactorDraft,
  type RegionFactorInput,
  type IncomeEstimateDraft,
  type IncomeEstimateInput,
} from "./pricing-geography";
import { blankToNull, parseNumber } from "./draft-fields";
import { calculatePricing, defaultPricingParameters } from "./pricing-engine";
import {
  emptyPricingClient,
  grouped,
  quoteInput,
  pricingSelectedServiceIds,
  type PricingClientDraft,
  type PricingQuoteDraft,
  type PricingServiceDraft,
} from "./pricing-draft";
import { pricingReminders, defaultPricingTiers } from "./pricing-draft";
import { billingAvailable } from "./billing";
import { BillingInputError, billingMinor } from "./billing-values";

let roundingSchemaReady: Promise<boolean> | undefined;
export function pricingRoundingSchemaReady(): Promise<boolean> {
  return (roundingSchemaReady ??= db.$queryRaw<{ ready: boolean }[]>`
    SELECT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'pricing_settings'
      AND column_name = 'family_rounding') AS ready
  `
    .then((rows) => rows[0].ready)
    .catch((error) => {
      roundingSchemaReady = undefined;
      throw error;
    }));
}

export async function getPricingParameters(): Promise<PricingParameters> {
  const ready = await pricingRoundingSchemaReady();
  const omit = { familyRounding: !ready };
  let row = await db.pricingSettings.findUnique({ where: { id: "singleton" }, omit });
  if (!row)
    row = await db.pricingSettings.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        ...Object.fromEntries(
          Object.entries(defaultPricingParameters).filter(
            ([key]) => ready || key !== "familyRounding",
          ),
        ),
      },
      update: {},
      omit,
    });
  return Object.fromEntries(
    Object.entries(defaultPricingParameters).map(([key, value]) => [
      key,
      typeof value === "boolean"
        ? row[key as "useInventory" | "usePurchases" | "useClass7"]
        : !ready && (key === "familyRounding" || key === "rounding")
          ? value
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
    data: defaultPricingTiers,
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
const serviceInclude = {
  components: { include: { component: { include: { components: true } } } },
} as const;
type ServiceWithParts = Prisma.PricingServiceGetPayload<{ include: typeof serviceInclude }>;
function pricingServiceRow(r: ServiceWithParts) {
  const parts = r.components.map(({ component: c }) => ({
    id: c.id,
    name: c.name,
    unit: c.unit,
    typicalHours: Number(c.typicalHours),
    minimum: Number(c.minimum),
    incomePercent: Number(c.incomePercent),
    recommendedPrice: c.recommendedPrice === null ? null : Number(c.recommendedPrice),
    active: c.active,
    componentIds: c.components.map((p) => p.componentId),
  }));
  const composite = parts.length ? composePricingPackage(parts, r.unit, r.id) : null;
  return {
    ...r,
    typicalHours: composite?.typicalHours ?? Number(r.typicalHours),
    minimum: composite?.minimum ?? Number(r.minimum),
    incomePercent: composite?.incomePercent ?? Number(r.incomePercent),
    recommendedPrice:
      r.recommendedPrice === null
        ? (composite?.recommendedPrice ?? null)
        : Number(r.recommendedPrice),
    componentIds: parts.map((p) => p.id),
    components: parts,
  };
}
export async function getPricingServices() {
  return (
    await db.pricingService.findMany({ orderBy: { name: "asc" }, include: serviceInclude })
  ).map(pricingServiceRow);
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
  return {
    parameters,
    tiers,
    clients,
    services,
    financials,
    geography,
    roundingMigrationPending: !(await pricingRoundingSchemaReady()),
  };
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
  const [parts, parents, current] = await Promise.all([
    d.componentIds.length
      ? db.pricingService.findMany({
          where: { id: { in: d.componentIds } },
          include: serviceInclude,
        })
      : [],
    d.id ? db.pricingServiceComponent.count({ where: { componentId: d.id } }) : 0,
    d.id ? db.pricingService.findUniqueOrThrow({ where: { id: d.id } }) : null,
  ]);
  if (parts.length !== d.componentIds.length) throw new Error("Revisa los servicios del paquete.");
  if (parents && (!d.active || d.componentIds.length || current?.unit !== d.unit))
    throw new Error("Este servicio pertenece a un paquete: conserva su unidad y estado activo.");
  const composition = parts.length
    ? composePricingPackage(parts.map(pricingServiceRow), d.unit, d.id)
    : null;
  const data = {
    name: d.name.trim(),
    unit: d.unit,
    typicalHours: parseNumber(d.typicalHours) ?? 1,
    incomePercent: (parseNumber(d.incomePercent) ?? 0) / 100,
    minimum: parseNumber(d.minimum) ?? 0,
    active: d.active,
    description: blankToNull(d.description),
    recommendedPrice: parseNumber(d.recommendedPrice),
    ...(composition
      ? {
          typicalHours: composition.typicalHours,
          minimum: composition.minimum,
          incomePercent: composition.incomePercent,
          recommendedPrice: parseNumber(d.recommendedPrice) ?? composition.recommendedPrice,
        }
      : {}),
  };
  if (data.recommendedPrice !== null && data.recommendedPrice < data.minimum)
    throw new Error("El precio recomendado no puede quedar bajo el mínimo del servicio.");
  return db.$transaction(async (tx) => {
    const saved = d.id
      ? await tx.pricingService.update({ where: { id: d.id }, data })
      : await tx.pricingService.create({ data });
    await tx.pricingServiceComponent.deleteMany({ where: { packageId: saved.id } });
    if (d.componentIds.length)
      await tx.pricingServiceComponent.createMany({
        data: d.componentIds.map((componentId) => ({ packageId: saved.id, componentId })),
      });
    return saved;
  });
}

export async function pricingSnapshot(draft: PricingQuoteDraft): Promise<PricingSnapshot> {
  const serviceIds = pricingSelectedServiceIds(draft);
  const [parameters, client, services, tiers, financials, marketQuotes, trm, timezone, geography] =
    await Promise.all([
      getPricingParameters(),
      db.pricingClient.findUniqueOrThrow({ where: { id: draft.clientId } }),
      db.pricingService
        .findMany({ where: { id: { in: serviceIds } }, include: serviceInclude })
        .then((rows) => rows.map(pricingServiceRow)),
      getPricingTiers(),
      getPricingFinancials(draft.clientId),
      getMarketQuotes(),
      getTrm(),
      getTimezone(),
      getPricingGeography(),
    ]);
  const service = composeQuoteServices(serviceIds, services);
  const multipleServices = serviceIds.length > 1;
  if (multipleServices && draft.unit !== service.unit)
    throw new Error("Con varios servicios, conserva su unidad de cobro común.");
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
  if (service.components.length && inputs.hours !== service.typicalHours)
    notes.push(
      `Los servicios suman ${service.typicalHours} horas típicas; esta cotización usa ${inputs.hours} horas ajustadas al alcance. El mínimo de los componentes se conserva.`,
    );
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
  const factorServiceId = multipleServices ? "" : service.id;
  const regional = resolve(location, factorServiceId, draft.mode);
  if (client.type === "person" && inputs.monthlyIncome === null) {
    const incomeReference = regionalIncomeForLocation(
      geography.incomes,
      geography.factors,
      location,
      client.stratum,
      factorServiceId,
      draft.mode,
    );
    if (incomeReference) {
      const { estimate } = incomeReference;
      const source = resolve(estimate, factorServiceId, draft.mode);
      inputs.monthlyIncome = incomeReference.income;
      inputs.incomeOrigin = "estimated";
      if (estimate.modeled)
        notes.push(
          "El ingreso usa un escenario comercial por estrato, no una medición local. Confirma el presupuesto del cliente antes de acordar el precio.",
        );
      else if (estimate.stratum !== null)
        notes.push(
          `El ingreso estimado usa una referencia estadística de ${estimate.date}; no es un ingreso personal verificado. Revisa su fuente y año antes de cotizar.`,
        );
      explanation.push(
        `Ingreso de referencia regional${estimate.stratum === null ? " sin desagregación por estrato" : ` para estrato ${estimate.stratum}`}: ${estimate.income} × (${regional.factor} ÷ ${source.factor}) = ${inputs.monthlyIncome} COP al mes. ${estimate.justification} (${estimate.date}).`,
      );
    } else
      notes.push(
        "Sin ingreso conocido ni estimación configurada para el estrato y región: capacidad sin dato. El promedio regional no sustituye el ingreso de un estrato conocido.",
      );
  }
  const market = marketComparables(
    multipleServices ? [] : marketQuotes,
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
  if (multipleServices)
    notes.push(
      "Sin referencia conjunta de mercado para este alcance. El sugerido usa trabajo y capacidad; no se suman cotizaciones individuales como si fueran una oferta del conjunto.",
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
    service: {
      name: service.name,
      scope: draft.scope,
      description: draft.description.trim() || service.description || "",
      ...(multipleServices
        ? {
            selectedServices: service.selectedServices.map((s) => ({
              id: s.id,
              name: s.name,
              hours: s.typicalHours,
              minimum: s.minimum,
              recommendedPrice: s.recommendedPrice,
            })),
          }
        : {}),
      ...(service.components.length
        ? {
            components: service.components.map((p) => ({
              id: p.id,
              name: p.name,
              hours: p.typicalHours,
              minimum: p.minimum,
              recommendedPrice: p.recommendedPrice,
            })),
          }
        : {}),
    },
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
    ...accepted
      .filter((r) => (r.snapshot.service.selectedServices?.length ?? 1) <= 1)
      .map((r): MarketQuoteInput & { serviceName: string; own: boolean } => ({
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
  const stratum = parseNumber(d.stratum);
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
  const existing = await db.pricingIncomeEstimate.findFirst({
    where: { regionId: region.id, stratum },
  });
  const row = existing
    ? await db.pricingIncomeEstimate.update({ where: { id: existing.id }, data })
    : await db.pricingIncomeEstimate.create({ data: { regionId: region.id, stratum, ...data } });
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
  const billingReady = await billingAvailable();
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
    const billingPlan = billingReady
      ? await tx.billingPlan.findUnique({ where: { quoteId: id } })
      : null;
    if (
      billingPlan &&
      (billingMinor(billingPlan.amount.toString()) !== billingMinor(current.final.toString()) ||
        billingPlan.currency !== current.currency)
    )
      throw new BillingInputError(
        "El plan de cuotas no coincide con el precio final. Actualízalo antes de aceptar la cotización.",
      );
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
    if (billingPlan)
      await tx.billingPlan.update({
        where: { id: billingPlan.id },
        data: { projectId: project.id },
      });
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
