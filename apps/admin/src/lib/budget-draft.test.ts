import assert from "node:assert/strict";
import { test } from "node:test";
import { daysIn, lineStatus, monthName, newBudgetProblems, periodPosition } from "./budget-draft";

test("70 % on the 12th of 30 days is ahead of the month, and says where it lands", () => {
  const s = lineStatus(70_000, 100_000, 12, 30);
  assert.equal(s.pace, "over");
  assert.equal(Math.round(s.projected), 175_000);
  assert.equal(s.elapsed, 0.4);
});

test("the same 70 % on the 25th is fine", () => {
  assert.equal(lineStatus(70_000, 100_000, 25, 30).pace, "ok");
});

test("two days in, one dinner does not project a ruined month", () => {
  assert.equal(lineStatus(40_000, 100_000, 2, 30).pace, "ok");
});

test("over the limit is exceeded whatever the day; nothing spent is idle", () => {
  assert.equal(lineStatus(120_000, 100_000, 3, 30).pace, "exceeded");
  assert.equal(lineStatus(0, 100_000, 20, 30).pace, "idle");
});

test("a Wallet period is inclusive at both ends", () => {
  assert.deepEqual(periodPosition("2026-10-01", "2026-10-31", "2026-10-01"), { day: 1, days: 31 });
  assert.deepEqual(periodPosition("2026-10-01", "2026-10-31", "2026-10-05"), { day: 5, days: 31 });
  assert.deepEqual(periodPosition("2026-10-01", "2026-10-31", "2026-11-03"), { day: 31, days: 31 });
});

test("months: length and name", () => {
  assert.equal(daysIn("2026-02"), 28);
  assert.equal(daysIn("2028-02"), 29);
  assert.equal(monthName("2026-10"), "octubre de 2026");
});

test("a new budget needs a name and a positive limit", () => {
  assert.equal(newBudgetProblems({ name: "", limit: 1000, categoryIds: [] }).length, 1);
  assert.equal(newBudgetProblems({ name: "Mercado", limit: 0, categoryIds: [] }).length, 1);
  assert.deepEqual(newBudgetProblems({ name: "Mercado", limit: 470_000, categoryIds: ["x"] }), []);
});
