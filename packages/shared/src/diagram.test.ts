import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDiagram } from "./diagram";
import { blocksToMarkdown, markdownToBlocks } from "./markdown";

const source = `# Dos aplicaciones y una base
Sitio público | nassican.com | apps/web
Panel de gestión | app.nassican.com

--- importan ---
packages/db | esquema
---
PostgreSQL`;

test("layers, boxes, details, arrow labels and the caption", () => {
  assert.deepEqual(parseDiagram(source), {
    caption: "Dos aplicaciones y una base",
    tiers: [
      {
        link: null,
        nodes: [
          { title: "Sitio público", details: ["nassican.com", "apps/web"] },
          { title: "Panel de gestión", details: ["app.nassican.com"] },
        ],
      },
      { link: "importan", nodes: [{ title: "packages/db", details: ["esquema"] }] },
      { link: null, nodes: [{ title: "PostgreSQL", details: [] }] },
    ],
  });
});

test("a single box is a diagram; a title with a hyphen is not a separator", () => {
  assert.deepEqual(parseDiagram("Cliente-servidor")?.tiers, [
    { link: null, nodes: [{ title: "Cliente-servidor", details: [] }] },
  ]);
});

test("what cannot be drawn is null, so it stays a code block", () => {
  assert.equal(parseDiagram(""), null);
  assert.equal(parseDiagram("# solo un pie"), null);
  // A layer with no boxes: two separators in a row, or one at either end.
  assert.equal(parseDiagram("A\n---\n---\nB"), null);
  assert.equal(parseDiagram("A\n---"), null);
  assert.equal(parseDiagram("---\nA"), null);
  assert.equal(parseDiagram("| detalle sin título"), null);
});

test("a diagram block survives the editor's Markdown view", () => {
  const blocks = [{ type: "code" as const, language: "diagram", code: source }];
  const back = markdownToBlocks(blocksToMarkdown(blocks));
  assert.deepEqual(back.losses, []);
  assert.deepEqual(back.blocks, blocks);
});
