import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculatePricing,
  defaultPricingParameters as settings,
  scaleMoney,
  divideMoney,
  roundPricingAmount,
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
test("family pricing discounts only fees and preserves direct costs and travel", () => {
  const r = calculatePricing(
    {
      ...input(),
      family: true,
      hours: 10,
      directCosts: 10000,
      mode: "onsite",
      travelDays: 1,
    },
    {
      ...settings,
      targetIncome: 1000000,
      fixedCosts: 0,
      billableHours: 100,
      margin: 1,
      rounding: 1,
      familyRounding: 1,
      transport: 5000,
      projectWeight: 1,
      capacityWeight: 0,
      marketWeight: 0,
    },
  );
  assert.equal(r.family?.normal, 210000);
  assert.equal(r.family?.fee, 195000);
  assert.equal(r.family?.discount, 39000);
  assert.equal(r.suggested, 171000);
  assert.ok(
    r.explanation.some((line) => line.includes("costos directos") && line.includes("viáticos")),
  );
});
test("a full family discount reaches zero despite the cost floor and rounding", () => {
  const r = calculatePricing(
    { ...input(), family: true, minimum: 1500001 },
    { ...settings, familyDiscount: 1, rounding: 1000 },
  );
  assert.equal(r.suggested, 0);
  assert.equal(r.family?.discount, r.family?.normal);
  assert.equal(r.family?.limitedByFloor, false);
  assert.equal(r.family?.unrestricted, true);
  assert.ok(r.warnings.some((line) => line.includes("descuento se aplica completo")));
});
test("a fractional family discount is complete, with an additional downward adjustment", () => {
  const r = calculatePricing(
    { ...input(), family: true, minimum: 2000001 },
    { ...settings, familyDiscount: 0.125, rounding: 1000 },
  );
  assert.equal(r.family?.normal, 2001000);
  assert.equal(r.family?.percentageDiscount, 250125);
  assert.equal(r.family?.roundingDiscount, 750875);
  assert.equal(r.family?.discount, 1001000);
  assert.equal(r.suggested, 1000000);
  assert.ok(r.suggested < r.floor);
});
test("a full family discount preserves only direct costs and travel", () => {
  const r = calculatePricing(
    {
      ...input(),
      family: true,
      minimum: 1500001,
      directCosts: 34225,
      mode: "onsite",
      travelDays: 2,
    },
    { ...settings, familyDiscount: 1, transport: 5000, rounding: 1000 },
  );
  assert.equal(r.suggested, 44225);
  assert.ok(r.suggested < r.floor);
});
test("zero percentage still applies the chosen family downward rounding", () => {
  const normal = calculatePricing(input(), settings);
  const family = calculatePricing({ ...input(), family: true }, { ...settings, familyDiscount: 0 });
  assert.equal(normal.family, undefined);
  assert.ok(family.suggested <= normal.suggested);
  assert.equal(family.family?.percentageDiscount, 0);
  assert.equal(family.family?.discount, normal.suggested - family.suggested);
});
test("family pricing is deterministic and does not compound when recalculated", () => {
  const draft = { ...input(), family: true };
  const first = calculatePricing(draft, settings);
  assert.deepEqual(calculatePricing(draft, settings), first);
  assert.equal(calculatePricing(input(), settings).suggested, first.family?.normal);
});
test("family percentages outside the allowed range fail in the engine", () => {
  for (const familyDiscount of [-0.1, 1.01, NaN, Infinity])
    assert.throws(() =>
      calculatePricing({ ...input(), family: true }, { ...settings, familyDiscount }),
    );
});
test("family percentage is entered as 0 to 100 with es-CO decimal support", () => {
  const draft = settingsDraft(settings);
  assert.equal(draft.familyDiscount, "20");
  assert.equal(readPricingSettings({ ...draft, familyDiscount: "12,5" })?.familyDiscount, 0.125);
  assert.equal(readPricingSettings({ ...draft, familyDiscount: "0" })?.familyDiscount, 0);
  assert.equal(readPricingSettings({ ...draft, familyDiscount: "100" })?.familyDiscount, 1);
  assert.equal(readPricingSettings({ ...draft, familyDiscount: "20 %" })?.familyDiscount, 0.2);
  for (const familyDiscount of ["", "-1", "100,1", "familia"])
    assert.equal(readPricingSettings({ ...draft, familyDiscount }), null);
});
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
  assert.equal(r.suggested, 2100000);
  assert.ok(r.explanation.every(Boolean));
});
test("missing criteria redistribute all their weight to project", () => {
  const r = calculatePricing(input(), settings);
  assert.equal(r.contributions.length, 1);
  assert.equal(r.contributions[0].weight, 1);
  assert.equal(r.suggested, 1900000);
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
    pricingClientProblems({
      ...emptyPricingClient(),
      name: "Ana",
      stratum: "0",
    }),
    [],
  );
  assert.equal(readPricingSettings({ ...settingsDraft(settings), rounding: "0" }), null);
  assert.equal(readPricingSettings({ ...settingsDraft(settings), familyRounding: "0" }), null);
});

test("commercial rounding matches the requested examples and handles exact multiples", () => {
  assert.equal(roundPricingAmount(9386000, 100000).amount, 9400000);
  assert.equal(roundPricingAmount(9386000, 500000).amount, 9500000);
  assert.equal(roundPricingAmount(9386000, 1000000, true).amount, 9000000);
  assert.equal(roundPricingAmount(9000000, 1000000, true).amount, 9000000);
  assert.equal(roundPricingAmount(9000000, 100000).amount, 9000000);
  assert.equal(roundPricingAmount(0, 1000000, true).amount, 0);
});

test("complete quote examples round the normal total upward and the discounted family total downward", () => {
  const normal = calculatePricing({ ...input(), minimum: 9386000 }, settings);
  assert.equal(normal.suggested, 9400000);
  const family = calculatePricing(
    { ...input(), family: true, minimum: 11732500 },
    { ...settings, rounding: 1 },
  );
  assert.equal(family.family!.normal - family.family!.percentageDiscount!, 9386000);
  assert.equal(family.suggested, 9000000);
});

test("small prices scale down the step instead of collapsing a fee to zero", () => {
  assert.deepEqual(roundPricingAmount(42350, 1000000, true), { amount: 42000, step: 1000 });
  assert.equal(roundPricingAmount(0.35, 1000000, true).amount, 0.35);
  assert.throws(() => roundPricingAmount(100, 0));
  assert.throws(() => roundPricingAmount(100, NaN));
});

test("family rounding protects expenses even if the total is below its rounding step", () => {
  const result = calculatePricing({ ...input(), family: true, directCosts: 1234567 }, settings);
  assert.ok(result.suggested >= 1234567);
  assert.ok(result.family!.roundingDiscount! >= 0);
  assert.equal(
    result.family!.discount,
    result.family!.percentageDiscount! + result.family!.roundingDiscount!,
  );
});
