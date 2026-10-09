import assert from "node:assert/strict";
import { test } from "node:test";
import { relatedBySharedTags, tableOfContents, type ContentBlock } from "./content";
import { blocksToMarkdown, markdownToBlocks } from "./markdown";

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
    { id: "el-problema", text: "El problema", level: 2 },
    { id: "la-solucion", text: "La solución", level: 2 },
  ]);
});

test("una subsección lleva su nivel, y lo demás es sección", () => {
  const toc = tableOfContents([heading("Tipos"), { type: "heading", text: "Monolito", level: 3 }]);
  assert.deepEqual(toc.map((e) => e.level), [2, 3]);
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

test("sigue leyendo: primero lo que comparte más etiquetas, y se rellena con lo más nuevo", () => {
  const post = (slug: string, ...tags: string[]) => ({ slug, tags });
  const current = post("a", "Claude Code", "Windows");
  const all = [post("nuevo"), post("a", "Claude Code", "Windows"), post("uno", "Claude Code"), post("dos", "Windows", "Claude Code"), post("viejo")];

  assert.deepEqual(relatedBySharedTags(current, all, 3).map((p) => p.slug), ["dos", "uno", "nuevo"]);
  assert.deepEqual(relatedBySharedTags(current, [current]), []);
});

test("la vista Markdown conserva secciones y subsecciones, y una sección no lleva nivel", () => {
  const { blocks, losses } = markdownToBlocks("# Título pegado\n\n## Sección\n\n### Subsección\n\n#### Más honda");
  assert.deepEqual(losses, []);
  assert.deepEqual(blocks, [
    { type: "heading", text: "Título pegado" },
    { type: "heading", text: "Sección" },
    { type: "heading", text: "Subsección", level: 3 },
    { type: "heading", text: "Más honda", level: 3 },
  ]);
  assert.equal(blocksToMarkdown(blocks), "## Título pegado\n\n## Sección\n\n### Subsección\n\n### Más honda");
});
