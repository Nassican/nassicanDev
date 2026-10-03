import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildIconSprite,
  fitSvg,
  iconSymbolId,
  looksLikeSvg,
  namespaceSvgIds,
  prepareIconSvg,
  sanitiseSvg,
  svgToSymbol,
} from "./svg-icon";

/** Trimmed from the real devicon files, ids and all. */
const VITE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128"><defs><linearGradient id="a"><stop stop-color="#41d1ff"/><stop offset="1" stop-color="#bd34fe"/></linearGradient><linearGradient id="b"><stop stop-color="#ffea83"/></linearGradient></defs><path fill="url(#a)" d="M0 0h10v10H0z"/><path fill="url(#b)" d="M2 2h6v6H2z"/></svg>`;

const NODE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><linearGradient id="a"><stop stop-color="#41873f"/></linearGradient></defs><path fill="url(#a)" d="M0 0h10v10H0z"/></svg>`;

/**
 * The collision that made this module necessary. Devicon numbers its gradients
 * `a`, `b`, `c` in every file, so two inlined icons share names and the second
 * paints itself with the first one's gradient.
 */
test("dos iconos distintos dejan de compartir el id 'a'", () => {
  const vite = namespaceSvgIds(VITE, "Vite");
  const node = namespaceSvgIds(NODE, "Node.js");

  assert.ok(vite.includes('id="vite-a"'));
  assert.ok(node.includes('id="node-js-a"'));
  assert.ok(!vite.includes('id="a"'));

  // And no id survives in both documents, which is the property that matters.
  const idsOf = (s: string) => [...s.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  const shared = idsOf(vite).filter((id) => idsOf(node).includes(id));
  assert.deepEqual(shared, []);
});

test("las referencias se renombran con los ids, o el degradado se pierde", () => {
  const vite = namespaceSvgIds(VITE, "Vite");

  assert.ok(vite.includes("url(#vite-a)"));
  assert.ok(vite.includes("url(#vite-b)"));
  assert.ok(!vite.includes("url(#a)"));
});

/**
 * Renaming `a` before `ab` would turn `url(#ab)` into `url(#key-ab)`'s wrong
 * cousin, so the longest name goes first.
 */
test("un id corto no corrompe la referencia a uno largo", () => {
  const svg = `<svg><defs><linearGradient id="a"/><linearGradient id="ab"/></defs><path fill="url(#ab)"/><path fill="url(#a)"/></svg>`;
  const out = namespaceSvgIds(svg, "x");

  assert.ok(out.includes("url(#x-ab)"), out);
  assert.ok(out.includes("url(#x-a)"), out);
  assert.ok(!out.includes("url(#x-x-"), "no debería renombrar dos veces");
});

test("un svg sin ids se deja intacto", () => {
  const svg = `<svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>`;
  assert.equal(namespaceSvgIds(svg, "docker"), svg);
});

test("una clave con puntos o espacios produce un id válido", () => {
  const out = namespaceSvgIds(VITE, "Tailwind CSS");
  assert.ok(out.includes('id="tailwind-css-a"'), out);
});

// --------------------------------------------------------------- saneado

test("se quitan los scripts", () => {
  const out = sanitiseSvg(`<svg><script>alert(1)</script><path/></svg>`);
  assert.ok(!out.includes("script"), out);
});

test("se quitan los manejadores de eventos", () => {
  const out = sanitiseSvg(`<svg><path onclick="alert(1)" d="M0 0"/></svg>`);
  assert.ok(!out.includes("onclick"), out);
  assert.ok(out.includes('d="M0 0"'), "el resto del path debe sobrevivir");
});

test("se quitan las referencias externas", () => {
  const out = sanitiseSvg(`<svg><image xlink:href="https://x/y.png"/></svg>`);
  assert.ok(!out.includes("xlink:href"), out);
  assert.ok(!out.includes("image"), out);
});

test("un svg legítimo sobrevive al saneado con sus colores", () => {
  const out = sanitiseSvg(VITE);
  assert.ok(out.includes("#41d1ff"));
  assert.ok(out.includes("#bd34fe"));
  assert.ok(out.includes("linearGradient"));
});

// ----------------------------------------------------------------- tamaño

test("se quitan width y height fijos pero se conserva el viewBox", () => {
  const out = fitSvg(VITE);

  assert.ok(out.includes('viewBox="0 0 128 128"'), out);
  assert.ok(!/\swidth="128"/.test(out), out);
  assert.ok(out.includes('width="100%"'));
});

test("el icono queda oculto para lectores de pantalla", () => {
  // The name is written next to it, so the glyph is decoration.
  assert.ok(fitSvg(VITE).includes('aria-hidden="true"'));
});

// -------------------------------------------------------------- en conjunto

test("prepareIconSvg hace las tres cosas de una vez", () => {
  const out = prepareIconSvg(VITE, "Vite");

  assert.ok(out.includes('id="vite-a"'));
  assert.ok(out.includes("url(#vite-a)"));
  assert.ok(out.includes("#bd34fe"), "los colores de marca son el objetivo");
  assert.ok(out.includes('width="100%"'));
});

test("looksLikeSvg rechaza lo que no es un documento svg", () => {
  assert.ok(looksLikeSvg(VITE));
  assert.ok(!looksLikeSvg("<div>hola</div>"));
  assert.ok(!looksLikeSvg("<svg><path/>"));
  assert.ok(!looksLikeSvg(""));
});

// ------------------------------------------------------------------ sprite

test("svgToSymbol conserva el viewBox y el contenido, no el <svg>", () => {
  const out = svgToSymbol(fitSvg(VITE), "tech-vite");

  assert.ok(out.startsWith('<symbol id="tech-vite" viewBox="0 0 128 128">'), out);
  assert.ok(out.endsWith("</symbol>"));
  assert.ok(!out.includes("<svg"), "el svg externo sobra dentro del sprite");
  assert.ok(out.includes("linearGradient"), "los degradados van dentro del símbolo");
  assert.ok(out.includes("#bd34fe"));
});

test("un símbolo sin viewBox recibe uno por defecto en vez de quedar sin forma", () => {
  const out = svgToSymbol("<svg><path/></svg>", "x");
  assert.ok(out.includes('viewBox="0 0 24 24"'), out);
});

/**
 * The property the sprite exists for: each logo appears once however many chips
 * reference it. The marquee repeats its list to loop, so before this the home
 * page carried Docker's 4.5 KB mark ten times.
 */
test("el sprite define cada icono una sola vez", () => {
  const sprite = buildIconSprite([
    { key: "Vite", svg: prepareIconSvg(VITE, "Vite") },
    { key: "Node.js", svg: prepareIconSvg(NODE, "Node.js") },
  ]);

  assert.equal((sprite.match(/<symbol/g) ?? []).length, 2);
  assert.ok(sprite.includes('id="tech-vite"'));
  assert.ok(sprite.includes('id="tech-node-js"'));

  // And the gradient ids inside are still the namespaced ones, so two symbols in
  // one sprite do not collide either.
  assert.ok(sprite.includes('id="vite-a"'));
  assert.ok(sprite.includes('id="node-js-a"'));
});

test("el sprite está oculto sin usar display:none", () => {
  const sprite = buildIconSprite([{ key: "Vite", svg: prepareIconSvg(VITE, "Vite") }]);

  assert.ok(sprite.includes('aria-hidden="true"'));
  assert.ok(sprite.includes("width:0"));
  // `display:none` stops referenced gradients resolving in some browsers.
  assert.ok(!sprite.includes("display:none"));
});

test("un sprite sin iconos es cadena vacía, no un svg vacío", () => {
  assert.equal(buildIconSprite([]), "");
});

test("iconSymbolId limpia la clave igual que el prefijo de los ids", () => {
  assert.equal(iconSymbolId("Tailwind CSS"), "tech-tailwind-css");
  assert.equal(iconSymbolId("Node.js"), "tech-node-js");
});
