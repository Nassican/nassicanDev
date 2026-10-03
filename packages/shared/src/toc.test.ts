import assert from "node:assert/strict";
import { test } from "node:test";
import { tableOfContents, type ContentBlock } from "./content";

const heading = (text: string): ContentBlock => ({ type: "heading", text });
const para = (text: string): ContentBlock => ({ type: "paragraph", text });

test("saca los encabezados en orden y se salta el resto", () => {
  const toc = tableOfContents([
    para("intro"),
    heading("El problema"),
    para("cuerpo"),
    heading("La solución"),
  ]);

  assert.deepEqual(toc, [
    { id: "el-problema", text: "El problema" },
    { id: "la-solucion", text: "La solución" },
  ]);
});

/**
 * The bug the table of contents exposes: both fold to `resultado`, the browser
 * jumps to the first, and the second entry points at the wrong section while
 * looking like a broken anchor.
 */
test("dos encabezados iguales reciben ids distintos", () => {
  const toc = tableOfContents([heading("Resultado"), heading("Resultado"), heading("Resultado")]);

  assert.deepEqual(
    toc.map((e) => e.id),
    ["resultado", "resultado-2", "resultado-3"],
  );
});

test("los acentos se pliegan, que es lo que hace el ancla ASCII", () => {
  assert.equal(tableOfContents([heading("Migración")])[0].id, "migracion");
});

test("un encabezado de solo puntuación recibe un ancla igualmente", () => {
  const toc = tableOfContents([heading("¿?"), heading("···")]);

  assert.equal(toc.length, 2);
  assert.ok(toc.every((e) => e.id.length > 0), JSON.stringify(toc));
  assert.notEqual(toc[0].id, toc[1].id);
});

test("un cuerpo sin encabezados no tiene índice", () => {
  assert.deepEqual(tableOfContents([para("solo texto")]), []);
});

test("el texto se conserva tal cual, con acentos y mayúsculas", () => {
  assert.equal(tableOfContents([heading("Qué Aprendí")])[0].text, "Qué Aprendí");
});
