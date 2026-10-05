import assert from "node:assert/strict";
import { test } from "node:test";
import {
  libraryQuery,
  pageOf,
  parseLibraryState,
  selectMedia,
  type LibraryRow,
  type LibraryState,
} from "./media-view";

const base: LibraryState = { folder: "all", filter: "all", sort: "recent", view: "grid", q: "", page: 0 };

function row(id: string, over: Partial<LibraryRow> = {}): LibraryRow {
  return {
    id,
    url: `/media/${id}.webp`,
    sizeBytes: 1000,
    createdAt: "2026-10-01T00:00:00.000Z",
    folderId: null,
    text: { es: { alt: "Diploma", caption: "" }, en: { alt: "Diploma", caption: "" } },
    usage: [],
    ...over,
  };
}

test("the address round-trips, and defaults stay out of it", () => {
  assert.equal(libraryQuery(base), "");
  const state: LibraryState = { folder: "none", filter: "unused", sort: "largest", view: "list", q: "diseño", page: 2 };
  assert.deepEqual(parseLibraryState(new URLSearchParams(libraryQuery(state))), state);
});

test("unknown values fall back instead of breaking the page", () => {
  const state = parseLibraryState(new URLSearchParams("filtro=x&orden=y&vista=z&pagina=-3"));
  assert.deepEqual(state, base);
});

test("folders scope the selection, and «none» means filed nowhere", () => {
  const rows = [row("a", { folderId: "f1" }), row("b"), row("c", { folderId: "f2" })];
  assert.deepEqual(selectMedia(rows, { ...base, folder: "f1" }).map((r) => r.id), ["a"]);
  assert.deepEqual(selectMedia(rows, { ...base, folder: "none" }).map((r) => r.id), ["b"]);
  assert.equal(selectMedia(rows, base).length, 3);
});

test("search ignores accents and reads both languages and where it is used", () => {
  const rows = [
    row("a", { text: { es: { alt: "Diseño del logo", caption: "" }, en: { alt: "Logo design", caption: "" } } }),
    row("b", { usage: [{ label: "Curso de Git" }] }),
    row("c"),
  ];
  assert.deepEqual(selectMedia(rows, { ...base, q: "diseno" }).map((r) => r.id), ["a"]);
  assert.deepEqual(selectMedia(rows, { ...base, q: "logo DESIGN" }).map((r) => r.id), ["a"]);
  assert.deepEqual(selectMedia(rows, { ...base, q: "git" }).map((r) => r.id), ["b"]);
});

test("filters: missing alt in any language, in use, unused", () => {
  const rows = [
    row("a", { text: { es: { alt: "x", caption: "" }, en: { alt: " ", caption: "" } } }),
    row("b", { usage: [{ label: "perfil" }] }),
  ];
  assert.deepEqual(selectMedia(rows, { ...base, filter: "missing-alt" }).map((r) => r.id), ["a"]);
  assert.deepEqual(selectMedia(rows, { ...base, filter: "in-use" }).map((r) => r.id), ["b"]);
  assert.deepEqual(selectMedia(rows, { ...base, filter: "unused" }).map((r) => r.id), ["a"]);
});

test("sorting by size breaks ties by date, newest first", () => {
  const rows = [
    row("old", { sizeBytes: 5, createdAt: "2026-01-01T00:00:00.000Z" }),
    row("new", { sizeBytes: 5, createdAt: "2026-09-01T00:00:00.000Z" }),
    row("big", { sizeBytes: 9 }),
  ];
  assert.deepEqual(selectMedia(rows, { ...base, sort: "largest" }).map((r) => r.id), ["big", "new", "old"]);
  assert.deepEqual(selectMedia(rows, { ...base, sort: "oldest" }).map((r) => r.id)[0], "old");
});

test("a page past the end lands on the last one, not on an empty grid", () => {
  const rows = Array.from({ length: 50 }, (_, i) => i);
  assert.deepEqual(pageOf(rows, 7, 48), { rows: [48, 49], page: 1, pages: 2 });
  assert.deepEqual(pageOf([], 3, 48), { rows: [], page: 0, pages: 1 });
});
