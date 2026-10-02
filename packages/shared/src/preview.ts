import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A short-lived pass that lets the panel open an unpublished page on the public
 * site, rendered by the site's own renderer.
 *
 * **Not exported from the package barrel, on purpose.** It imports
 * `node:crypto`, and `@nassican/shared` is imported by client components; a
 * barrel re-export would drag Node's crypto into a browser bundle. Reach it at
 * `@nassican/shared/preview`, which is why the package has an exports map.
 *
 * Why a signed token rather than a shared secret in the query string: a preview
 * link is a browser navigation, so whatever it carries ends up in history, in
 * `Referer` headers and in access logs. `REVALIDATE_SECRET` travels in an
 * `Authorization` header and must stay there — putting it in a URL would hand
 * out permanent cache-invalidation rights to anything that logged the request.
 *
 * So the secret signs, and never travels. What travels is a payload plus its
 * signature: useless for anything but this one document, and useless at all
 * after a few minutes.
 */

export type PreviewKind = "post" | "project" | "page";

export type PreviewClaim = {
  kind: PreviewKind;
  /** The content's own id, not its slug: a slug can change while editing. */
  id: string;
  /** Seconds since the epoch. */
  expiresAt: number;
};

/** Long enough to open the tab, short enough that a leaked link is spent. */
export const PREVIEW_TTL_SECONDS = 5 * 60;

const base64url = (input: string | Buffer) =>
  Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const sign = (payload: string, secret: string) =>
  base64url(createHmac("sha256", secret).update(payload).digest());

export function createPreviewToken(
  claim: Omit<PreviewClaim, "expiresAt">,
  secret: string,
  ttlSeconds = PREVIEW_TTL_SECONDS,
): string {
  const full: PreviewClaim = {
    ...claim,
    expiresAt: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const payload = base64url(JSON.stringify(full));
  return `${payload}.${sign(payload, secret)}`;
}

export type PreviewCheck =
  | { ok: true; claim: PreviewClaim }
  | { ok: false; reason: string };

/**
 * Verifies a token. Fails closed on everything — unlike `isCanonicalHost`,
 * which fails open, because the costs are opposite: there the bad outcome is
 * de-indexing the real site, here it is serving unpublished drafts to whoever
 * asks.
 */
export function verifyPreviewToken(
  token: string | null | undefined,
  secret: string | null | undefined,
): PreviewCheck {
  if (!token) return { ok: false, reason: "falta el token" };
  if (!secret) return { ok: false, reason: "el sitio no tiene secreto configurado" };

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return { ok: false, reason: "token mal formado" };

  const expected = sign(payload, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);

  // Compared in constant time: a length check first, because `timingSafeEqual`
  // throws on mismatched lengths and that throw is itself a signal.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "firma inválida" };
  }

  let claim: PreviewClaim;
  try {
    claim = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "contenido ilegible" };
  }

  if (!claim?.id || !["post", "project", "page"].includes(claim.kind)) {
    return { ok: false, reason: "token incompleto" };
  }

  if (!Number.isFinite(claim.expiresAt) || claim.expiresAt * 1000 < Date.now()) {
    return { ok: false, reason: "el enlace de vista previa caducó" };
  }

  return { ok: true, claim };
}
