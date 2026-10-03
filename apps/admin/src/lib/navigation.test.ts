import assert from "node:assert/strict";
import { test } from "node:test";
import { activeHref, navigation } from "./navigation";

test("el dashboard solo coincide exacto", () => {
  assert.equal(activeHref("/"), "/");
  assert.equal(activeHref("/juegos"), "/juegos");
});

test("un subárbol ilumina su entrada", () => {
  assert.equal(activeHref("/contenido/blogs/abc-123"), "/contenido/blogs");
});

/**
 * The regression this file exists for: «Personal» has a page of its own and is
 * not an entry in any list, so matching only entries left `/personal` lighting
 * up nothing — the one route in the panel that highlighted no heading.
 */
test("la página propia de una sección también ilumina", () => {
  assert.equal(activeHref("/personal"), "/personal");
});

test("gana la coincidencia más larga, no la primera", () => {
  // `/contenido/blogs` and `/contenido/paginas` share a prefix; neither should
  // win over the other by being declared first.
  assert.equal(activeHref("/contenido/paginas/x"), "/contenido/paginas");
});

test("una ruta que no es de ningún módulo no ilumina nada", () => {
  assert.equal(activeHref("/login"), null);
});

test("cada sección plegable tiene una página propia", () => {
  // Folding a group with nowhere to go would hide its entries behind a heading
  // that does nothing.
  for (const section of navigation) {
    if (section.collapsible) assert.ok(section.href, `${section.label} se pliega y no tiene página`);
  }
});

test("ninguna entrada está duplicada entre secciones", () => {
  const hrefs = navigation.flatMap((s) => s.entries.map((e) => e.href));
  assert.equal(hrefs.length, new Set(hrefs).size);
});
