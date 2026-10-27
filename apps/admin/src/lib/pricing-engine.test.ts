import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculatePricing,
  defaultPricingParameters as settings,
  scaleMoney,
  divideMoney,
} from "./pricing-engine";
import {
  emptyPricingQuote,
  pricingClientProblems,
  emptyPricingClient,
  quoteInput,
  readPricingSettings,
  settingsDraft,
} from "./pricing-draft";

const input = () =>
  quoteInput(
    emptyPricingQuote(),
    { minimum: 0, incomePercent: 0.1 },
    { monthlyIncome: null, incomeOrigin: "missing" },
  );
test("decimal cents and annual division retain precision on large amounts", () => {
  assert.equal(scaleMoney(1.005, 1), 1.01);
  assert.equal(divideMoney(18000000000, 12), 1500000000);
  assert.equal(divideMoney(1, 3), 0.33);
});
test("reference range is calculated before upward rounding", () => {
  const r = calculatePricing({ ...input(), directCosts: 34225 }, settings);
  assert.equal(r.range[1], r.project);
  assert.ok(r.suggested > r.range[1]);
});
test("floor includes costs and service minimum, including upward rounding", () => {
  const r = calculatePricing({ ...input(), minimum: 2000001 }, settings);
  assert.equal(r.floor, 2000001);
  assert.equal(r.suggested, 2010000);
  assert.ok(r.explanation.every(Boolean));
});
test("missing criteria redistribute all their weight to project", () => {
  const r = calculatePricing(input(), settings);
  assert.equal(r.contributions.length, 1);
  assert.equal(r.contributions[0].weight, 1);
  assert.equal(r.suggested, 1820000);
  assert.ok(r.warnings.some((w) => w.includes("repartieron")));
});
test("low capacity warns with three alternatives and never reduces floor", () => {
  const r = calculatePricing(
    { ...input(), monthlyIncome: 1000000, incomeOrigin: "declared" },
    settings,
  );
  assert.ok(r.suggested >= r.floor);
  assert.ok(
    r.warnings.some((w) => w.includes("cuotas") && w.includes("alcance") && w.includes("no tomes")),
  );
});
test("confidence counts evidence and missing inputs, not a flattering average", () => {
  assert.equal(calculatePricing(input(), settings).confidence, "low");
  assert.equal(
    calculatePricing({ ...input(), hoursOrigin: "observed", costsOrigin: "declared" }, settings)
      .confidence,
    "medium",
  );
  assert.equal(
    calculatePricing(
      {
        ...input(),
        hoursOrigin: "observed",
        costsOrigin: "declared",
        market: 2000000,
        marketOrigin: "observed",
      },
      settings,
    ).confidence,
    "high",
  );
});
test("Colombian grouped input, stratum zero, and invalid settings", () => {
  assert.equal(
    quoteInput(
      { ...emptyPricingQuote(), directCosts: "34.225" },
      { minimum: 0, incomePercent: 0.1 },
      { monthlyIncome: null, incomeOrigin: "missing" },
    ).directCosts,
    34225,
  );
  assert.deepEqual(
    pricingClientProblems({ ...emptyPricingClient(), name: "Ana", stratum: "0" }),
    [],
  );
  assert.equal(readPricingSettings({ ...settingsDraft(settings), rounding: "0" }), null);
});
