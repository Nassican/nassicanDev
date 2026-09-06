import assert from "node:assert/strict";
import test from "node:test";
import type { ContentBlock } from "./content";
import {
  blocksToMarkdown,
  describeLoss,
  imageIndex,
  markdownToBlocks,
  normaliseBody,
} from "./markdown";

/**
 * The Markdown mode rests on one property: switching to Markdown and back must
 * hand you the same body. If it ever stops holding, a case study silently
 * changes shape every time its author toggles a button - which is exactly the
 * kind of failure nobody notices until it is in production.
 *
 * Run with `npm test`. Node's own runner, so this costs no dependency.
 */

const sample: ContentBlock[] = [
  { type: "heading", text: "El problema" },
  { type: "paragraph", text: "CursoVisor guardaba el progreso en localStorage." },
  { type: "list", items: ["Se perdía al limpiar el navegador", "No cruzaba de equipo"] },
  { type: "list", items: ["Primero esto", "Después lo otro"], ordered: true },
  {
    type: "code",
    language: "ts",
    code: "const db = new PrismaClient();\nawait db.$connect();",
  },
  { type: "quote", text: "Un bloque mal formado falla en tsc." },
  {
    type: "image",
    mediaId: "abc-123",
    url: "/media/deadbeef.webp",
    alt: "Captura del panel",
    caption: "La biblioteca con filtros",
  },
  { type: "paragraph", text: "Cierre del caso." },
];

/**
 * Key order is not content: bodies live in a `jsonb` column and Postgres does
 * not preserve it either. Comparing raw JSON made this fail on a difference
 * that cannot exist by the time it is stored.
 */
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );

test("bloques -> markdown -> bloques no pierde nada", () => {
  const back = markdownToBlocks(blocksToMarkdown(sample), imageIndex(sample));

  assert.equal(canonical(back.blocks), canonical(normaliseBody(sample)));
  assert.deepEqual(back.losses.map(describeLoss), []);
});

test("las dos formas de escribir una lista sin ordenar convergen", () => {
  const explicit = [{ type: "list" as const, items: ["a", "b"], ordered: false }];
  const implicit = [{ type: "list" as const, items: ["a", "b"] }];

  // Ambas existen en la base y se dibujan igual; markdown no puede distinguirlas.
  assert.equal(canonical(normaliseBody(explicit)), canonical(implicit));
  assert.equal(
    canonical(markdownToBlocks(blocksToMarkdown(explicit)).blocks),
    canonical(implicit),
  );

  // Una lista ordenada sí sobrevive tal cual.
  const ordered = [{ type: "list" as const, items: ["a", "b"], ordered: true }];
  assert.equal(
    canonical(markdownToBlocks(blocksToMarkdown(ordered)).blocks),
    canonical(ordered),
  );
});

test("cada tipo de bloque sobrevive por separado", () => {
  for (const block of sample) {
    const back = markdownToBlocks(blocksToMarkdown([block]), imageIndex([block]));
    assert.equal(
      canonical(back.blocks),
      canonical(normaliseBody([block])),
      `falló ${block.type}`,
    );
  }
});

test("lo que un bloque no puede guardar se reporta, no se pierde en silencio", () => {
  const source = [
    "# Título",
    "",
    "Esto lleva **negrita** y un [enlace](https://ejemplo.com) dentro.",
    "",
    "| a | b |",
    "| - | - |",
    "| 1 | 2 |",
    "",
    "- nivel uno",
    "  - anidado",
    "",
    "![foto](/media/desconocida.webp)",
    "",
    "<div>hola</div>",
  ].join("\n");

  const { blocks, losses } = markdownToBlocks(source);
  const kinds = new Set(losses.map((l) => l.kind));

  for (const kind of ["emphasis", "link", "table", "nested-list", "html", "unknown-image"]) {
    assert.ok(kinds.has(kind as never), `no avisó de ${kind}`);
  }

  const text = JSON.stringify(blocks);
  assert.ok(!text.includes("**"), "quedaron asteriscos literales");
  assert.ok(!text.includes("<div>"), "quedó HTML literal");
  assert.ok(text.includes("negrita"), "se perdió la palabra que llevaba énfasis");
  assert.ok(text.includes("enlace"), "se perdió el texto del enlace");
  assert.ok(!text.includes("ejemplo.com"), "la URL sobrevivió dentro del texto");
  assert.ok(
    !blocks.some((b) => b.type === "image"),
    "inventó un bloque de imagen que no está en la biblioteca",
  );
});

test("un cuerpo vacío va y vuelve vacío", () => {
  assert.deepEqual(markdownToBlocks(blocksToMarkdown([])).blocks, []);
  assert.deepEqual(markdownToBlocks("   \n\n  ").blocks, []);
});
