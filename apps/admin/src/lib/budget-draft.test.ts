import assert from "node:assert/strict";
import { test } from "node:test";
import { budgetProblems, daysIn, lineStatus, monthName, shiftMonth } from "./budget-draft";

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

test("months: length, name and shifting across a year", () => {
  assert.equal(daysIn("2026-02"), 28);
  assert.equal(daysIn("2028-02"), 29);
  assert.equal(monthName("2026-10"), "octubre de 2026");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
});

test("a line needs a target and a positive limit", () => {
  assert.equal(budgetProblems({ scope: "group", key: "", limit: 1000 }).length, 1);
  assert.equal(budgetProblems({ scope: "total", key: "", limit: 0 }).length, 1);
  assert.deepEqual(budgetProblems({ scope: "category", key: "Groceries", limit: 400_000 }), []);
});
