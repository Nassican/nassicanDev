import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays } from "./journal-draft";
import { describeDays, formation, habitProblems, isDue, lastDays, streak, weekdayIndex } from "./habit-draft";
import { finishedSince, goalProblems, emptyGoal, progressRatio } from "./goal-draft";

// 2026-10-05 is a Monday.
const today = "2026-10-05";
const days = (...offsets: number[]) => new Set(offsets.map((o) => addDays(today, -o)));

test("los días de la semana empiezan el lunes", () => {
  assert.equal(weekdayIndex(today), 0);
  assert.equal(isDue("12345", today), true);
  assert.equal(isDue("67", today), false);
  assert.equal(describeDays("135"), "lunes, miércoles y viernes");
  assert.equal(describeDays("12345"), "Entre semana");
});

test("la racha cuenta los días cumplidos", () => {
  assert.deepEqual(streak(days(0, 1, 2, 3), "1234567", today), { days: 4, atRisk: false });
});

test("hoy sin marcar no rompe nada: el día sigue en curso", () => {
  assert.deepEqual(streak(days(1, 2, 3), "1234567", today), { days: 3, atRisk: false });
});

test("un día perdido se perdona, y se avisa", () => {
  // Yesterday missed, the three before done.
  assert.deepEqual(streak(days(2, 3, 4), "1234567", today), { days: 3, atRisk: true });
  // A miss in the middle of a run does not end it.
  assert.equal(streak(days(0, 1, 3, 4), "1234567", today).days, 4);
});

test("dos días seguidos sin marcar cortan la racha", () => {
  assert.deepEqual(streak(days(3, 4, 5), "1234567", today), { days: 0, atRisk: false });
  assert.equal(streak(days(0, 1, 4, 5), "1234567", today).days, 2);
});

test("los días que no tocan no cuentan ni como fallo ni como cumplido", () => {
  // Weekdays only: the weekend between Friday and today is not a gap.
  assert.equal(streak(days(0, 3, 4), "12345", today).days, 3);
});

test("la formación se mide contra 66 días, no contra 21", () => {
  assert.deepEqual(formation(33), { days: 33, ratio: 0.5 });
  assert.equal(formation(100).ratio, 1);
  assert.deepEqual(lastDays(today, 3), ["2026-10-03", "2026-10-04", "2026-10-05"]);
});

test("un hábito necesita su señal y al menos un día", () => {
  assert.deepEqual(habitProblems({ id: "", title: "Leer", cue: "Después de cenar", days: "1234567" }), []);
  assert.equal(habitProblems({ id: "", title: "Leer", cue: " ", days: "1234567" }).length, 1);
  assert.equal(habitProblems({ id: "", title: "Leer", cue: "x", days: "" }).length, 1);
  assert.equal(habitProblems({ id: "", title: "Leer", cue: "x", days: "118" }).length, 1);
});

test("una meta sin plan «si… entonces…» no se guarda", () => {
  const goal = { ...emptyGoal(today), title: "Leer 12 libros", planIf: "es domingo", planThen: "" };
  assert.match(goalProblems(goal)[0], /Falta el plan/);
  assert.deepEqual(goalProblems({ ...goal, planThen: "leo una hora", target: "12" }), []);
  assert.equal(goalProblems({ ...goal, planThen: "x", target: "1.5" }).length, 1);
});

test("el progreso se recorta al 100 % y es nulo sin cifra", () => {
  assert.equal(progressRatio(6, 12), 0.5);
  assert.equal(progressRatio(15, 12), 1);
  assert.equal(progressRatio(3, null), null);
});

test("una fecha de fin parcial se compara a su propia precisión", () => {
  assert.equal(finishedSince("2026", "2026-03-01"), true);
  assert.equal(finishedSince("2026-02", "2026-03-01"), false);
  assert.equal(finishedSince("2026-03-15T20:00", "2026-03-01"), true);
  assert.equal(finishedSince("2025-12-31", "2026-01-01"), false);
  assert.equal(finishedSince(null, "2026-01-01"), false);
});
