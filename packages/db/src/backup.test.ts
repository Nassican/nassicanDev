import assert from "node:assert/strict";
import { test } from "node:test";
import { KEPT_ON_RESTORE, REPLACED_ON_RESTORE, modelInfo, modelNames, tableOrder } from "./backup";

const replaced = new Set<string>(REPLACED_ON_RESTORE);
const kept = new Set<string>(KEPT_ON_RESTORE);

test("ninguna tabla se reemplaza y se conserva a la vez", () => {
  assert.deepEqual([...replaced].filter((m) => kept.has(m)), []);
});

test("toda tabla del esquema está en una de las dos listas", () => {
  // The type already refuses this; the test says it in words.
  assert.deepEqual(modelNames.filter((m) => !replaced.has(m) && !kept.has(m)), []);
});

/**
 * Emptying a replaced table cascades. A kept table pointing into one would lose
 * rows in a restore that promised to leave it alone.
 */
test("nada conservado apunta a una tabla que se reemplaza", () => {
  const crossings = KEPT_ON_RESTORE.flatMap((model) =>
    modelInfo[model].foreignKeys
      .filter((fk) => replaced.has(fk.target))
      .map((fk) => `${model}.${fk.field} → ${fk.target}`),
  );
  assert.deepEqual(crossings, []);
});

test("el orden de inserción respeta todas las claves foráneas del esquema", () => {
  const order = tableOrder();
  const at = new Map(order.map((m, i) => [m, i]));
  for (const model of order) {
    for (const fk of modelInfo[model].foreignKeys) {
      if (fk.target === model) continue;
      assert.ok(at.get(fk.target)! < at.get(model)!, `${fk.target} debe ir antes que ${model}`);
    }
  }
});
