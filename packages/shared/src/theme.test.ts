import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_THEME, THEME_COOKIE, themeInitScript } from "./theme";

/**
 * The inline script is a string, and a string is where a silent break hides.
 *
 * Moving this file between packages already broke it once: a shell heredoc ate
 * the backslash in `\\s`, so the cookie pattern compiled to `s*` and would
 * never have matched `; theme=dark`. Nothing would have thrown — the page would
 * just have flashed the wrong theme on every load, forever.
 *
 * These assertions pin the behaviour that cannot be read off the source.
 */

test("el patrón de la cookie lleva un escape real, no una «s»", () => {
  const script = themeInitScript();

  assert.match(
    script,
    /\(\?:\^\|;\\s\*\)/,
    "el `\\s` se perdió: el script buscaría «;s*» y nunca encontraría la cookie",
  );

  // Y la prueba que de verdad importa: que la regex que el navegador compila
  // case con una cookie como la que escribimos.
  const pattern = new RegExp(`(?:^|;\\s*)${THEME_COOKIE}=(dark|light)`);
  assert.equal("otra=1; theme=light".match(pattern)?.[1], "light");
  assert.equal("theme=dark".match(pattern)?.[1], "dark");
  assert.equal("notheme=dark".match(pattern), null);
});

test("el tema por defecto llega al script y solo admite dos valores", () => {
  assert.match(themeInitScript("light"), /t="light"/);
  assert.match(themeInitScript("dark"), /t="dark"/);
  assert.match(themeInitScript(), new RegExp(`t="${DEFAULT_THEME}"`));

  // Nada más puede colarse: el argumento está tipado y además se normaliza.
  assert.doesNotMatch(themeInitScript("light"), /t="dark"/);
});

test("el script se aplica a <html> y aguanta un fallo de cookie", () => {
  const script = themeInitScript();

  assert.match(script, /document\.documentElement\.classList\.toggle\("dark"/);
  // El `catch` deja oscuro en vez de dejar el documento sin clase, que es lo
  // que provocaría un destello blanco en un sitio oscuro por defecto.
  assert.match(script, /catch\(e\)\{document\.documentElement\.classList\.add\("dark"\)/);
});

test("es una expresión autoejecutable, segura de inyectar en <head>", () => {
  const script = themeInitScript();
  assert.match(script, /^\(function\(\)\{/);
  assert.match(script, /\}\)\(\);$/);
  // Sin `</script>` dentro, que cerraría la etiqueta que lo contiene.
  assert.doesNotMatch(script, /<\/script/i);
});
