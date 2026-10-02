import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * The read-only guarantee, enforced instead of described.
 *
 * The requirement was that writing to Wallet be impossible by construction, not
 * by convention — and a comment saying "do not add a write" is exactly the kind
 * of convention that survives until the first person in a hurry. This reads the
 * source and fails if the shape that makes writes impossible is broken.
 *
 * Static on purpose: importing the module would need a request context and a
 * token, and what matters here is the shape of the code, not its behaviour on
 * one run.
 */

const file = path.join(import.meta.dirname, "wallet-client.ts");
const source = fs.readFileSync(file, "utf8");

test("el token no puede llegar al navegador", () => {
  assert.match(
    source,
    /^import "server-only";/m,
    "sin `server-only` un componente de cliente podría importar esto y el fallo aparecería en el navegador, no en el build",
  );
});

test("no hay ningún verbo HTTP que no sea GET", () => {
  const methods = [...source.matchAll(/method:\s*(["'`])(\w+)\1/g)].map((m) => m[2]);

  assert.ok(methods.length > 0, "se esperaba al menos un `method:` explícito");
  assert.deepEqual(
    [...new Set(methods)],
    ["GET"],
    `aparecieron otros verbos: ${methods.join(", ")}`,
  );
});

test("el verbo está escrito, no es un parámetro", () => {
  // `method: algo` en vez de `method: "GET"` reabriría la puerta.
  assert.doesNotMatch(
    source,
    /method:\s*(?!["'`])[A-Za-z_$]/,
    "el método se está tomando de una variable: entonces un llamante puede cambiarlo",
  );

  // Y la firma de `read()` no debe aceptarlo.
  const signature = /async function read<T>\(([\s\S]*?)\): Promise</.exec(source);
  assert.ok(signature, "no se encontró la firma de read()");
  assert.doesNotMatch(
    signature[1],
    /\bmethod\b/,
    "read() acepta un parámetro `method`",
  );
});

test("solo se exportan lectores, nada genérico", () => {
  const exported = [
    ...source.matchAll(/^export (?:const|function|async function)\s+(\w+)/gm),
  ].map((m) => m[1]);

  const allowed = new Set([
    "hasWalletToken",
    "readAccounts",
    "readCategories",
    "readBudgets",
    "readRecords",
    "PAGE_SIZE",
    "BUDGETS_PAGE_SIZE",
  ]);

  const unexpected = exported.filter((name) => !allowed.has(name));
  assert.deepEqual(
    unexpected,
    [],
    `exportaciones no previstas: ${unexpected.join(", ")}. Si es un lector nuevo, añádelo a la lista; si no lo es, no debería salir de este módulo.`,
  );

  // `read` es el único camino al fetch y debe quedarse dentro.
  assert.doesNotMatch(
    source,
    /^export\s+(async\s+)?function read\b/m,
    "read() está exportado: cualquiera podría llamar a un endpoint arbitrario",
  );
});

test("pedir movimientos obliga a declarar el rango de fechas", () => {
  // Sin fechas la API aplica una ventana de tres meses propia y en silencio,
  // así que un espejo que confiara en el valor por defecto guardaría un
  // trimestre y lo llamaría historial completo.
  const reader = /export const readRecords = \(([^)]*)\)/.exec(source);
  assert.ok(reader, "no se encontró readRecords");
  assert.match(
    reader[1],
    /^since: string/,
    "`since` debe ser obligatorio y el primer argumento",
  );
});
