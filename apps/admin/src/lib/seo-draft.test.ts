import assert from "node:assert/strict";
import test from "node:test";
import { extractVerificationToken, verificationProblem } from "./seo-draft";

/**
 * Search Console shows you the whole `<meta>` tag and says to copy it, while
 * this field wants the token alone — Next builds the element itself. Pasting the
 * tag produced a meta element nested inside its own content attribute: valid
 * HTML, served for weeks, verification never passing, and nothing able to report
 * it because the field was filled and the tag was there.
 *
 * These are the shapes a clipboard actually hands over.
 */

const TOKEN = "mCA_Y36OEQs0RjIsoPxWPFFAuydOpqHCsXKptwVa420";

test("la etiqueta pegada entera se reduce al token", () => {
  for (const pasted of [
    `<meta name="google-site-verification" content="${TOKEN}" />`,
    `<meta name="google-site-verification" content="${TOKEN}">`,
    `<meta content="${TOKEN}" name="google-site-verification" />`,
    `<meta name='google-site-verification' content='${TOKEN}' />`,
    `  <meta name="google-site-verification" content="${TOKEN}" />  `,
  ]) {
    assert.equal(extractVerificationToken(pasted), TOKEN, `falló con: ${pasted}`);
  }
});

test("el token suelto se deja intacto", () => {
  assert.equal(extractVerificationToken(TOKEN), TOKEN);
  assert.equal(extractVerificationToken(`  ${TOKEN}  `), TOKEN);
});

test("también se acepta la línea del archivo de verificación", () => {
  // Es lo que contiene googleXXXX.html, y es plausible pegarlo por confusión.
  assert.equal(
    extractVerificationToken("google-site-verification: google1be6c3bc11e05264.html"),
    "google1be6c3bc11e05264.html",
  );
  assert.equal(extractVerificationToken(`content="${TOKEN}"`), TOKEN);
});

test("vacío sigue siendo vacío, no una cadena rara", () => {
  assert.equal(extractVerificationToken(""), "");
  assert.equal(extractVerificationToken("   "), "");
  assert.equal(verificationProblem(""), null);
});

test("lo que sigue pareciendo HTML se rechaza en vez de guardarse", () => {
  // Una etiqueta sin `content` no deja token que extraer: mejor negarse que
  // guardar el fragmento y volver a servir basura.
  assert.notEqual(verificationProblem('<meta name="google-site-verification" />'), null);
  assert.notEqual(verificationProblem("dos palabras"), null);

  // Y lo válido pasa.
  assert.equal(verificationProblem(TOKEN), null);
  assert.equal(
    verificationProblem(`<meta name="google-site-verification" content="${TOKEN}" />`),
    null,
  );
});
