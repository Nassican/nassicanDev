import assert from "node:assert/strict";
import { test } from "node:test";
import {
  emptyMarketQuote,
  marketComparables,
  marketStats,
  marketSelectionFromParams,
  marketSelectionForService,
  marketSelectionOptions,
  marketRegionComparison,
  median,
  type MarketQuoteInput,
} from "./pricing-market";
const quote = (patch: Partial<MarketQuoteInput> = {}): MarketQuoteInput => ({
  ...emptyMarketQuote(),
  id: "q",
  serviceId: "web",
  price: 100000,
  provider: "Proveedor",
  description: "Sitio",
  date: "2026-10",
  clientCountry: null,
  clientDepartment: null,
  clientMunicipality: null,
  url: null,
  ...patch,
});
const request = {
  serviceId: "web",
  scope: "standard" as const,
  unit: "project" as const,
  mode: "remote" as const,
  location: { country: "Colombia", department: "", municipality: "" },
  today: "2026-10-27",
  maxMonths: 18,
};
test("comparables require same service, scope and unit", () => {
  const r = marketComparables(
    [
      quote(),
      quote({ id: "other", serviceId: "other" }),
      quote({ id: "scope", scope: "advanced" }),
      quote({ id: "unit", unit: "monthly" }),
    ],
    request,
    null,
  );
  assert.equal(r.count, 1);
  assert.ok(r.notes.some((n) => n.includes("alcance")));
  assert.ok(r.notes.some((n) => n.includes("unidad")));
});
test("USD uses official TRM, EUR without a rate is excluded", () => {
  const r = marketComparables(
    [quote({ price: 100, currency: "USD" }), quote({ id: "eur", currency: "EUR" })],
    request,
    { value: 4000, date: "2026-10-27" },
  );
  assert.equal(r.mean, 400000);
  assert.equal(r.count, 1);
  assert.ok(r.notes.some((n) => n.includes("EUR")));
  assert.equal(marketComparables([quote({ currency: "USD" })], request, null).count, 0);
});
test("client/source regional factor ratio adjusts each comparable", () => {
  const r = marketComparables([quote({ country: "Otra" })], request, null, (l) => ({
    factor: l.country === "Colombia" ? 1.2 : 0.8,
    origin: "observed",
    level: "país",
    explanation: "observado",
  }));
  assert.equal(r.mean, 150000);
  assert.equal(r.origin, "observed");
});
test("old and other-mode references are explicitly flagged", () => {
  const r = marketComparables([quote({ date: "2020", mode: "onsite" })], request, null);
  assert.ok(r.notes.some((n) => n.includes("18 meses")));
  assert.ok(r.notes.some((n) => n.includes("modalidad")));
});
test("statistics report outlier median without silently replacing the mean", () => {
  assert.deepEqual(marketStats([100, 100, 1000]), {
    count: 3,
    mean: 400,
    minimum: 100,
    maximum: 1000,
    median: 100,
    outlier: true,
  });
  assert.equal(median([2, 1, 4, 3]), 2.5);
  assert.equal(median([]), null);
});
test("unknown regions and estimates never become observed evidence", () => {
  assert.equal(marketComparables([quote({ country: "Otra" })], request, null).origin, "estimated");
  assert.equal(
    marketComparables([quote({ origin: "estimated" })], request, null).origin,
    "estimated",
  );
});

test("market opens a service and scope with references while explicit URL filters survive", () => {
  const services = [
    { id: "empty", unit: "hour" as const },
    { id: "web", unit: "project" as const },
  ];
  const quotes = [quote({ scope: "basic" })];
  assert.deepEqual(marketSelectionFromParams(services, quotes, {}), {
    serviceId: "web",
    scope: "basic",
    unit: "project",
    mode: "remote",
  });
  assert.equal(
    marketSelectionFromParams(services, quotes, { scope: "advanced" }).scope,
    "advanced",
  );
  assert.equal(marketSelectionFromParams(services, quotes, { serviceId: "" }).serviceId, "");
});

test("changing service selects an available combination or its billing unit without references", () => {
  const services = [
    { id: "web", unit: "project" as const },
    { id: "support", unit: "monthly" as const },
  ];
  const preferred = {
    serviceId: "support",
    scope: "advanced" as const,
    unit: "monthly" as const,
    mode: "hybrid" as const,
  };
  const quotes = [
    quote({ scope: "basic" }),
    quote({ id: "advanced", scope: "advanced", mode: "hybrid" }),
  ];
  assert.deepEqual(marketSelectionForService("web", services, quotes, preferred), {
    serviceId: "web",
    scope: "advanced",
    unit: "project",
    mode: "hybrid",
  });
  assert.equal(marketSelectionForService("support", services, quotes).unit, "monthly");
});

test("regional statistics exclude future dates, different scope, unit, mode and unconvertible money", () => {
  const quotes = [
    quote(),
    quote({ id: "usd", price: 100, currency: "USD" }),
    quote({ id: "future", date: "2027-01" }),
    quote({ id: "basic", scope: "basic" }),
    quote({ id: "monthly", unit: "monthly" }),
    quote({ id: "onsite", mode: "onsite" }),
    quote({ id: "eur", currency: "EUR" }),
  ];
  const compared = marketRegionComparison(quotes, request, { value: 4000, date: request.today });
  assert.equal(compared.count, 2);
  assert.equal(compared.groups[0].mean, 250000);
  assert.equal(compared.groups[0].median, 250000);
  assert.ok(compared.notes.some((n) => n.includes("futura")));
  assert.ok(compared.notes.some((n) => n.includes("EUR")));
  assert.equal(marketRegionComparison(quotes, request, null).count, 1);
});

test("regional groups use the client's location and fold accents without adjusting the recorded price", () => {
  const compared = marketRegionComparison(
    [
      quote({
        id: "client",
        country: "Otra",
        clientCountry: "Colombia",
        clientDepartment: "Nariño",
        clientMunicipality: "Pasto",
      }),
      quote({ id: "same", department: "NARINO", municipality: "PASTO", price: 300000 }),
      quote({ id: "bogota", department: "Bogotá", municipality: "Bogotá", price: 500000 }),
    ],
    request,
    null,
  );
  assert.equal(compared.groups.length, 2);
  assert.equal(compared.groups[0].count, 2);
  assert.equal(compared.groups[0].mean, 200000);
  assert.equal(compared.groups[1].mean, 500000);
});

test("available combinations explain references hidden by the applied filters", () => {
  const options = marketSelectionOptions(
    [
      quote({ id: "one", scope: "basic" }),
      quote({ id: "two", scope: "basic" }),
      quote({ id: "onsite", mode: "onsite" }),
      quote({ id: "other", serviceId: "other" }),
    ],
    "web",
  );
  assert.equal(options.length, 2);
  assert.equal(options[0].scope, "basic");
  assert.equal(options[0].count, 2);
  assert.equal(options[1].mode, "onsite");
});
