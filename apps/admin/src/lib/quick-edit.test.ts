import assert from "node:assert/strict";
import { test } from "node:test";
import { parseQuick } from "./quick-edit";

test("blank means «I don't know», not zero", () => {
  assert.deepEqual(parseQuick("money", "  "), { ok: true, value: null });
  assert.deepEqual(parseQuick("date", ""), { ok: true, value: null });
});

test("money is read the way the screen prints it: the dot groups thousands", () => {
  assert.deepEqual(parseQuick("money", "34.225"), { ok: true, value: 34225 });
  assert.deepEqual(parseQuick("money", "0"), { ok: true, value: 0 });
});

test("pages are whole, and nothing is negative", () => {
  assert.equal(parseQuick("integer", "120,5").ok, false);
  assert.deepEqual(parseQuick("integer", "320"), { ok: true, value: 320 });
  assert.equal(parseQuick("decimal", "-3").ok, false);
  assert.equal(parseQuick("money", "mucho").ok, false);
});

test("dates keep the precision they were typed with, and must be real", () => {
  assert.deepEqual(parseQuick("date", "2024-08"), { ok: true, value: "2024-08" });
  assert.equal(parseQuick("date", "2024-02-30").ok, false);
});
