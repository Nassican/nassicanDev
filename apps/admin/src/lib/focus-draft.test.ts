import assert from "node:assert/strict";
import { test } from "node:test";
import {
  closingTime,
  focusPhase,
  focusProblems,
  formatClock,
  formatDuration,
  labelKey,
  workedMinutes,
  type FocusBlockView,
} from "./focus-draft";

const start = Date.parse("2026-10-05T14:00:00Z");
const min = 60_000;

function block(over: Partial<FocusBlockView> = {}): FocusBlockView {
  return {
    id: "b1",
    label: "Informe",
    taskId: null,
    plannedMinutes: 25,
    breakMinutes: 5,
    startedAt: new Date(start).toISOString(),
    endedAt: null,
    returnNote: null,
    ...over,
  };
}

test("a running block counts down, then waits for its note", () => {
  const running = block();
  const work = focusPhase(running, null, start + 10 * min);
  assert.equal(work.kind, "work");
  assert.equal(work.kind === "work" && work.remainingMs, 15 * min);
  assert.equal(focusPhase(running, null, start + 25 * min).kind, "over");
});

test("a completed block earns its break, counted from the end of the block", () => {
  const done = block({ endedAt: new Date(start + 25 * min).toISOString() });
  const phase = focusPhase(null, done, start + 27 * min);
  assert.equal(phase.kind, "break");
  assert.equal(phase.kind === "break" && phase.remainingMs, 3 * min);
  assert.equal(focusPhase(null, done, start + 31 * min).kind, "idle");
});

test("a block cut short earns no break", () => {
  const cut = block({ endedAt: new Date(start + 12 * min).toISOString() });
  assert.equal(focusPhase(null, cut, start + 13 * min).kind, "idle");
});

test("a block left running over lunch closes at its planned end", () => {
  const running = block();
  assert.equal(closingTime(running, start + 3 * 60 * min), start + 25 * min);
  assert.equal(closingTime(running, start + 7 * min), start + 7 * min);
  assert.equal(workedMinutes({ ...running, endedAt: new Date(start + 25 * min).toISOString() }), 25);
});

test("the clock rounds up and never goes negative", () => {
  assert.equal(formatClock(25 * min), "25:00");
  assert.equal(formatClock(59_001), "1:00");
  assert.equal(formatClock(400), "0:01");
  assert.equal(formatClock(-5000), "0:00");
});

test("durations read the way they are said", () => {
  assert.equal(formatDuration(25), "25 min");
  assert.equal(formatDuration(60), "1 h");
  assert.equal(formatDuration(125), "2 h 05 min");
});

test("a block needs something to be about", () => {
  assert.equal(focusProblems({ label: "  ", taskId: null }).length, 1);
  assert.deepEqual(focusProblems({ label: "", taskId: "t1" }), []);
  assert.deepEqual(focusProblems({ label: "Informe", taskId: null }), []);
});

test("free labels match regardless of accents, case and spacing", () => {
  assert.equal(labelKey("  Revisión   del Informe "), labelKey("revision del informe"));
});
