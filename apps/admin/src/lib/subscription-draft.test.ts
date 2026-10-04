import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addMonths,
  emptySubscription,
  expectedPeriods,
  monthlyCost,
  periodOf,
  renewalState,
  subscriptionProblems,
  type SubscriptionDraft,
} from "./subscription-draft";

const draft = (over: Partial<SubscriptionDraft> = {}): SubscriptionDraft => ({
  ...emptySubscription(),
  name: "Netflix",
  price: "18.900",
  ...over,
});

test("una suscripción con nombre y precio ya se puede guardar", () => {
  assert.deepEqual(subscriptionProblems(draft()), []);
});

test("sin nombre, sin precio o con un enlace raro, no", () => {
  assert.deepEqual(subscriptionProblems(draft({ name: " ", price: "" })), ["Falta el nombre.", "Falta el precio."]);
  assert.deepEqual(subscriptionProblems(draft({ url: "netflix.com" })), [
    "El enlace tiene que empezar por http:// o https://.",
  ]);
  assert.equal(subscriptionProblems(draft({ nextRenewal: "2026-02-30" })).length, 1);
});

test("el coste mensual hace sumables los planes anuales", () => {
  assert.equal(monthlyCost(120, 12), 10);
  assert.equal(monthlyCost(18900, 1), 18900);
});

test("avanzar meses conserva la precisión con que se escribió", () => {
  assert.equal(addMonths("2026-11", 1), "2026-12");
  assert.equal(addMonths("2026-12", 1), "2027-01");
  assert.equal(addMonths("2026-11-03T09:00", 12), "2027-11-03T09:00");
  assert.equal(addMonths("2026", 12), "2027");
});

test("un día que el mes no tiene se ajusta al último, como hace la tarjeta", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2028-01-31", 1), "2028-02-29");
  assert.equal(addMonths("2026-08-31", 3), "2026-11-30");
});

test("el periodo de una fecha es su mes", () => {
  assert.equal(periodOf("2026-09-30T23:59"), "2026-09");
  assert.equal(periodOf("2026-09"), "2026-09");
  assert.equal(periodOf("2026"), null);
  assert.equal(periodOf(null), null);
});

test("vencida, pronto o más adelante, contado en días locales", () => {
  assert.deepEqual(renewalState("2026-10-03", "2026-10-04"), { kind: "overdue", days: -1 });
  assert.deepEqual(renewalState("2026-10-04T08:00", "2026-10-04"), { kind: "soon", days: 0 });
  assert.deepEqual(renewalState("2026-10-11", "2026-10-04"), { kind: "soon", days: 7 });
  assert.deepEqual(renewalState("2026-10-12", "2026-10-04"), { kind: "later", days: 8 });
  assert.deepEqual(renewalState("", "2026-10-04"), { kind: "unknown" });
});

test("una renovación escrita como mes se juzga por mes, sin inventar el día 1", () => {
  assert.deepEqual(renewalState("2026-10", "2026-10-20"), { kind: "soon", days: null });
  assert.deepEqual(renewalState("2026-09", "2026-10-01"), { kind: "overdue", days: null });
  assert.deepEqual(renewalState("2026-11", "2026-10-31"), { kind: "later", days: null });
});

test("los meses esperados siguen el ciclo desde el ancla", () => {
  // Yearly, renewing in March: only March is owed.
  assert.deepEqual([...expectedPeriods(2026, 12, "2027-03-10", null)], ["2026-03"]);
  // Quarterly anchored in November reaches back to February, May and August.
  assert.deepEqual([...expectedPeriods(2026, 3, "2026-11", null)], ["2026-02", "2026-05", "2026-08", "2026-11"]);
});

test("nada se debe antes de empezar", () => {
  const months = [...expectedPeriods(2026, 1, null, "2026-06-15")];
  assert.equal(months[0], "2026-06");
  assert.equal(months.length, 7);
});

test("sin ancla, un plan mensual espera todos los meses y uno anual ninguno", () => {
  assert.equal(expectedPeriods(2026, 1, null, null).size, 12);
  assert.equal(expectedPeriods(2026, 12, null, null).size, 0);
});
