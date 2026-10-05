import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addDays,
  collapse,
  dayLabel,
  longDayLabel,
  describeAudit,
  mondayOf,
  weekDays,
  weekLabel,
  weekHighlights,
  zonedMidnight,
} from "./journal-draft";

test("la semana empieza el lunes, también desde un domingo", () => {
  assert.equal(mondayOf("2026-10-04"), "2026-09-28"); // a Sunday
  assert.equal(mondayOf("2026-09-28"), "2026-09-28");
  assert.equal(mondayOf("2027-01-01"), "2026-12-28");
  assert.equal(weekDays("2026-09-28").at(-1), "2026-10-04");
  assert.equal(addDays("2026-02-28", 1), "2026-03-01");
});

test("la medianoche de Bogotá son las cinco de la mañana en UTC", () => {
  assert.equal(zonedMidnight("2026-09-28", "America/Bogota").toISOString(), "2026-09-28T05:00:00.000Z");
});

test("y en una zona con horario de verano se sigue el cambio", () => {
  // Madrid is UTC+2 in summer and UTC+1 in winter.
  assert.equal(zonedMidnight("2026-07-06", "Europe/Madrid").toISOString(), "2026-07-05T22:00:00.000Z");
  assert.equal(zonedMidnight("2026-12-07", "Europe/Madrid").toISOString(), "2026-12-06T23:00:00.000Z");
});

test("las etiquetas nombran el mes una sola vez cuando pueden", () => {
  assert.equal(weekLabel("2026-10-05"), "5–11 oct 2026");
  assert.equal(weekLabel("2026-09-28"), "28 sept – 4 oct 2026");
  assert.equal(weekLabel("2026-12-28"), "28 dic 2026 – 3 ene 2027");
  assert.equal(dayLabel("2026-10-04"), "dom 4 oct");
});

test("un cambio de estado se lee como lo que pasó, no como una edición", () => {
  assert.equal(
    describeAudit({ action: "update", entityType: "game", diff: { title: "Geometry Dash", status: "finished" }, on: "2026-10-04", finishedAt: "2026-10-03" })?.text,
    "Terminaste «Geometry Dash»",
  );
  assert.equal(
    describeAudit({ action: "update", entityType: "book", diff: { status: "reading" }, name: "Control" })?.text,
    "Empezaste a leer «Control»",
  );
  assert.equal(
    describeAudit({ action: "update", entityType: "subscription", diff: { name: "Netflix", paid: "2026-09", now: true }, on: "2026-10-04" })?.text,
    "Pagaste «Netflix» (sept 2026)",
  );
});

test("lo demás usa verbo y sustantivo, y la papelera se nombra", () => {
  assert.equal(describeAudit({ action: "publish", entityType: "post", diff: { label: "Hola" } })?.text, "Publicaste el artículo «Hola»");
  assert.equal(
    describeAudit({ action: "delete", entityType: "book", diff: { title: "X", trash: true } })?.text,
    "Moviste a la papelera el libro «X»",
  );
  assert.equal(describeAudit({ action: "export", entityType: "backup", diff: null })?.text, "Descargaste una copia de seguridad");
});

test("lo que no es de tu semana se queda fuera", () => {
  assert.equal(describeAudit({ action: "delete", entityType: "session", diff: null }), null);
  assert.equal(describeAudit({ action: "create", entityType: "journal", diff: null }), null);
  assert.equal(describeAudit({ action: "update", entityType: "subscription", diff: { name: "N", unpaid: "2026-09" } }), null);
});

test("las repeticiones del mismo día se pliegan; las notas nunca", () => {
  const items = collapse([
    { time: "10:00", text: "Editaste la tecnología «Vite»", count: 1, kind: "content", highlight: false },
    { time: "10:05", text: "Editaste la tecnología «Vite»", count: 1, kind: "content", highlight: false },
    { time: "11:00", text: "Una nota", count: 1, kind: "note", highlight: true, noteId: "a" },
    { time: "11:01", text: "Una nota", count: 1, kind: "note", highlight: true, noteId: "b" },
  ]);
  assert.equal(items.length, 3);
  assert.equal(items[0].count, 2);
  assert.equal(items[0].time, "10:00");
});

test("lo que cambió algo destaca; las ediciones de rutina no", () => {
  const finished = describeAudit({ action: "update", entityType: "game", diff: { title: "X", status: "finished" }, on: "2026-10-04", finishedAt: "2026-10" });
  assert.deepEqual(finished, { text: "Terminaste «X»", kind: "games", highlight: true, tally: "game-finished" });
  assert.equal(describeAudit({ action: "update", entityType: "technology", diff: { name: "Vite" } })?.highlight, false);
  assert.equal(describeAudit({ action: "publish", entityType: "post", diff: { label: "Hola" } })?.tally, "published");
  // Adding a game is a decision; adding a technology is maintenance.
  assert.equal(describeAudit({ action: "create", entityType: "game", diff: { title: "X" } })?.highlight, true);
  assert.equal(describeAudit({ action: "create", entityType: "technology", diff: { name: "Bun" } })?.highlight, false);
});

test("la semana se resume en cuentas, en orden fijo y sin ceros", () => {
  const item = (tally: Parameters<typeof weekHighlights>[0][number]["tally"], count = 1) => ({
    time: null, text: "x", kind: "games" as const, highlight: true, tally, count,
  });
  assert.deepEqual(weekHighlights([item("payment", 3), item("game-finished"), item("game-finished")]), [
    { kind: "games", label: "juegos terminados", count: 2 },
    { kind: "subscriptions", label: "pagos", count: 3 },
  ]);
  assert.deepEqual(weekHighlights([item(undefined)]), []);
});

test("el encabezado de un día se lee entero", () => {
  assert.equal(longDayLabel("2026-09-28"), "Lunes 28 de septiembre");
  assert.equal(longDayLabel("2026-10-04"), "Domingo 4 de octubre");
});

/**
 * The first real week counted «25 juegos terminados» from an afternoon spent
 * updating an old library: 24 with no end date, one from 2025.
 */
test("poner al día la biblioteca no se cuenta como terminar juegos", () => {
  const mark = (finishedAt: string | null) =>
    describeAudit({ action: "update", entityType: "game", diff: { title: "X", status: "finished" }, on: "2026-10-04", finishedAt });
  assert.deepEqual(mark(null), { text: "Marcaste como terminado «X»", kind: "games", highlight: false, tally: undefined });
  assert.equal(mark("2025-03-12")?.text, "Marcaste como terminado «X» (2025)");
  assert.equal(mark("2025")?.highlight, false);
  // A finish dated around the mark is the real thing.
  assert.equal(mark("2026-09-30")?.tally, "game-finished");
  assert.equal(mark("2026-10")?.tally, "game-finished");
  assert.equal(mark("2026-09-20")?.highlight, false);
});

test("marcar meses viejos registra pagos; no los cuenta como de esta semana", () => {
  const tick = (paid: string, now?: boolean) =>
    describeAudit({ action: "update", entityType: "subscription", diff: { name: "N", paid, ...(now ? { now } : {}) }, on: "2026-10-04" });
  assert.equal(tick("2026-05")?.text, "Registraste el pago de «N» (may 2026)");
  assert.equal(tick("2026-05")?.tally, undefined);
  assert.equal(tick("2026-10")?.tally, "payment");
  assert.equal(tick("2026-11")?.tally, "payment");
  // «Pagado» on an overdue September renewal is a payment made today.
  assert.equal(tick("2026-09", true)?.tally, "payment");
});

test("de los pendientes, solo completar destaca", () => {
  const task = (diff: Record<string, unknown>, action = "update") =>
    describeAudit({ action, entityType: "task", diff: { title: "Pagar luz", ...diff } });
  assert.deepEqual(task({ status: "done" }), { text: "Completaste «Pagar luz»", kind: "tasks", highlight: true, tally: "task-done" });
  assert.equal(task({}, "create")?.text, "Apuntaste «Pagar luz»");
  assert.equal(task({ status: "dropped" })?.highlight, false);
  assert.equal(task({ plannedFor: "2026-10-06T09:00" })?.text, "Planificaste «Pagar luz» para el mar 6 oct");
  assert.equal(task({ plannedFor: null })?.text, "Devolviste a la bandeja «Pagar luz»");
});
