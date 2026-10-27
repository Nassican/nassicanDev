import assert from "node:assert/strict";
import { test } from "node:test";
import { readDivipola } from "./divipola";
test("DIVIPOLA preserves codes, deduplicates by code, and rejects corrupt input", () => {
  const row = { cod_dpto: "05", cod_mpio: "05001", dpto: "ANTIOQUIA", nom_mpio: "MEDELLÍN" };
  assert.deepEqual(readDivipola([row, row]), [
    { code: "05001", departmentCode: "05", department: "ANTIOQUIA", municipality: "MEDELLÍN" },
  ]);
  assert.throws(() => readDivipola([{ ...row, cod_mpio: "11001" }]));
  assert.throws(() => readDivipola([{ ...row, cod_mpio: "", cod_dpto: "" }]));
  assert.throws(() => readDivipola([row, { ...row, nom_mpio: "Otra" }]));
  assert.throws(() => readDivipola({}));
});
