import "server-only";

import { headers } from "next/headers";
import { db } from "@nassican/db";
import { auth } from "@/lib/auth";

const API = "https://searchconsole.googleapis.com/webmasters/v3/sites";

/** What the API returns, one row per (date, page, query, country, device). */
type ApiRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SyncOutcome =
  | { ok: true; rows: number; from: string; to: string }
  | { ok: false; reason: string };

/**
 * Search Console only has data up to about two days ago, so asking for
 * yesterday reliably returns nothing and looks like a failure.
 */
const LAG_DAYS = 3;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Fetches a valid access token for the signed-in user's Google account.
 *
 * Better Auth refreshes it when it has expired, which is the whole reason the
 * login asks for offline access: without a refresh token this would work for
 * an hour and then stop.
 */
async function googleToken(): Promise<
  { ok: true; token: string } | { ok: false; reason: string }
> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, reason: "sin sesión" };

  const account = await db.account.findFirst({
    where: { userId: session.user.id, providerId: "google" },
    select: { accountId: true, scope: true },
  });

  if (!account) return { ok: false, reason: "no hay cuenta de Google vinculada" };

  if (!account.scope?.includes("webmasters.readonly")) {
    return {
      ok: false,
      reason:
        "la sesión no tiene permiso de Search Console; vuelve a entrar para concederlo",
    };
  }

  try {
    // The account id alone identifies the grant; passing `providerId` too is
    // rejected, because that variant of the request is for the default account.
    const result = await auth.api.getAccessToken({
      body: { accountId: account.accountId },
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

export type SearchConsoleSite = {
  siteUrl: string;
  permission: string;
};

/**
 * Asks Google which properties this account can read.
 *
 * The identifier is not guessable: a domain property is `sc-domain:example.com`
 * while a prefix property is the full `https://www.example.com/`, trailing
 * slash included. Getting it wrong returns a 403 that says nothing useful, so
 * the panel offers the real list instead of a text box and a hope.
 */
export async function listSearchConsoleSites(): Promise<
  { ok: true; sites: SearchConsoleSite[] } | { ok: false; reason: string }
> {
  const token = await googleToken();
  if (!token.ok) return { ok: false, reason: token.reason };

  try {
    const response = await fetch(API, {
      headers: { Authorization: `Bearer ${token.token}` },
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text();
      return {
        ok: false,
        reason: `Search Console respondió ${response.status}: ${detail.slice(0, 200)}`,
      };
    }

    const payload = (await response.json()) as {
      siteEntry?: { siteUrl: string; permissionLevel: string }[];
    };

    return {
      ok: true,
      sites: (payload.siteEntry ?? []).map((s) => ({
        siteUrl: s.siteUrl,
        permission: s.permissionLevel,
      })),
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "fallo de red",
    };
  }
}

/**
 * Pulls the last `days` of search performance into `search_console_daily`.
 *
 * Stored rather than queried live so the dashboard reads Postgres, and so the
 * history outlives Search Console's own 16-month window. Rows are upserted by
 * their full key, which makes re-running the sync over the same range free.
 */
export async function syncSearchConsole(days = 28): Promise<SyncOutcome> {
  const settings = await db.seoSettings.findUnique({
    where: { id: 1 },
    select: { gscSiteUrl: true },
  });

  const site = settings?.gscSiteUrl?.trim();
  if (!site) {
    return { ok: false, reason: "falta la propiedad de Search Console en Ajustes" };
  }

  const token = await googleToken();
  if (!token.ok) return { ok: false, reason: token.reason };

  const end = new Date();
  end.setUTCDate(end.getUTCDate() - LAG_DAYS);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);

  const from = isoDate(start);
  const to = isoDate(end);

  const run = await db.syncRun.create({
    data: {
      source: "search_console",
      rangeStart: start,
      rangeEnd: end,
      status: "running",
    },
  });

  try {
    let written = 0;
    let startRow = 0;

    // The API pages at 25 000 rows; a portfolio never gets near it, but a loop
    // costs nothing and removes a silent truncation.
    for (;;) {
      const response = await fetch(
        `${API}/${encodeURIComponent(site)}/searchAnalytics/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            startDate: from,
            endDate: to,
            dimensions: ["date", "page", "query", "country", "device"],
            rowLimit: 25000,
            startRow,
          }),
          cache: "no-store",
        },
      );

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(
          `Search Console respondió ${response.status}: ${detail.slice(0, 200)}`,
        );
      }

      const payload = (await response.json()) as { rows?: ApiRow[] };
      const rows = payload.rows ?? [];
      if (rows.length === 0) break;

      for (const row of rows) {
        const [date, page, query, country, device] = row.keys;
        const data = {
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
        };

        await db.searchConsoleDaily.upsert({
          where: {
            date_page_query_country_device: {
              date: new Date(date),
              page,
              query,
              country,
              device,
            },
          },
          update: data,
          create: {
            date: new Date(date),
            page,
            query,
            country,
            device,
            ...data,
          },
        });
      }

      written += rows.length;
      if (rows.length < 25000) break;
      startRow += rows.length;
    }

    await db.syncRun.update({
      where: { id: run.id },
      data: { status: "ok", rowsWritten: written, finishedAt: new Date() },
    });

    return { ok: true, rows: written, from, to };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "fallo al consultar Search Console";

    await db.syncRun.update({
      where: { id: run.id },
      data: { status: "failed", error: reason, finishedAt: new Date() },
    });

    return { ok: false, reason };
  }
}
