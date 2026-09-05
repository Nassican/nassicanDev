import "server-only";

import { headers } from "next/headers";
import { db } from "@nassican/db";
import { auth } from "@/lib/auth";

export type TokenResult =
  | { ok: true; token: string }
  | { ok: false; reason: string };

/**
 * A valid Google access token for the signed-in user.
 *
 * Better Auth refreshes it when it has expired, which is the whole reason the
 * login asks for offline access: without a refresh token this would work for an
 * hour and then stop. Shared by Search Console and Analytics so a broken grant
 * reports the same way in both.
 */
export async function googleToken(scope: string): Promise<TokenResult> {
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
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "fallo al refrescar el token",
    };
  }
}

export const SCOPES = {
  analytics: "analytics.readonly",
  searchConsole: "webmasters.readonly",
} as const;
