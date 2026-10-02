import assert from "node:assert/strict";
import test from "node:test";
import {
  createPreviewToken,
  verifyPreviewToken,
  type PreviewKind,
} from "./preview";

/**
 * This token decides whether a stranger can read unpublished drafts.
 *
 * It is the mirror image of `isCanonicalHost`, which fails open because its bad
 * outcome is de-indexing the real site. Here the bad outcome is leaking content
 * that is not ready, so **everything it cannot verify is refused**.
 */

const SECRET = "un-secreto-de-prueba-suficientemente-largo";

const claim = { kind: "post" as PreviewKind, id: "abc-123" };

test("un token recién hecho vale, y dice de qué documento es", () => {
  const result = verifyPreviewToken(createPreviewToken(claim, SECRET), SECRET);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.claim.kind, "post");
  assert.equal(result.claim.id, "abc-123");
});

test("el secreto no viaja dentro del token", () => {
  const token = createPreviewToken(claim, SECRET);
  assert.ok(!token.includes(SECRET), "el secreto acabó en la URL");
});

test("otro secreto no abre la puerta", () => {
  const token = createPreviewToken(claim, SECRET);
  const result = verifyPreviewToken(token, "otro-secreto-distinto");

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.reason, /firma/);
});

test("un token caducado se rechaza", () => {
  // TTL negativo: nace vencido.
  const token = createPreviewToken(claim, SECRET, -1);
  const result = verifyPreviewToken(token, SECRET);

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.reason, /caduc/);
});

test("no se puede cambiar el documento sin romper la firma", () => {
  // El ataque obvio: coger un token válido y editar el id para ver otra cosa.
  const token = createPreviewToken(claim, SECRET);
  const [payload, signature] = token.split(".");

  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  decoded.id = "otro-documento";
  const forged = Buffer.from(JSON.stringify(decoded))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  assert.equal(verifyPreviewToken(`${forged}.${signature}`, SECRET).ok, false);
});

test("falla cerrado ante cualquier cosa que no pueda verificar", () => {
  for (const [token, secret] of [
    [null, SECRET],
    [undefined, SECRET],
    ["", SECRET],
    ["sin-punto", SECRET],
    [".", SECRET],
    ["payload.", SECRET],
    [".firma", SECRET],
    ["no-es-base64.firma", SECRET],
    // Y lo más importante: sin secreto en el sitio, nada pasa.
    [createPreviewToken(claim, SECRET), null],
    [createPreviewToken(claim, SECRET), ""],
  ] as const) {
    assert.equal(
      verifyPreviewToken(token, secret).ok,
      false,
      `debería rechazar: ${JSON.stringify(token)} / ${JSON.stringify(secret)}`,
    );
  }
});

test("solo se admiten los tres tipos conocidos", () => {
  const token = createPreviewToken(
    { kind: "inventado" as PreviewKind, id: "x" },
    SECRET,
  );
  assert.equal(verifyPreviewToken(token, SECRET).ok, false);

  for (const kind of ["post", "project", "page"] as PreviewKind[]) {
    assert.equal(
      verifyPreviewToken(createPreviewToken({ kind, id: "x" }, SECRET), SECRET).ok,
      true,
      `debería admitir ${kind}`,
    );
  }
});
