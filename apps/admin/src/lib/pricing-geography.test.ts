import assert from "node:assert/strict";
import { test } from "node:test";
import {
  resolveRegionFactor,
  regionFactorProblems,
  emptyRegionFactor,
  observedRegionalFactor,
  estimatedRegionalIncome,
  resolveRegionalIncome,
  incomeCityOptions,
  type RegionFactorInput,
} from "./pricing-geography";
import { emptyMarketQuote, type MarketQuoteInput } from "./pricing-market";
import { calculatePricing, defaultPricingParameters as settings } from "./pricing-engine";
import { emptyPricingQuote, quoteInput } from "./pricing-draft";
const location = { country: "Colombia", department: "Antioquia", municipality: "Medellín" };
test("city selector distinguishes local stratum values, city averages and inherited references", () => {
  const places = [
    { code: "05001", departmentCode: "05", department: "Antioquia", municipality: "Medellín" },
    { code: "11001", departmentCode: "11", department: "Bogotá D.C.", municipality: "Bogotá D.C." },
    { code: "91001", departmentCode: "91", department: "Amazonas", municipality: "Leticia" },
  ];
  const base = {
    id: "national",
    country: "Colombia",
    department: "",
    municipality: "",
    stratum: null,
    income: 1000000,
    justification: "Source",
    date: "2025",
  };
  const options = incomeCityOptions(places, [
    base,
    { ...base, ...location, id: "medellin", income: 1929483 },
    { ...base, id: "bogota", department: "Bogotá D.C.", municipality: "Bogotá D.C.", stratum: 2 },
  ]);
  assert.equal(options.find((o) => o.code === "05001")?.label, "modelo con base municipio");
  assert.equal(options.find((o) => o.code === "05001")?.average?.income, 1929483);
  assert.deepEqual(options.find((o) => o.code === "11001")?.strata, [2]);
  assert.equal(options.find((o) => o.code === "91001")?.label, "modelo con base país");
});
test("saved local estimates add other municipalities and coverage updates without duplicating strata", () => {
  const place = {
    code: "05088",
    departmentCode: "05",
    department: "Antioquia",
    municipality: "Bello",
  };
  assert.equal(incomeCityOptions([place], []).length, 1);
  const record = {
    ...place,
    country: "Colombia",
    id: "one",
    stratum: 3,
    income: 1500000,
    justification: "Source",
    date: "2024",
  };
  const [city] = incomeCityOptions(
    [place],
    [
      record,
      { ...record, id: "two", department: "ANTIOQUIA", municipality: "BELLO", date: "2025" },
    ],
  );
  assert.deepEqual(city.strata, [3]);
  assert.equal(city.label, "1 estrato registrado; sin base para estimar");
});

test("Pasto missing strata receive distinct explicit commercial scenarios from its own base", () => {
  const pasto = { country: "Colombia", department: "Nariño", municipality: "Pasto" };
  const base = {
    ...pasto,
    id: "pasto",
    stratum: null,
    income: 1370170,
    date: "2025",
    justification: "DANE source",
  };
  const values = [1370000, 690000, 1030000, 1370000, 2060000, 3080000, 4110000];
  for (let stratum = 0; stratum <= 6; stratum++) {
    const estimate = resolveRegionalIncome([base], pasto, stratum)!;
    assert.equal(estimate.income, values[stratum]);
    assert.equal(estimate.modeled, true);
    assert.equal(estimate.baseline?.id, "pasto");
    assert.equal(estimate.date, "2025");
    assert.ok(estimate.justification.includes("no ingreso observado"));
    assert.ok(estimate.justification.includes("No proceden de una regresión"));
    assert.equal(estimatedRegionalIncome([base], pasto, stratum), null);
  }
  assert.equal(resolveRegionalIncome([base], pasto, null)?.income, 1370170);
});

test("models cascade city, department and country without borrowing another city's incomes", () => {
  const base = {
    id: "national",
    country: "Colombia",
    department: "",
    municipality: "",
    stratum: null,
    income: 1281590,
    date: "2025",
    justification: "source",
  };
  const department = { ...base, id: "department", department: "Nariño", income: 783314 };
  const city = { ...department, id: "city", municipality: "Pasto", income: 1370170 };
  const rows = [base, department, city];
  assert.equal(resolveRegionalIncome(rows, city, 2)?.baseline?.id, "city");
  assert.equal(
    resolveRegionalIncome(rows, { ...city, municipality: "Ipiales" }, 2)?.baseline?.id,
    "department",
  );
  assert.equal(
    resolveRegionalIncome(rows, { ...city, department: "Amazonas", municipality: "Leticia" }, 2)
      ?.baseline?.id,
    "national",
  );
  assert.equal(resolveRegionalIncome(rows, { ...city, country: "Ecuador" }, 2), null);
  assert.equal(resolveRegionalIncome([], city, 2), null);
  for (const invalid of [-1, 7, NaN, 2.5])
    assert.equal(resolveRegionalIncome(rows, city, invalid), null);
});

test("stored stratum references override scenarios and model results never masquerade as editable stored records", () => {
  const base = {
    ...location,
    id: "base",
    stratum: null,
    income: 1929483,
    date: "2025",
    justification: "DANE",
  };
  const manual = {
    ...base,
    id: "manual",
    stratum: 2,
    income: 1700000,
    date: "2024",
    justification: "Local reference",
  };
  const resolved = resolveRegionalIncome([base, manual], location, 2)!;
  assert.equal(resolved.id, "manual");
  assert.equal(resolved.income, 1700000);
  assert.equal(resolved.modeled, false);
  assert.equal(resolved.baseline, undefined);
  const before = JSON.stringify([base, manual]);
  resolveRegionalIncome([base, manual], location, 3);
  assert.equal(JSON.stringify([base, manual]), before);
  assert.equal(
    resolveRegionalIncome([base, { ...manual, municipality: "", id: "department" }], location, 2)
      ?.modeled,
    false,
  );
});
test("regional averages serve unknown strata and never stand in for a known stratum", () => {
  const baseline = {
    ...location,
    id: "base",
    stratum: null,
    income: 1500000,
    justification: "Regional per-capita proxy",
    date: "2025",
  };
  assert.equal(estimatedRegionalIncome([baseline], location, null)?.id, "base");
  for (let stratum = 0; stratum <= 6; stratum++)
    assert.equal(estimatedRegionalIncome([baseline], location, stratum), null);
  assert.equal(
    estimatedRegionalIncome(
      [baseline, { ...baseline, id: "specific", stratum: 2, income: 1800000 }],
      location,
      2,
    )?.id,
    "specific",
  );
});
test("a stratum estimate can inherit its region but never a different stratum or municipality", () => {
  const estimate = {
    ...location,
    municipality: "",
    id: "department",
    stratum: 2,
    income: 1800000,
    justification: "Department and stratum",
    date: "2024",
  };
  assert.equal(estimatedRegionalIncome([estimate], location, 2)?.id, "department");
  assert.equal(estimatedRegionalIncome([estimate], location, 3), null);
  assert.equal(estimatedRegionalIncome([estimate], location, null), null);
  assert.equal(estimatedRegionalIncome([{ ...estimate, municipality: "Otra" }], location, 2), null);
});
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
