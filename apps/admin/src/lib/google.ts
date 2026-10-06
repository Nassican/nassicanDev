import "server-only";

import { createSign } from "node:crypto";
import { headers } from "next/headers";
import { db } from "@nassican/db";
import { auth } from "@/lib/auth";

export type TokenResult =
  | { ok: true; token: string }
  | { ok: false; reason: string };

export const SCOPES = {
  analytics: "analytics.readonly",
  searchConsole: "webmasters.readonly",
  /**
   * PageSpeed needs no data scope at all: any token from the project only tells
   * Google whose quota to charge. `openid` is the smallest one there is, and the
   * operator's login already has it.
   */
  pagespeed: "openid",
} as const;

/** The full scope URLs a service account asks for; the short names are ours. */
const SCOPE_URLS: Record<string, string> = {
  "analytics.readonly": "https://www.googleapis.com/auth/analytics.readonly",
  "webmasters.readonly": "https://www.googleapis.com/auth/webmasters.readonly",
  openid: "openid",
};

// ---------------------------------------------------------- service account

type ServiceAccountKey = { client_email: string; private_key: string };

/**
 * The key, from one environment variable, in whichever shape it arrived.
 *
 * Google hands out a JSON file whose `private_key` is full of newlines, which
 * no `.env` survives intact. Base64 is the shape that pastes cleanly, so both
 * are accepted rather than making the operator remember which one this wants.
 */
function serviceAccountKey(): ServiceAccountKey | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.trim();
  if (!raw) return null;

  try {
    const json = raw.startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf8");
    const parsed = JSON.parse(json) as Partial<ServiceAccountKey>;

    if (!parsed.client_email || !parsed.private_key) return null;
    return {
      client_email: parsed.client_email,
      // A key pasted as raw JSON arrives with its newlines escaped.
      private_key: parsed.private_key.replace(/\\n/g, "\n"),
    };
  } catch {
    return null;
  }
}

export function hasServiceAccount(): boolean {
  return serviceAccountKey() !== null;
}

/** The address to grant access to, so the panel can show it instead of hiding it. */
export function serviceAccountEmail(): string | null {
  return serviceAccountKey()?.client_email ?? null;
}

const base64url = (input: Buffer | string) =>
  Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/**
 * Access tokens last an hour, so they are cached per scope.
 *
 * Best-effort by nature: a serverless instance may not live long enough to
 * reuse one. It costs nothing when it misses and saves a round trip when it
 * hits, which is the right trade for something on the path of every sync.
 */
const cache = new Map<string, { token: string; expiresAt: number }>();

/**
 * A token minted by the panel itself, with no user and no consent involved.
 *
 * This is the correct credential for what these two modules actually do: a
 * background job reading *its owner's* analytics. OAuth user consent exists for
 * an app acting on behalf of arbitrary people, and there are none here.
 *
 * It also sidesteps a trap that broke this silently for weeks. An OAuth app in
 * "Testing" gets refresh tokens that expire after seven days unless the only
 * scopes are profile ones - and `analytics.readonly` is not a profile scope. So
 * signing in kept working (each login mints a new token) while every background
 * read died, with nothing in the interface saying so.
 */
async function serviceAccountToken(scope: string): Promise<TokenResult> {
  const key = serviceAccountKey();
  if (!key) return { ok: false, reason: "sin clave de service account" };

  const scopeUrl = SCOPE_URLS[scope];
  if (!scopeUrl) return { ok: false, reason: `permiso desconocido: ${scope}` };

  const cached = cache.get(scope);
  // Thirty seconds of margin: a token that expires mid-request is a failure
  // that looks like a permissions problem.
  if (cached && cached.expiresAt > Date.now() + 30_000) {
    return { ok: true, token: cached.token };
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: key.client_email,
      scope: scopeUrl,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );

  try {
    // Signed here rather than with a library: it is one RS256 signature, and
    // the repository's rule is no new runtime dependency without a reason.
    const signer = createSign("RSA-SHA256");
    signer.update(`${header}.${claims}`);
    const signature = base64url(signer.sign(key.private_key));
    const assertion = `${header}.${claims}.${signature}`;

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
      cache: "no-store",
    });

    const body = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (!response.ok || !body.access_token) {
      const detail = body.error_description ?? body.error ?? `HTTP ${response.status}`;
      return {
        ok: false,
        reason: `la service account no obtuvo token (${detail}). Comprueba que ${key.client_email} tenga acceso de lectura a la propiedad.`,
      };
    }

    cache.set(scope, {
      token: body.access_token,
      expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
    });

    return { ok: true, token: body.access_token };
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof Error
          ? `clave de service account inválida: ${error.message}`
          : "fallo al firmar la aserción",
    };
  }
}

// ------------------------------------------------------- the operator's own

/**
 * The signed-in operator's Google token, refreshed by Better Auth.
 *
 * Kept as the fallback, not deleted: it is what works before a service account
 * exists, and it is the only route if an API turns out not to accept one. But
 * it is a stopgap - the grant behind it expires every seven days while the app
 * stays unpublished, and nothing warns when it does.
 */
async function operatorToken(scope: string): Promise<TokenResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, reason: "sin sesión" };

  const account = await db.account.findFirst({
    where: { userId: session.user.id, providerId: "google" },
    select: { id: true, scope: true, refreshToken: true },
  });

  if (!account) return { ok: false, reason: "no hay cuenta de Google vinculada" };

  if (!account.refreshToken) {
    return {
      ok: false,
      reason:
        "la cuenta no tiene refresh token; cierra sesión y vuelve a entrar para concederlo",
    };
  }

  if (!account.scope?.includes(scope)) {
    return {
      ok: false,
      reason: `la sesión no tiene el permiso ${scope}; vuelve a entrar para concederlo`,
    };
  }

  try {
    /**
     * `accountId` here means Better Auth's own row id, not the provider's
     * subject - the column called `accountId` in the same table. Passing the
     * latter produces "Account not found", an error that names neither of the
     * two ids involved.
     */
    const result = await auth.api.getAccessToken({
      body: { accountId: account.id },
      headers: await headers(),
    });

    const token = (result as { accessToken?: string })?.accessToken;
    if (!token) return { ok: false, reason: "Google no devolvió un token" };

    return { ok: true, token };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "fallo al refrescar el token";
    // `invalid_grant` is what a seven-day expiry looks like from here, and the
    // raw word explains nothing to whoever reads it in the panel.
    return {
      ok: false,
      reason: message.includes("invalid_grant")
        ? "el permiso de Google caducó (las apps en «Testing» caducan a los 7 días). Vuelve a entrar, o configura GOOGLE_SERVICE_ACCOUNT_KEY para que deje de caducar."
        : message,
    };
  }
}

/**
 * A Google token for one of the two read-only APIs the panel reports on.
 *
 * The service account wins when it is configured, because it is the credential
 * that does not expire. Falling back keeps the panel working during the switch
 * instead of making it an all-or-nothing migration.
 */
export async function googleToken(scope: string): Promise<TokenResult> {
  if (hasServiceAccount()) {
    const result = await serviceAccountToken(scope);
    if (result.ok) return result;

    // Reported rather than swallowed: silently falling back to a credential
    // that expires weekly is how this became invisible in the first place.
    return result;
  }

  return operatorToken(scope);
}
