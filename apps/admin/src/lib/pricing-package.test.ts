import assert from "node:assert/strict";
import { test } from "node:test";
import {
  composePricingPackage,
  composeQuoteServices,
  type PricingPackagePart,
  type PricingQuoteService,
} from "./pricing-package";
import {
  emptyPricingQuote,
  pricingQuoteProblems,
  pricingSelectedServiceIds,
} from "./pricing-draft";
const part = (id: string, patch: Partial<PricingPackagePart> = {}): PricingPackagePart => ({
  id,
  name: id,
  unit: "project",
  typicalHours: 10,
  minimum: 100000,
  recommendedPrice: 200000,
  incomePercent: 0.1,
  active: true,
  componentIds: [],
  ...patch,
});
test("a package counts hours and money once and does not multiply client capacity", () => {
  assert.deepEqual(
    composePricingPackage([part("a"), part("b", { incomePercent: 0.2 })], "project"),
    { typicalHours: 20, minimum: 200000, recommendedPrice: 400000, incomePercent: 0.2 },
  );
});
test("packages reject duplicates, self references, nesting, inactive services and mixed billing units", () => {
  for (const parts of [
    [part("a")],
    [part("a"), part("a")],
    [part("parent"), part("b")],
    [part("a", { componentIds: ["x"] }), part("b")],
    [part("a", { active: false }), part("b")],
    [part("a", { unit: "monthly" }), part("b")],
  ])
    assert.throws(() => composePricingPackage(parts, "project", "parent"));
});
test("a missing component recommendation stays missing instead of silently becoming free", () => {
  assert.equal(
    composePricingPackage([part("a"), part("b", { recommendedPrice: null })], "project")
      .recommendedPrice,
    null,
  );
});

const service = (id: string, patch: Partial<PricingQuoteService> = {}): PricingQuoteService => ({
  ...part(id),
  description: `Scope ${id}`,
  components: [],
  ...patch,
});
test("a multi-service quote sums work and recommendations with one client budget", () => {
  const r = composeQuoteServices(
    ["a", "b"],
    [service("a"), service("b", { typicalHours: 15, minimum: 150000, incomePercent: 0.2 })],
  );
  assert.equal(r.typicalHours, 25);
  assert.equal(r.minimum, 250000);
  assert.equal(r.recommendedPrice, 400000);
  assert.equal(r.incomePercent, 0.2);
  assert.deepEqual(
    r.selectedServices.map((s) => s.id),
    ["a", "b"],
  );
  assert.ok(r.description?.includes("Scope a") && r.description.includes("Scope b"));
});
test("quotes combine a catalog package with other services and retain the package's own recommendation", () => {
  const pkg = service("package", {
    typicalHours: 20,
    minimum: 200000,
    recommendedPrice: 350000,
    componentIds: ["a", "b"],
    components: [part("a"), part("b")],
  });
  const r = composeQuoteServices(["package", "c"], [pkg, service("c")]);
  assert.equal(r.typicalHours, 30);
  assert.equal(r.minimum, 300000);
  assert.equal(r.recommendedPrice, 550000);
  assert.deepEqual(
    r.components.map((p) => p.id),
    ["a", "b", "c"],
  );
  assert.throws(
    () => composeQuoteServices(["package", "a"], [pkg, service("a")]),
    /ya está incluido/,
  );
});
test("multi-service quotes reject duplicates, unavailable services and mixed units", () => {
  assert.throws(() => composeQuoteServices(["a", "a"], [service("a")]));
  assert.throws(() => composeQuoteServices(["missing"], []));
  assert.throws(() =>
    composeQuoteServices(["a", "b"], [service("a"), service("b", { active: false })]),
  );
  assert.throws(() =>
    composeQuoteServices(["a", "b"], [service("a"), service("b", { unit: "monthly" })]),
  );
});
test("a missing recommendation never becomes a partial recommendation for the whole quote", () => {
  assert.equal(
    composeQuoteServices(["a", "b"], [service("a"), service("b", { recommendedPrice: null })])
      .recommendedPrice,
    null,
  );
});
test("an hourly combination stays one combined hourly rate", () => {
  const r = composeQuoteServices(
    ["a", "b"],
    [
      service("a", { unit: "hour", typicalHours: 1 }),
      service("b", { unit: "hour", typicalHours: 1 }),
    ],
  );
  assert.equal(r.typicalHours, 1);
  assert.equal(r.minimum, 200000);
});
test("quote drafts accept legacy single services and reject malformed or duplicate additions", () => {
  const draft = { ...emptyPricingQuote(), serviceId: "a" };
  delete draft.additionalServiceIds;
  assert.deepEqual(pricingSelectedServiceIds(draft), ["a"]);
  for (const extra of [["a"], ["b", "b"], [""]])
    assert.ok(
      pricingQuoteProblems({ ...draft, additionalServiceIds: extra }, false).some((p) =>
        p.includes("adicionales"),
      ),
    );
  assert.deepEqual(pricingSelectedServiceIds({ ...draft, additionalServiceIds: ["b"] }), [
    "a",
    "b",
  ]);
});
