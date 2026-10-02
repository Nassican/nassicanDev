import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultListFilters,
  filterList,
  fold,
  listFiltersFromParams,
  listParams,
  type ListFacets,
} from "./list-filters";

type Row = ListFacets & { id: string };
const read = (row: Row): ListFacets => row;

const rows: Row[] = [
  { id: "1", title: "Páginas del sitio", handle: "paginas", status: "published", date: "2026-03-01" },
  { id: "2", title: "Álgebra de bloques", handle: "algebra", status: "draft", date: null },
  { id: "3", title: "Benchmark de Neon", handle: "neon", status: "published", date: "2026-09-01" },
  { id: "4", title: "Cómo migré a Prisma", handle: "prisma", status: "draft", date: "2026-05-01" },
];

const ids = (list: Row[]) => list.map((r) => r.id).join(",");

test("buscar ignora acentos en los dos sentidos", () => {
  // Escribir sin tilde debe encontrar lo que la lleva: exigir la tilde es
  // exigir que escribas bien lo que todavía no has encontrado.
  const sinTilde = filterList(rows, { ...defaultListFilters, search: "paginas" }, read);
  assert.equal(ids(sinTilde), "1");

  const conTilde = filterList(rows, { ...defaultListFilters, search: "álgebra" }, read);
  assert.equal(ids(conTilde), "2");

  const alReves = filterList(rows, { ...defaultListFilters, search: "algebra" }, read);
  assert.equal(ids(alReves), "2");
});

test("buscar mira el título y el identificador", () => {
  assert.equal(ids(filterList(rows, { ...defaultListFilters, search: "neon" }, read)), "3");
  assert.equal(ids(filterList(rows, { ...defaultListFilters, search: "prisma" }, read)), "4");
  assert.equal(ids(filterList(rows, { ...defaultListFilters, search: "nada" }, read)), "");
});

test("filtrar por estado", () => {
  const drafts = filterList(rows, { ...defaultListFilters, status: "draft" }, read);
  assert.deepEqual(drafts.map((r) => r.status), ["draft", "draft"]);
});

test("sin fecha no significa el final de la lista", () => {
  // Un borrador recién creado no tiene fecha, y enterrarlo abajo es donde se
  // pierde lo que acabas de empezar.
  const byDate = filterList(rows, defaultListFilters, read);
  assert.equal(byDate[0].id, "2", "el borrador sin fecha debería ir primero");
  assert.equal(ids(byDate), "2,3,4,1");
});

test("ordenar por título respeta el alfabeto español", () => {
  const asc = filterList(
    rows,
    { ...defaultListFilters, sort: "title", direction: "asc" },
    read,
  );
  assert.equal(asc[0].title, "Álgebra de bloques", "Á debe ordenar como A");
});

test("el orden es estable y no depende del azar", () => {
  const empate: Row[] = [
    { id: "b", title: "Beta", handle: "b", status: "draft", date: "2026-01-01" },
    { id: "a", title: "Alfa", handle: "a", status: "draft", date: "2026-01-01" },
  ];
  // Misma fecha: desempata el título, siempre igual.
  assert.equal(ids(filterList(empate, defaultListFilters, read)), "a,b");
  assert.equal(ids(filterList(empate, defaultListFilters, read)), "a,b");
});

test("filtrar no muta la lista original", () => {
  const before = ids(rows);
  filterList(rows, { ...defaultListFilters, sort: "title" }, read);
  assert.equal(ids(rows), before);
});

test("la URL solo lleva lo que se aparta de lo normal", () => {
  assert.equal(listParams(defaultListFilters), "");
  assert.equal(
    listParams({ search: "neon", status: "draft", sort: "title", direction: "asc" }),
    "?q=neon&status=draft&sort=title&dir=asc",
  );
});

test("una URL manipulada no rompe nada", () => {
  const f = listFiltersFromParams({ sort: "inventado", dir: "raro", q: "  " });
  assert.equal(f.sort, "date");
  assert.equal(f.direction, "desc");
  assert.equal(f.search, null);

  // Y los parámetros repetidos se quedan con el primero.
  assert.equal(listFiltersFromParams({ q: ["uno", "dos"] }).search, "uno");
});

test("fold también quita la tilde de la ñ, y es lo que se quiere", () => {
  // La ñ se descompone en n + tilde, así que fold la deja en n. No es un
  // descuido: escribir "espana" debe encontrar "España", igual que "paginas"
  // encuentra "Páginas". Exigir el teclado correcto para buscar es exigir que
  // escribas bien lo que aún no has encontrado.
  assert.equal(fold("  ÁÉÍÓÚ  "), "aeiou");
  assert.equal(fold("España"), "espana");

  const rows = [{ id: "1", title: "Diseño en España", handle: "x", status: "draft", date: null }];
  assert.equal(
    filterList(rows, { ...defaultListFilters, search: "diseno espana".split(" ")[0] }, read).length,
    1,
  );
});
