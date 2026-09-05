import "server-only";

import { db } from "@nassican/db";
import { locales, type Locale } from "@nassican/shared";
import { googleToken, SCOPES } from "@/lib/google";

const API = "https://analyticsdata.googleapis.com/v1beta";

type ReportRow = {
  dimensionValues?: { value: string }[];
  metricValues?: { value: string }[];
};

type BatchResponse = {
  reports?: { rows?: ReportRow[] }[];
};

export type SyncOutcome =
  | { ok: true; days: number; from: string; to: string }
  | { ok: false; reason: string };

/** GA4 finishes processing a day within a few hours; two is comfortable. */
const LAG_DAYS = 2;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** GA4 returns dates as `20260904`. */
function fromGaDate(value: string): Date {
  return new Date(
    `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00Z`,
  );
}

const n = (row: ReportRow, i: number) => Number(row.metricValues?.[i]?.value ?? 0);
const d = (row: ReportRow, i: number) => row.dimensionValues?.[i]?.value ?? "";

/**
 * Which language a path belongs to. Derived rather than asked of GA4, because
 * the site encodes it in the URL and GA4 has no idea our `/en` prefix means
 * anything.
 */
function localeOf(path: string): Locale | null {
  for (const locale of locales) {
    if (path === `/${locale}` || path.startsWith(`/${locale}/`)) return locale;
  }
  return path.startsWith("/") ? "es" : null;
}

/**
 * Pulls the last `days` of GA4 into the daily rollup tables.
 *
 * Five narrow reports rather than one wide one: crossing every dimension at
 * once multiplies the rows without anyone ever reading the combination. GA4
 * accepts up to five reports in a single batch, which is exactly what fits.
 */
export async function syncAnalytics(days = 28): Promise<SyncOutcome> {
  const settings = await db.seoSettings.findUnique({
    where: { id: 1 },
    select: { ga4PropertyId: true },
  });

  const property = settings?.ga4PropertyId?.trim();
  if (!property) {
    return { ok: false, reason: "falta el id de propiedad de GA4 en SEO → Metadatos" };
  }

  if (!/^\d+$/.test(property)) {
    return {
      ok: false,
      reason: `"${property}" no es un id de propiedad: es numérico, no el G-XXXX de medición`,
    };
  }

  const token = await googleToken(SCOPES.analytics);
  if (!token.ok) return { ok: false, reason: token.reason };

  const end = new Date();
  end.setUTCDate(end.getUTCDate() - LAG_DAYS);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);

  const from = isoDate(start);
  const to = isoDate(end);
  const dateRanges = [{ startDate: from, endDate: to }];

  const run = await db.syncRun.create({
    data: { source: "ga4", rangeStart: start, rangeEnd: end, status: "running" },
  });

  try {
    const response = await fetch(`${API}/properties/${property}:batchRunReports`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        requests: [
          {
            dateRanges,
            dimensions: [{ name: "date" }],
            metrics: [
              { name: "activeUsers" },
              { name: "newUsers" },
              { name: "sessions" },
              { name: "screenPageViews" },
              { name: "averageSessionDuration" },
              { name: "engagementRate" },
              { name: "bounceRate" },
            ],
          },
          {
            dateRanges,
            dimensions: [{ name: "date" }, { name: "pagePath" }],
            metrics: [
              { name: "screenPageViews" },
              { name: "activeUsers" },
              { name: "userEngagementDuration" },
            ],
            limit: 5000,
          },
          {
            dateRanges,
            dimensions: [
              { name: "date" },
              { name: "sessionSource" },
              { name: "sessionMedium" },
              { name: "sessionDefaultChannelGroup" },
            ],
            metrics: [{ name: "sessions" }, { name: "activeUsers" }],
            limit: 5000,
          },
          {
            dateRanges,
            dimensions: [{ name: "date" }, { name: "countryId" }],
            metrics: [{ name: "activeUsers" }, { name: "sessions" }],
            limit: 5000,
          },
          {
            dateRanges,
            dimensions: [
              { name: "date" },
              { name: "deviceCategory" },
              { name: "browser" },
              { name: "operatingSystem" },
            ],
            metrics: [{ name: "activeUsers" }, { name: "sessions" }],
            limit: 5000,
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`GA4 respondió ${response.status}: ${detail.slice(0, 250)}`);
    }

    const payload = (await response.json()) as BatchResponse;
    const [totals, pages, sources, geo, devices] = payload.reports ?? [];

    for (const row of totals?.rows ?? []) {
      const date = fromGaDate(d(row, 0));
      const data = {
        users: n(row, 0),
        newUsers: n(row, 1),
        sessions: n(row, 2),
        pageViews: n(row, 3),
        avgSessionSeconds: n(row, 4),
        engagementRate: n(row, 5),
        bounceRate: n(row, 6),
      };
      await db.analyticsDailyTotals.upsert({
        where: { date },
        update: data,
        create: { date, ...data },
      });
    }

    for (const row of pages?.rows ?? []) {
      const date = fromGaDate(d(row, 0));
      const path = d(row, 1);
      const views = n(row, 0);
      const data = {
        locale: localeOf(path),
        pageViews: views,
        users: n(row, 1),
        // GA4 gives total engagement seconds; per view is what reads sensibly.
        avgEngagementSeconds: views > 0 ? n(row, 2) / views : 0,
      };
      await db.analyticsDailyPage.upsert({
        where: { date_path: { date, path } },
        update: data,
        create: { date, path, ...data },
      });
    }

    for (const row of sources?.rows ?? []) {
      const date = fromGaDate(d(row, 0));
      const source = d(row, 1);
      const medium = d(row, 2);
      const data = { channelGroup: d(row, 3), sessions: n(row, 0), users: n(row, 1) };
      await db.analyticsDailySource.upsert({
        where: { date_source_medium: { date, source, medium } },
        update: data,
        create: { date, source, medium, ...data },
      });
    }

    for (const row of geo?.rows ?? []) {
      const date = fromGaDate(d(row, 0));
      const countryCode = d(row, 1);
      const data = { users: n(row, 0), sessions: n(row, 1) };
      await db.analyticsDailyGeo.upsert({
        where: { date_countryCode: { date, countryCode } },
        update: data,
        create: { date, countryCode, ...data },
      });
    }

    for (const row of devices?.rows ?? []) {
      const date = fromGaDate(d(row, 0));
      const deviceCategory = d(row, 1);
      const browser = d(row, 2);
      const os = d(row, 3);
      const data = { users: n(row, 0), sessions: n(row, 1) };
      await db.analyticsDailyDevice.upsert({
        where: {
          date_deviceCategory_browser_os: { date, deviceCategory, browser, os },
        },
        update: data,
        create: { date, deviceCategory, browser, os, ...data },
      });
    }

    const written =
      (totals?.rows?.length ?? 0) +
      (pages?.rows?.length ?? 0) +
      (sources?.rows?.length ?? 0) +
      (geo?.rows?.length ?? 0) +
      (devices?.rows?.length ?? 0);

    await db.syncRun.update({
      where: { id: run.id },
      data: { status: "ok", rowsWritten: written, finishedAt: new Date() },
    });

    return { ok: true, days: totals?.rows?.length ?? 0, from, to };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "fallo al consultar GA4";
    await db.syncRun.update({
      where: { id: run.id },
      data: { status: "failed", error: reason, finishedAt: new Date() },
    });
    return { ok: false, reason };
  }
}

/** Lists the GA4 properties this account can read, so the id is not guessed. */
export async function listAnalyticsProperties(): Promise<
  { ok: true; properties: { id: string; name: string }[] } | { ok: false; reason: string }
> {
  const token = await googleToken(SCOPES.analytics);
  if (!token.ok) return { ok: false, reason: token.reason };

  try {
    const response = await fetch(
      "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200",
      {
        headers: { Authorization: `Bearer ${token.token}` },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      return {
        ok: false,
        reason: `GA4 Admin respondió ${response.status}: ${detail.slice(0, 250)}`,
      };
    }

    const payload = (await response.json()) as {
      accountSummaries?: {
        displayName?: string;
        propertySummaries?: { property?: string; displayName?: string }[];
      }[];
    };

    const properties = (payload.accountSummaries ?? []).flatMap((account) =>
      (account.propertySummaries ?? []).map((p) => ({
        // "properties/552861650" -> "552861650"
        id: (p.property ?? "").split("/").pop() ?? "",
        name: `${p.displayName ?? "Propiedad"} · ${account.displayName ?? ""}`.trim(),
      })),
    );

    return { ok: true, properties: properties.filter((p) => p.id) };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "fallo de red",
    };
  }
}
