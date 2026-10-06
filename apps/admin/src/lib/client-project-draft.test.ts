import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clientProjectProblems,
  daysBetween,
  emptyClientProject,
  isLate,
  isQuiet,
  totalHours,
} from "./client-project-draft";

const today = "2026-10-05";

test("a project needs a name and a company", () => {
  assert.equal(clientProjectProblems(emptyClientProject()).length, 2);
  assert.deepEqual(clientProjectProblems({ ...emptyClientProject(), title: "Tienda", company: "Acme" }), []);
});

test("an end date belongs to a finished project", () => {
  const draft = { ...emptyClientProject(), title: "Tienda", company: "Acme", finishedAt: "2026-10-01" };
  assert.ok(clientProjectProblems(draft).some((p) => p.includes("no está finalizado")));
  assert.deepEqual(clientProjectProblems({ ...draft, status: "finished" }), []);
});

test("late: a day the day after; a month once it is over; never when finished", () => {
  assert.equal(isLate("2026-10-04", "in_progress", today), true);
  assert.equal(isLate("2026-10", "in_progress", today), false);
  assert.equal(isLate("2026-09", "not_started", today), true);
  assert.equal(isLate("2026-09-01", "finished", today), false);
});

test("in progress and untouched for over a week is quiet; other states never are", () => {
  assert.equal(isQuiet("in_progress", "2026-09-27", today), true);
  assert.equal(isQuiet("in_progress", "2026-09-29", today), false);
  assert.equal(isQuiet("in_progress", null, today), true);
  assert.equal(isQuiet("not_started", null, today), false);
});

test("days and hours", () => {
  assert.equal(daysBetween("2026-10-01T09:00", today), 4);
  assert.equal(daysBetween("2026-10", today), null);
  assert.equal(totalHours([{ hours: 1.5 }, { hours: null }, { hours: 2.25 }]), 3.8);
});
