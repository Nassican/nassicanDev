import assert from "node:assert/strict";
import { test } from "node:test";
import {
  resolveRegionFactor,
  regionFactorProblems,
  emptyRegionFactor,
  observedRegionalFactor,
  estimatedRegionalIncome,
  type RegionFactorInput,
} from "./pricing-geography";
import { emptyMarketQuote, type MarketQuoteInput } from "./pricing-market";
import { calculatePricing, defaultPricingParameters as settings } from "./pricing-engine";
import { emptyPricingQuote, quoteInput } from "./pricing-draft";
const location = { country: "Colombia", department: "Antioquia", municipality: "Medellín" };
const factor = (patch: Partial<RegionFactorInput>): RegionFactorInput => ({
  id: "f",
  country: "Colombia",
  department: "",
  municipality: "",
  serviceId: null,
  mode: "remote",
  factor: 1.1,
  origin: "manual",
  justification: "Muestra",
  date: "2026-10",
  ...patch,
});
test("regional cascade prefers municipality, then department, then country, then general", () => {
  const country = factor({});
  const department = factor({ department: "Antioquia", factor: 1.2 });
  const city = factor({ ...location, factor: 1.3 });
  assert.equal(
    resolveRegionFactor([country, department, city])(location, "web", "remote").factor,
    1.3,
  );
  assert.equal(
    resolveRegionFactor([country, department])(location, "web", "remote").level,
    "departamento",
  );
  assert.equal(resolveRegionFactor([country])(location, "web", "remote").level, "país");
  assert.equal(resolveRegionFactor([])(location, "web", "remote").origin, "missing");
});
test("service and mode are respected; manual provenance remains estimated", () => {
  const r = resolveRegionFactor([
    factor({ serviceId: "other", factor: 3 }),
    factor({ serviceId: "web", factor: 2 }),
  ]);
  assert.equal(r(location, "web", "remote").factor, 2);
  assert.equal(r(location, "web", "remote").origin, "estimated");
  assert.equal(r(location, "web", "onsite").factor, 1);
});
test("manual non-neutral factors require date and justification", () => {
  assert.ok(
    regionFactorProblems({ ...emptyRegionFactor(), factor: "1,2", date: "2026" }).some((p) =>
      p.includes("justificación"),
    ),
  );
  assert.deepEqual(
    regionFactorProblems({
      ...emptyRegionFactor(),
      factor: "1,2",
      date: "2026",
      justification: "Tres referencias",
    }),
    [],
  );
});
test("observed factor requires three independent comparables per region", () => {
  const base = {
    ...emptyMarketQuote(),
    serviceId: "web",
    price: 100,
    clientCountry: null,
    clientDepartment: null,
    clientMunicipality: null,
    url: null,
  };
  const rows: MarketQuoteInput[] = Array.from({ length: 6 }, (_, i) => ({
    ...base,
    id: String(i),
    ...location,
    municipality: i < 3 ? "Medellín" : "Bogotá",
    price: i < 3 ? 200 : 100,
  }));
  const selection = {
    serviceId: "web",
    scope: "standard" as const,
    unit: "project" as const,
    mode: "remote" as const,
  };
  const reference = { ...location, municipality: "Bogotá" };
  assert.equal(observedRegionalFactor(rows, location, reference, selection, null).factor, 2);
  assert.equal(
    observedRegionalFactor(rows.slice(1), location, reference, selection, null).factor,
    null,
  );
  assert.equal(
    observedRegionalFactor(
      rows.map((q) => ({ ...q, origin: "estimated" })),
      location,
      reference,
      selection,
      null,
    ).factor,
    null,
  );
});
test("stratum zero may use explicit municipality estimates", () => {
  const row = {
    id: "income",
    ...location,
    stratum: 0,
    income: 1500000,
    justification: "Declaraciones",
    date: "2026",
  };
  assert.equal(estimatedRegionalIncome([row], location, 0)?.income, 1500000);
  assert.equal(estimatedRegionalIncome([row], location, null), null);
});
test("travel affects onsite and hybrid floors, never the remote floor", () => {
  const input = quoteInput(
    { ...emptyPricingQuote(), travelDays: "2" },
    { minimum: 0, incomePercent: 0.1 },
    { monthlyIncome: null, incomeOrigin: "missing" },
  );
  const p = { ...settings, transport: 50000, lodging: 100000, food: 30000 };
  assert.equal(calculatePricing(input, p).travel, 0);
  assert.equal(calculatePricing({ ...input, mode: "onsite" }, p).travel, 360000);
  assert.equal(calculatePricing({ ...input, mode: "hybrid" }, p).floor, 1760000);
});
