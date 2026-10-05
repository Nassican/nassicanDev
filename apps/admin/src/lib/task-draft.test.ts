import assert from "node:assert/strict";
import { test } from "node:test";
import { groupOf, groupTasks, parseCapture, quickDays, relativeDay, taskProblems, type TaskRow } from "./task-draft";

const task = (over: Partial<TaskRow> = {}): TaskRow => ({
  id: Math.random().toString(36),
  title: "x",
  note: null,
  area: null,
  status: "planned",
  plannedFor: null,
  closedAt: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  ...over,
});

// 2026-10-07 is a Wednesday; its week ends on Sunday the 11th.
const today = "2026-10-07";

test("cada pendiente abierto cae en su grupo según el día", () => {
  assert.equal(groupOf(task({ plannedFor: "2026-10-06" }), today), "overdue");
  assert.equal(groupOf(task({ plannedFor: "2026-10-07T09:00" }), today), "today");
  assert.equal(groupOf(task({ plannedFor: "2026-10-08" }), today), "tomorrow");
  assert.equal(groupOf(task({ plannedFor: "2026-10-11" }), today), "week");
  assert.equal(groupOf(task({ plannedFor: "2026-10-12" }), today), "later");
  assert.equal(groupOf(task({ status: "inbox" }), today), "inbox");
});

test("lo hecho o descartado no está en ningún grupo", () => {
  assert.equal(groupOf(task({ status: "done", plannedFor: today }), today), null);
  assert.equal(groupOf(task({ status: "dropped" }), today), null);
});

test("los grupos salen en orden, sin los vacíos, y la bandeja con lo último arriba", () => {
  const groups = groupTasks(
    [
      task({ status: "inbox", title: "viejo", createdAt: "2026-10-01T00:00:00Z" }),
      task({ status: "inbox", title: "nuevo", createdAt: "2026-10-06T00:00:00Z" }),
      task({ plannedFor: "2026-10-05", title: "atrasado" }),
    ],
    today,
  );
  assert.deepEqual(groups.map((g) => g.key), ["overdue", "inbox"]);
  assert.deepEqual(groups[1].tasks.map((t) => t.title), ["nuevo", "viejo"]);
});

test("los atajos de día no repiten el lunes cuando hoy es domingo", () => {
  assert.deepEqual(quickDays(today).map((d) => d.date), ["2026-10-07", "2026-10-08", "2026-10-12"]);
  assert.deepEqual(quickDays("2026-10-11").map((d) => d.label), ["Hoy", "Mañana"]);
});

test("las fechas se dicen como se dicen", () => {
  assert.equal(relativeDay("2026-10-07T09:30", today), "hoy, 09:30");
  assert.equal(relativeDay("2026-10-08", today), "mañana");
  assert.equal(relativeDay("2026-10-06", today), "ayer");
  assert.equal(relativeDay("2026-10-02", today), "hace 5 días");
  assert.equal(relativeDay("2026-10-20", today), "mar 20 oct");
});

test("capturar con «+» y planificar en la misma frase", () => {
  assert.deepEqual(parseCapture("+ Pagar la luz mañana", today), { title: "Pagar la luz", plannedFor: "2026-10-08" });
  assert.deepEqual(parseCapture("+llamar al banco HOY", today), { title: "llamar al banco", plannedFor: today });
  assert.deepEqual(parseCapture("Escribir artículo", today), { title: "Escribir artículo", plannedFor: null });
  // «mañana» alone is the whole task, not a date.
  assert.deepEqual(parseCapture("+ mañana", today), { title: "mañana", plannedFor: null });
});

test("un plan es un día, no un mes", () => {
  assert.deepEqual(taskProblems({ title: "x", plannedFor: "" }), []);
  assert.deepEqual(taskProblems({ title: "x", plannedFor: "2026-10-08T10:00" }), []);
  assert.deepEqual(taskProblems({ title: "x", plannedFor: "2026-10" }), ["Elige un día concreto para planificarlo."]);
  assert.deepEqual(taskProblems({ title: " ", plannedFor: "" }), ["Falta qué hay que hacer."]);
});
