import assert from "node:assert/strict";
import { test } from "node:test";
import {
  emptyMarketQuote,
  marketComparables,
  marketStats,
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
