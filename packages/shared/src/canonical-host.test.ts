import assert from "node:assert/strict";
import test from "node:test";
import { isCanonicalHost } from "./seo";

/**
 * This function decides whether a hostname gets `Disallow: /`.
 *
 * Its failure mode is not a broken page — it is de-indexing the real site,
 * which no monitoring catches and which takes weeks to recover from. So the
 * tests are written around one rule: **blocking requires positive evidence of
 * the wrong hostname, never the absence of evidence of the right one.**
 */

const SITE = "https://www.nassican.com";

test("el host canónico pasa, con y sin puerto implícito", () => {
  assert.equal(isCanonicalHost("www.nassican.com", SITE), true);
  assert.equal(isCanonicalHost("WWW.NASSICAN.COM", SITE), true);
  assert.equal(isCanonicalHost("www.nassican.com:443", SITE), true);
  assert.equal(isCanonicalHost("www.nassican.com", "https://www.nassican.com/"), true);
});

test("las URL de despliegue de Vercel se bloquean", () => {
  // Las que la API devolvió de verdad: diez copias rastreables del sitio.
  for (const host of [
    "nassican-dev.vercel.app",
    "nassican-75e1tqyi2-jesusbenavides-projects.vercel.app",
    "nassican-6azjdvl8q-jesusbenavides-projects.vercel.app",
  ]) {
    assert.equal(isCanonicalHost(host, SITE), false, `debería bloquear ${host}`);
  }
});

test("el ápex también se bloquea: redirige, no sirve", () => {
  // nassican.com responde 308 hacia www, así que si algo llega aquí pidiendo
  // robots.txt no es el host canónico.
  assert.equal(isCanonicalHost("nassican.com", SITE), false);
});

/**
 * El grupo que importa: todo lo que no se puede establecer pasa.
 */
test("falla abierto cuando no hay información suficiente", () => {
  // Sin host en la petición.
  assert.equal(isCanonicalHost(null, SITE), true);
  assert.equal(isCanonicalHost(undefined, SITE), true);
  assert.equal(isCanonicalHost("", SITE), true);
  assert.equal(isCanonicalHost("   ", SITE), true);

  // Sin origen configurado, o con uno roto: una variable de entorno mal puesta
  // no puede desindexar el sitio.
  assert.equal(isCanonicalHost("www.nassican.com", null), true);
  assert.equal(isCanonicalHost("www.nassican.com", ""), true);
  assert.equal(isCanonicalHost("cualquier-cosa.com", undefined), true);
  assert.equal(isCanonicalHost("cualquier-cosa.com", "no-es-una-url"), true);
  assert.equal(isCanonicalHost("cualquier-cosa.com", "https://"), true);
});

test("en local sigue funcionando", () => {
  // NEXT_PUBLIC_SITE_URL es http://localhost:3000 en desarrollo.
  assert.equal(isCanonicalHost("localhost:3000", "http://localhost:3000"), true);
  assert.equal(isCanonicalHost("localhost:3055", "http://localhost:3000"), false);
});

test("una cadena de proxies se juzga por el primer salto", () => {
  // `x-forwarded-host` puede traer varios separados por coma; el primero es el
  // que pidió el visitante.
  assert.equal(isCanonicalHost("www.nassican.com, interno.local", SITE), true);
  assert.equal(isCanonicalHost("algo.vercel.app, www.nassican.com", SITE), false);
});
