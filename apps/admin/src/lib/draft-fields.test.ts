import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatPartialDate,
  isFullDay,
  isPartialDate,
  joinDateTime,
  splitDateTime,
} from "./draft-fields";

test("las fechas parciales de siempre siguen valiendo", () => {
  for (const ok of ["2024", "2024-08", "2024-08-13", "2024-02-29"]) assert.ok(isPartialDate(ok), ok);
});

test("una hora solo cabe junto a un día completo", () => {
  assert.ok(isPartialDate("2024-08-13T21:30"));
  assert.ok(isPartialDate("2024-08-13T00:00"));
  assert.equal(isPartialDate("2024-08T21:30"), false);
  assert.equal(isPartialDate("2024T21:30"), false);
});

test("los dígitos tienen que ser una fecha de verdad", () => {
  for (const bad of ["2024-13", "2024-00", "2023-02-29", "2024-04-31", "2024-08-13T24:00", "2024-08-13T21:60", "13/08/2024"]) {
    assert.equal(isPartialDate(bad), false, bad);
  }
});

test("separar y unir fecha y hora son inversas", () => {
  assert.deepEqual(splitDateTime("2024-08-13T21:30"), { date: "2024-08-13", time: "21:30" });
  assert.deepEqual(splitDateTime("2024-08"), { date: "2024-08", time: "" });
  assert.equal(joinDateTime("2024-08-13", "21:30"), "2024-08-13T21:30");
  assert.equal(joinDateTime("2024-08-13", ""), "2024-08-13");
});

test("escribir un mes encima de un día con hora suelta la hora", () => {
  assert.equal(joinDateTime("2024-08", "21:30"), "2024-08");
  assert.equal(isFullDay("2024-08"), false);
  assert.equal(isFullDay("2024-08-13"), true);
});

test("se leen como se dicen, sin inventar el día que falta", () => {
  assert.equal(formatPartialDate("2024"), "2024");
  assert.equal(formatPartialDate("2024-08"), "ago 2024");
  assert.equal(formatPartialDate("2024-08-03"), "3 ago 2024");
  assert.equal(formatPartialDate("2024-08-03T09:05"), "3 ago 2024, 09:05");
  assert.equal(formatPartialDate(null), "");
  // Something that is not a date is shown as typed, not swallowed.
  assert.equal(formatPartialDate("algún día"), "algún día");
});
