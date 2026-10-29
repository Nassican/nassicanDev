import assert from "node:assert/strict";
import { test } from "node:test";
import {
  emptyFinancial,
  readFinancial,
  financialAnalysis,
  companyCapacity,
} from "./pricing-financial";
import { defaultPricingParameters as p } from "./pricing-engine";
const f = () =>
  readFinancial({
    ...emptyFinancial("client"),
    start: "2025",
    end: "2025",
    annual: false,
    revenue41: "100.000.000",
    expense51: "10.000.000",
    expense52: "5.000.000",
    cost61: "70.000.000",
    assets: "100.000.000",
    liabilities: "50.000.000",
  });
const tiers = [{ fromIncome: 0, toIncome: null, percent: 0.01, minimum: 0, maximum: 100000000 }];
test("financial input automatically saves equity from assets minus liabilities, including zero and negatives", () => {
  for (const [assets, liabilities, expected] of [
    ["10.000.000", "3.000.000", 7000000],
    ["0", "0", 0],
    ["0", "1.234,50", -1234.5],
  ] as const)
    assert.equal(
      readFinancial({ ...emptyFinancial("client"), assets, liabilities, equity: "999" }).equity,
      expected,
    );
  assert.equal(
    readFinancial({ ...emptyFinancial("client"), assets: "0", equity: "-250" }).equity,
    -250,
  );
  assert.equal(readFinancial(emptyFinancial("client")).equity, null);
});
test("61 is final: neither purchases62 nor class7 may be subtracted with it", () => {
  const r = financialAnalysis({ ...f(), purchases62: 999999, class7: 888888 }, p);
  assert.equal(r.cost, 70000000);
  assert.equal(r.profit, 15000000);
  assert.equal(r.costOrigin, "observed");
});
test("61 equal to zero is present, not a fallback", () =>
  assert.equal(financialAnalysis({ ...f(), cost61: 0, purchases62: 100 }, p).cost, 0));
test("without 61, inventories plus 62 give an estimated cost", () => {
  const r = financialAnalysis(
    { ...f(), cost61: null, inventoryStart: 20, purchases62: 100, inventoryEnd: 30, class7: 500 },
    p,
  );
  assert.equal(r.cost, 90);
  assert.equal(r.costOrigin, "estimated");
});
test("without inventories, 62 alone is estimated", () =>
  assert.equal(
    financialAnalysis({ ...f(), cost61: null, purchases62: 100, class7: 500 }, p).cost,
    100,
  ));
test("without 61 or 62, class7 alone is estimated", () =>
  assert.equal(financialAnalysis({ ...f(), cost61: null, class7: 500 }, p).cost, 500));
test("disabled fallback does not invent zero or add 7 to 62", () => {
  assert.equal(
    financialAnalysis(
      { ...f(), cost61: null, purchases62: 100, class7: 500 },
      { ...p, usePurchases: false },
    ).cost,
    null,
  );
  assert.equal(
    financialAnalysis({ ...f(), cost61: null, class7: 500 }, { ...p, useClass7: false }).cost,
    null,
  );
});
test("missing cost or operating expenses leave profit unknown", () => {
  assert.equal(financialAnalysis({ ...f(), cost61: null }, p).profit, null);
  assert.equal(financialAnalysis({ ...f(), expense51: null }, p).profit, null);
});
test("tax form 210 deducts its single line exactly once", () =>
  assert.equal(
    financialAnalysis({ ...f(), format: "210", combinedDeductions: 50000000 }, p).profit,
    50000000,
  ));
test("monthly operational income and annual division use 41, not 42", () => {
  assert.equal(
    companyCapacity(
      {
        ...f(),
        annual: true,
        revenue41: 18000000000,
        revenue42: 50000000,
        cost61: 14000000000,
        expense51: 1000000000,
        expense52: 1000000000,
      },
      tiers,
      p,
    ).amount,
    15000000,
  );
  assert.equal(companyCapacity(f(), tiers, p).amount, 1000000);
});
test("profit cap lowers 15M to 9M for a 3% operating margin", () => {
  const r = companyCapacity(
    { ...f(), revenue41: 1500000000, cost61: 1455000000, expense51: 0, expense52: 0 },
    tiers,
    p,
  );
  assert.equal(r.amount, 9000000);
  assert.ok(r.warnings.some((w) => w.includes("tope")));
});
for (const [debt, expected] of [
  [0.6, 1],
  [0.7, 0.85],
  [0.9, 0.7],
] as const)
  test(`debt ${debt} applies ${expected}`, () => {
    assert.equal(financialAnalysis({ ...f(), liabilities: 100000000 * debt }, p).health, expected);
  });
test("negative equity uses 0.5 and requires advance milestones", () => {
  const r = financialAnalysis({ ...f(), liabilities: 120000000 }, p);
  assert.equal(r.health, 0.5);
  assert.ok(r.warnings.some((w) => w.includes("hitos con anticipo")));
});
for (const [cost, expected] of [
  [101000000, 0.7],
  [97000000, 0.85],
  [90000000, 1],
  [80000000, 1.1],
] as const)
  test(`operating margin cost ${cost} applies ${expected}`, () => {
    assert.equal(
      financialAnalysis({ ...f(), cost61: cost, expense51: 0, expense52: 0 }, p).health,
      expected,
    );
  });
test("liquidity multiplies the others, never below 0.5", () => {
  assert.equal(
    financialAnalysis({ ...f(), currentAssets: 50, currentLiabilities: 100 }, p).health,
    0.85,
  );
  assert.equal(
    financialAnalysis(
      {
        ...f(),
        liabilities: 120000000,
        currentAssets: 50,
        currentLiabilities: 100,
        cost61: 101000000,
      },
      p,
    ).health,
    0.5,
  );
});
test("high margin cannot pass the tier maximum and loss capacity is zero", () => {
  assert.equal(
    companyCapacity({ ...f(), cost61: 0 }, [{ ...tiers[0], maximum: 1000000 }], p).amount,
    1000000,
  );
  assert.equal(companyCapacity({ ...f(), cost61: 101000000 }, tiers, p).amount, 0);
});
test("net and EBITDA are informational, equity inconsistency is visible", () => {
  const r = financialAnalysis(
    { ...f(), revenue42: 100, expense53: 20, expense54: 30, depreciation: 1000, equity: 1 },
    p,
  );
  assert.equal(r.net, 15000050);
  assert.equal(r.ebitda, 15001000);
  assert.ok(r.warnings.some((w) => w.includes("no cuadra")));
});
