import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyMarketQuote, type MarketQuoteInput } from "./pricing-market";
import {
  marketComparisonFromParams,
  marketComparisonOverview,
  marketMunicipalityOptions,
  type MarketComparisonFilters,
} from "./pricing-comparison";
import {
  pricingMapDepartments,
  pricingMapGeometry,
  pricingDepartmentCode,
  fullPricingMapViewport,
  zoomPricingMap,
  boundedPricingMapViewport,
  fitPricingMap,
  pricingMapOptions,
  PRICING_MAP_MAX_ZOOM,
} from "./pricing-map";

const places = [
  { code: "52001", departmentCode: "52", department: "NARIÑO", municipality: "PASTO" },
  { code: "52356", departmentCode: "52", department: "NARIÑO", municipality: "IPIALES" },
  { code: "05001", departmentCode: "05", department: "ANTIOQUIA", municipality: "MEDELLÍN" },
  { code: "11001", departmentCode: "11", department: "BOGOTÁ, D.C.", municipality: "BOGOTÁ, D.C." },
];
const all: MarketComparisonFilters = {
  serviceId: "all",
  scope: "all",
  unit: "all",
  mode: "all",
  departmentCode: "",
  municipalityCode: "",
};
const settings = { today: "2026-10-28", maxMonths: 18, outlierMultiplier: 3 };
const quote = (patch: Partial<MarketQuoteInput> = {}): MarketQuoteInput => ({
  ...emptyMarketQuote(),
  id: "q",
  serviceId: "web",
  provider: "Proveedor",
  description: "Alcance",
  price: 100000,
  date: "2026-10-28",
  url: "https://example.com",
  clientCountry: null,
  clientDepartment: null,
  clientMunicipality: null,
  ...patch,
});

test("national zone is a valid deep link and never includes local or foreign offers", () => {
  const filters = marketComparisonFromParams([], { departmentCode: "national" });
  assert.equal(filters.departmentCode, "national");
  const result = marketComparisonOverview(
    [
      quote(),
      quote({ id: "local", department: "Nariño", municipality: "Pasto" }),
      quote({ id: "foreign", country: "Ecuador" }),
      quote({ id: "future", date: "2027-01" }),
      quote({ id: "eur", currency: "EUR" }),
    ],
    filters,
    settings,
    null,
    places,
  );
  assert.equal(result.count, 1);
  assert.equal(result.rows[0].label, "Colombia");
  assert.equal(result.nationalCount, 1);
  assert.equal(result.rows[0].departmentCode, "");
});

test("municipality deep links require a municipality belonging to the selected department", () => {
  const valid = marketComparisonFromParams(
    [],
    { departmentCode: "52", municipalityCode: "52001" },
    places,
  );
  assert.equal(valid.municipalityCode, "52001");
  for (const params of [
    { departmentCode: "05", municipalityCode: "52001" },
    { departmentCode: "national", municipalityCode: "52001" },
    { departmentCode: "52", municipalityCode: "99999" },
    { municipalityCode: "52001" },
  ])
    assert.equal(marketComparisonFromParams([], params, places).municipalityCode, "");
});

test("municipality filtering never borrows a departmental, national or neighboring city's price", () => {
  const result = marketComparisonOverview(
    [
      quote({ id: "national" }),
      quote({ id: "department", department: "Nariño", price: 700000 }),
      quote({ id: "pasto", department: "NARINO", municipality: "Pasto", price: 100000 }),
      quote({ id: "ipiales", department: "Nariño", municipality: "Ipiales", price: 200000 }),
      quote({
        id: "foreign",
        country: "Ecuador",
        department: "Nariño",
        municipality: "Pasto",
        price: 300000,
      }),
    ],
    { ...all, departmentCode: "52", municipalityCode: "52001" },
    settings,
    null,
    places,
  );
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].mean, 100000);
  assert.equal(result.rows[0].municipalityCode, "52001");
  assert.equal(result.nationalCount, 1);
  assert.equal(result.allRows.length, 5);
});

test("municipality choices contain only eligible local data and update with conditions and department", () => {
  const quotes = [
    quote({ id: "pasto", department: "Nariño", municipality: "Pasto" }),
    quote({ id: "ipiales", department: "Nariño", municipality: "Ipiales", unit: "monthly" }),
    quote({ id: "future", department: "Nariño", municipality: "Pasto", date: "2027-01" }),
    quote({ id: "medellin", department: "Antioquia", municipality: "Medellín" }),
    quote({ id: "national" }),
  ];
  const combined = marketComparisonOverview(quotes, all, settings, null, places);
  assert.deepEqual(
    marketMunicipalityOptions(combined.allRows, "52", places).map((o) => o.value),
    ["52356", "52001"],
  );
  assert.equal(
    marketMunicipalityOptions(combined.allRows, "52", places).find((o) => o.value === "52001")
      ?.count,
    1,
  );
  assert.deepEqual(
    marketMunicipalityOptions(combined.allRows, "05", places).map((o) => o.value),
    ["05001"],
  );
  const monthly = marketComparisonOverview(
    quotes,
    { ...all, unit: "monthly" },
    settings,
    null,
    places,
  );
  assert.deepEqual(
    marketMunicipalityOptions(monthly.allRows, "52", places).map((o) => o.value),
    ["52356"],
  );
  assert.deepEqual(marketMunicipalityOptions(monthly.allRows, "05", places), []);
});

test("zone options expose availability and counts instead of hiding zero-data departments", () => {
  const options = pricingMapOptions(places, {
    "52": { available: true, detail: "4", optionLabel: "4 comparables" },
    "05": { available: false, detail: "0", optionLabel: "0 comparables" },
  });
  assert.equal(options.length, 33);
  assert.equal(options.find((o) => o.code === "52")?.optionLabel, "NARIÑO: 4 comparables");
  assert.equal(options.find((o) => o.code === "05")?.available, false);
  assert.equal(options.find((o) => o.code === "05")?.optionLabel, "ANTIOQUIA: 0 comparables");
  assert.equal(options.find((o) => o.code === "88")?.available, false);
});

test("zoom and pan stay within the country and selected departments fit without clipping", () => {
  const full = fullPricingMapViewport();
  let zoom = full;
  for (let i = 0; i < 30; i++) zoom = zoomPricingMap(zoom, 1.6);
  assert.ok(zoom.width >= full.width / PRICING_MAP_MAX_ZOOM);
  const west = boundedPricingMapViewport({ ...zoom, x: -10000, y: -10000 });
  assert.equal(west.x, 0);
  assert.equal(west.y, 0);
  const east = boundedPricingMapViewport({ ...zoom, x: 10000, y: 10000 });
  assert.equal(east.x + east.width, full.width);
  assert.equal(east.y + east.height, full.height);
  for (let i = 0; i < 30; i++) zoom = zoomPricingMap(zoom, 1 / 1.6);
  assert.deepEqual(zoom, full);
  for (const d of pricingMapDepartments(places)) {
    const view = fitPricingMap(d.bounds);
    assert.ok(view.x <= d.bounds[0] + 1e-6 && view.y <= d.bounds[1] + 1e-6);
    assert.ok(view.x + view.width >= d.bounds[0] + d.bounds[2] - 1e-6);
    assert.ok(view.y + view.height >= d.bounds[1] + d.bounds[3] - 1e-6);
  }
});
test("overview defaults to all combinations and preserves validated deep links", () => {
  assert.deepEqual(marketComparisonFromParams([{ id: "web" }], {}), all);
  const explicit = {
    serviceId: "web",
    scope: "advanced",
    unit: "hour",
    mode: "hybrid",
    departmentCode: "52",
    municipalityCode: "",
  };
  assert.deepEqual(marketComparisonFromParams([{ id: "web" }], explicit), explicit);
  assert.deepEqual(
    marketComparisonFromParams([], {
      serviceId: "missing",
      scope: "invalid",
      unit: "all",
      mode: ["onsite"],
      departmentCode: "bad",
    }),
    all,
  );
});
test("all means separate monetary groups for each service, scope, unit and modality", () => {
  const quotes = [
    quote(),
    quote({ id: "monthly", unit: "monthly", price: 300000 }),
    quote({ id: "hour", unit: "hour", price: 90000 }),
    quote({ id: "advanced", scope: "advanced", price: 5000000 }),
    quote({ id: "site", mode: "onsite", price: 400000 }),
    quote({ id: "hybrid", mode: "hybrid", price: 600000 }),
    quote({ id: "service", serviceId: "other", price: 800000 }),
  ];
  const result = marketComparisonOverview(quotes, all, settings, null, places);
  assert.equal(result.rows.length, 7);
  assert.equal(result.count, 7);
  for (const row of result.rows) {
    assert.equal(row.count, 1);
    assert.equal(row.mean, row.quotes[0].price);
  }
  const narrow = marketComparisonOverview(
    quotes,
    { ...all, serviceId: "web", unit: "hour" },
    settings,
    null,
    places,
  );
  assert.equal(narrow.rows.length, 1);
  assert.equal(narrow.rows[0].mean, 90000);
});
test("national references never become local map coverage and department selection stays local", () => {
  const result = marketComparisonOverview(
    [
      quote(),
      quote({ id: "pasto", department: "Nariño", municipality: "Pasto", price: 365000 }),
      quote({ id: "foreign", country: "Ecuador", department: "Nariño", price: 500000 }),
    ],
    { ...all, departmentCode: "52" },
    settings,
    null,
    places,
  );
  assert.equal(result.nationalCount, 1);
  assert.equal(result.rows.length, 1);
  assert.equal(result.count, 1);
  assert.equal(result.rows[0].mean, 365000);
  assert.equal(result.allRows.filter((r) => r.departmentCode === "52").length, 1);
});
test("sources follow eligible evidence, client location and provider counts, without duplicate providers", () => {
  const result = marketComparisonOverview(
    [
      quote({
        id: "one",
        provider: "Mismo",
        clientCountry: "Colombia",
        clientDepartment: "Nariño",
        clientMunicipality: "Pasto",
      }),
      quote({
        id: "two",
        provider: "MISMO",
        department: "NARIÑO",
        municipality: "PASTO",
        price: 300000,
      }),
      quote({
        id: "three",
        provider: "Otro",
        department: "Nariño",
        municipality: "Pasto",
        price: 200000,
      }),
      quote({ id: "future", date: "2026-11-01", department: "Nariño", municipality: "Pasto" }),
      quote({ id: "euro", currency: "EUR", department: "Nariño", municipality: "Pasto" }),
    ],
    all,
    settings,
    null,
    places,
  );
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].providers, 2);
  assert.equal(result.rows[0].count, 3);
  assert.equal(result.rows[0].median, 200000);
  assert.equal(result.rows[0].mean, 200000);
  assert.deepEqual(
    result.rows[0].quotes.map((q) => q.id),
    ["one", "two", "three"],
  );
  assert.equal(result.excluded, 2);
  assert.ok(result.notes.some((n) => n.includes("futura")));
});
test("USD conversion affects the group while source currency and old-date warnings remain visible", () => {
  const source = quote({ price: 100, currency: "USD", date: "2020" });
  const result = marketComparisonOverview(
    [source],
    all,
    settings,
    { value: 4000, date: "2026-10-28" },
    places,
  );
  assert.equal(result.rows[0].mean, 400000);
  assert.equal(result.rows[0].quotes[0].price, 100);
  assert.equal(result.rows[0].quotes[0].currency, "USD");
  assert.ok(result.notes.some((n) => n.includes("18 meses")));
  assert.equal(marketComparisonOverview([source], all, settings, null, places).count, 0);
});
test("reference geometry covers every department code, retains its license and fits its view box", () => {
  const departments = pricingMapDepartments(places);
  assert.equal(departments.length, 33);
  assert.equal(new Set(departments.map((d) => d.code)).size, 33);
  assert.equal(pricingMapGeometry.license, "ODbL 1.0");
  assert.ok(departments.some((d) => d.code === "88"));
  assert.equal(departments.find((d) => d.code === "52")?.name, "NARIÑO");
  for (const d of departments) {
    assert.match(d.path, /^M[0-9.,LZM]+$/);
    assert.ok(d.bounds.every(Number.isFinite));
    assert.ok(d.bounds[0] >= 0 && d.bounds[1] >= 0);
    assert.ok(d.bounds[0] + d.bounds[2] <= pricingMapGeometry.viewBox[2]);
    assert.ok(d.bounds[1] + d.bounds[3] <= pricingMapGeometry.viewBox[3]);
  }
});
test("map matches normalized Colombian departments only and recognizes Bogotá aliases", () => {
  assert.equal(
    pricingDepartmentCode(
      { country: "COLOMBIA", department: "Narino", municipality: "Pasto" },
      places,
    ),
    "52",
  );
  assert.equal(
    pricingDepartmentCode(
      { country: "Colombia", department: "Bogotá D.C.", municipality: "" },
      places,
    ),
    "11",
  );
  assert.equal(
    pricingDepartmentCode({ country: "Ecuador", department: "Nariño", municipality: "" }, places),
    "",
  );
  assert.equal(
    pricingDepartmentCode({ country: "Colombia", department: "", municipality: "Pasto" }, places),
    "",
  );
});
