import assert from "node:assert/strict";
import { test } from "node:test";
import {
  compareWishes,
  emptyWish,
  isPastTarget,
  missing,
  monthlyNeeded,
  readSaving,
  savedRatio,
  savedTotal,
  totalsByCurrency,
  wishProblems,
} from "./wish-draft";

const today = "2026-10-08";

test("a wish needs only a name", () => {
  assert.equal(wishProblems(emptyWish()).length, 1);
  assert.deepEqual(wishProblems({ ...emptyWish(), title: "Laptop" }), []);
});

test("a price is read the es-CO way and rejected when it is not a number", () => {
  assert.deepEqual(wishProblems({ ...emptyWish(), title: "Laptop", price: "4.500.000" }), []);
  assert.ok(wishProblems({ ...emptyWish(), title: "Laptop", price: "caro" }).length > 0);
});

test("purchase data belongs to something bought", () => {
  const draft = { ...emptyWish(), title: "Mouse", boughtAt: "2026-10-01" };
  assert.ok(wishProblems(draft).some((p) => p.includes("comprado")));
  assert.deepEqual(wishProblems({ ...draft, status: "bought" }), []);
});

test("saved is the sum, withdrawals included, without float dust", () => {
  assert.equal(savedTotal([{ amount: 200000 }, { amount: 150000 }, { amount: -50000 }]), 300000);
  assert.equal(savedTotal([{ amount: 0.1 }, { amount: 0.2 }]), 0.3);
  assert.equal(savedTotal([]), 0);
});

test("missing never goes below zero, and needs a price", () => {
  assert.equal(missing(1000, 300), 700);
  assert.equal(missing(1000, 1500), 0);
  assert.equal(missing(null, 300), null);
});

test("the ratio is capped for the bar and absent without a price", () => {
  assert.equal(savedRatio(1000, 250), 0.25);
  assert.equal(savedRatio(1000, 4000), 1);
  assert.equal(savedRatio(null, 100), null);
  assert.equal(savedRatio(0, 100), null);
});

test("an amount to save: grouped thousands, a minus to withdraw, never past zero", () => {
  assert.deepEqual(readSaving("200.000", 0), { ok: true, amount: 200000 });
  assert.deepEqual(readSaving("-50.000", 200000), { ok: true, amount: -50000 });
  assert.equal(readSaving("-250.000", 200000).ok, false);
  assert.equal(readSaving("", 0).ok, false);
  assert.equal(readSaving("0", 0).ok, false);
});

test("a month target is past only once the month is over", () => {
  assert.equal(isPastTarget("2026-10", today), false);
  assert.equal(isPastTarget("2026-09", today), true);
  assert.equal(isPastTarget("2026-10-07", today), true);
  assert.equal(isPastTarget("2026", today), false);
  assert.equal(isPastTarget(null, today), false);
});

test("monthly needed: the months left, never fewer than one", () => {
  // To the end of December: 84 days, three months.
  assert.deepEqual(monthlyNeeded(3_000_000, "2026-12", today), { amount: 1_000_000, months: 3 });
  // Three weeks away is this month, not a division by zero.
  assert.deepEqual(monthlyNeeded(900_000, "2026-10-29", today), { amount: 900_000, months: 1 });
  assert.equal(monthlyNeeded(900_000, "2026-09", today), null);
  assert.equal(monthlyNeeded(0, "2026-12", today), null);
  assert.equal(monthlyNeeded(null, "2026-12", today), null);
  assert.equal(monthlyNeeded(900_000, null, today), null);
});

test("order: priority first, then the one closest to paid for", () => {
  const rows = [
    { title: "Mouse", priority: "low" as const, ratio: 0.9 },
    { title: "Laptop", priority: "high" as const, ratio: 0.2 },
    { title: "Disco", priority: "high" as const, ratio: 0.7 },
    { title: "MiniPC", priority: "high" as const, ratio: null },
  ];
  assert.deepEqual(rows.sort(compareWishes).map((r) => r.title), ["Disco", "Laptop", "MiniPC", "Mouse"]);
});

test("totals per currency: a surplus on one wish does not pay for another", () => {
  const totals = totalsByCurrency([
    { currency: "COP", price: 1000, saved: 1500 },
    { currency: "COP", price: 2000, saved: 0 },
    { currency: "USD", price: 300, saved: 100 },
    { currency: "COP", price: null, saved: 50 },
  ]);
  assert.deepEqual(totals, [
    { currency: "COP", cost: 3000, saved: 1550, missing: 2000 },
    { currency: "USD", cost: 300, saved: 100, missing: 200 },
  ]);
});
