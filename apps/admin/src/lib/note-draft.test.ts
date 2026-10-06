import assert from "node:assert/strict";
import { test } from "node:test";
import { backlinks, excerpt, findByTitle, parseInline, parseNote, parseTags, wikiLinks, withoutWikiLinks } from "./note-draft";

test("tags: one spelling each, in the order first typed", () => {
  assert.deepEqual(parseTags("Next.js, #aprendizaje, next.js,  , Bases de   datos"), ["next.js", "aprendizaje", "bases de datos"]);
});

test("links between notes are found, and matched without accents or case", () => {
  const notes = [
    { id: "a", title: "Índices en Postgres", body: "" },
    { id: "b", title: "Rendimiento", body: "Ver [[indices en postgres]] y [[Otra]]." },
    { id: "c", title: "Sin enlaces", body: "nada" },
  ];
  assert.deepEqual(wikiLinks(notes[1].body), ["indices en postgres", "Otra"]);
  assert.deepEqual(backlinks(notes, notes[0]).map((n) => n.id), ["b"]);
  assert.equal(findByTitle(notes, "INDICES EN POSTGRES")?.id, "a");
});

test("inline markup keeps every address", () => {
  assert.deepEqual(parseInline("Mira [la guía](https://nextjs.org/docs) y https://neon.tech/docs."), [
    { kind: "text", text: "Mira " },
    { kind: "link", text: "la guía", href: "https://nextjs.org/docs" },
    { kind: "text", text: " y " },
    { kind: "link", text: "https://neon.tech/docs", href: "https://neon.tech/docs" },
    { kind: "text", text: "." },
  ]);
});

test("code is literal: nothing inside it is read as markup", () => {
  assert.deepEqual(parseInline("usa `**no** [[x]]` aquí"), [
    { kind: "text", text: "usa " },
    { kind: "code", text: "**no** [[x]]" },
    { kind: "text", text: " aquí" },
  ]);
});

test("blocks: headings, lists, quotes, fences and paragraphs", () => {
  const blocks = parseNote("# Título\n\nUna línea\nque sigue.\n\n- uno\n- dos\n1. primero\n\n> cita\n\n```ts\nconst a = 1;\n```");
  assert.deepEqual(
    blocks.map((b) => b.type),
    ["heading", "paragraph", "list", "list", "quote", "code"],
  );
  const code = blocks.at(-1);
  assert.deepEqual(code, { type: "code", language: "ts", code: "const a = 1;" });
  const list = blocks[2];
  assert.ok(list.type === "list" && list.items.length === 2 && !list.ordered);
});

test("the excerpt is plain text, cut at a word", () => {
  assert.equal(excerpt("# Hola\n\n**Postgres** usa [[MVCC]] y [docs](https://x.y)."), "Hola Postgres usa MVCC y docs.");
});

test("an article made from a note reads [[links]] as their title", () => {
  assert.equal(withoutWikiLinks("Ver [[MVCC]] primero."), "Ver MVCC primero.");
});
