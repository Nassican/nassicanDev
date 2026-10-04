import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addDays,
  collapse,
  dayLabel,
  describeAudit,
  mondayOf,
  weekDays,
  weekLabel,
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
    describeAudit({ action: "update", entityType: "game", diff: { title: "Geometry Dash", status: "finished" } }),
    "Terminaste «Geometry Dash»",
  );
  assert.equal(
    describeAudit({ action: "update", entityType: "book", diff: { status: "reading" }, name: "Control" }),
    "Empezaste a leer «Control»",
  );
  assert.equal(
    describeAudit({ action: "update", entityType: "subscription", diff: { name: "Netflix", paid: "2026-09" } }),
    "Pagaste «Netflix» (sept 2026)",
  );
});

test("lo demás usa verbo y sustantivo, y la papelera se nombra", () => {
  assert.equal(describeAudit({ action: "publish", entityType: "post", diff: { label: "Hola" } }), "Publicaste el artículo «Hola»");
  assert.equal(
    describeAudit({ action: "delete", entityType: "book", diff: { title: "X", trash: true } }),
    "Moviste a la papelera el libro «X»",
  );
  assert.equal(describeAudit({ action: "export", entityType: "backup", diff: null }), "Descargaste una copia de seguridad");
});

test("lo que no es de tu semana se queda fuera", () => {
  assert.equal(describeAudit({ action: "delete", entityType: "session", diff: null }), null);
  assert.equal(describeAudit({ action: "create", entityType: "journal", diff: null }), null);
  assert.equal(describeAudit({ action: "update", entityType: "subscription", diff: { name: "N", unpaid: "2026-09" } }), null);
});

test("las repeticiones del mismo día se pliegan; las notas nunca", () => {
  const items = collapse([
    { time: "10:00", text: "Editaste la tecnología «Vite»", count: 1 },
    { time: "10:05", text: "Editaste la tecnología «Vite»", count: 1 },
    { time: "11:00", text: "Una nota", count: 1, noteId: "a" },
    { time: "11:01", text: "Una nota", count: 1, noteId: "b" },
  ]);
  assert.equal(items.length, 3);
  assert.equal(items[0].count, 2);
  assert.equal(items[0].time, "10:00");
});
