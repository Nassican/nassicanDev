import "server-only";

import { db } from "@nassican/db";
import { locales, type Locale } from "@nassican/shared";
import type { RedirectDraft, SeoSettingsDraft } from "@/lib/seo-draft";

export * from "@/lib/seo-draft";

function emptyPerLocale(): SeoSettingsDraft["perLocale"] {
  const out = {} as SeoSettingsDraft["perLocale"];
  for (const locale of locales) {
    out[locale] = { defaultTitle: "", defaultDescription: "", keywords: [] };
  }
  return out;
}

export async function getSeoSettingsDraft(): Promise<SeoSettingsDraft> {
  const row = await db.seoSettings.findUnique({
    where: { id: 1 },
    include: { translations: true, defaultOgImage: { select: { url: true } } },
  });

  const perLocale = emptyPerLocale();
  for (const locale of locales) {
    const t = row?.translations.find((x) => x.locale === locale);
    perLocale[locale] = {
      defaultTitle: t?.defaultTitle ?? "",
      defaultDescription: t?.defaultDescription ?? "",
      keywords: ((t?.keywords as string[] | null) ?? []),
    };
  }

  return {
    titleTemplate: row?.titleTemplate ?? "",
    googleSiteVerification: row?.googleSiteVerification ?? "",
    ga4MeasurementId: row?.ga4MeasurementId ?? "",
    ga4PropertyId: row?.ga4PropertyId ?? "",
    gscSiteUrl: row?.gscSiteUrl ?? "",
    robotsExtra: row?.robotsExtra ?? "",
    defaultOgMediaId: row?.defaultOgImageId ?? null,
    defaultOgUrl: row?.defaultOgImage?.url ?? null,
    perLocale,
  };
}

export async function listRedirects(): Promise<RedirectDraft[]> {
  const rows = await db.redirect.findMany({
    orderBy: [{ hits: "desc" }, { createdAt: "desc" }],
  });

  return rows.map((r) => ({
    id: r.id,
    source: r.source,
    destination: r.destination,
    statusCode: r.statusCode,
    isEnabled: r.isEnabled,
    hits: Number(r.hits),
    lastHitAt: r.lastHitAt ? r.lastHitAt.toISOString() : null,
  }));
}

export type SearchConsoleRow = {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SearchConsoleSummary = {
  configured: boolean;
  days: number;
  from: string | null;
  to: string | null;
  totals: { clicks: number; impressions: number; ctr: number; position: number };
  topQueries: SearchConsoleRow[];
  topPages: SearchConsoleRow[];
  lastSync: {
    at: string;
    status: string;
    rows: number;
    error: string | null;
  } | null;
};

/**
 * Reads what has already been synced. The panel never queries Google to render
 * a page: a dashboard that depends on a third-party API is a dashboard that is
 * slow and sometimes broken.
 */
export async function getSearchConsoleSummary(
  days = 28,
): Promise<SearchConsoleSummary> {
  const settings = await db.seoSettings.findUnique({
    where: { id: 1 },
    select: { gscSiteUrl: true },
  });

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);

  const [rows, lastRun] = await Promise.all([
    db.searchConsoleDaily.findMany({ where: { date: { gte: since } } }),
    db.syncRun.findFirst({
      where: { source: "search_console" },
      orderBy: { startedAt: "desc" },
    }),
  ]);

  const totals = rows.reduce(
    (acc, r) => ({
      clicks: acc.clicks + r.clicks,
      impressions: acc.impressions + r.impressions,
      weightedPosition: acc.weightedPosition + r.position * r.impressions,
    }),
    { clicks: 0, impressions: 0, weightedPosition: 0 },
  );

  // Group by one dimension at a time: averaging a position across pages only
  // means something weighted by impressions.
  const group = (key: "query" | "page"): SearchConsoleRow[] => {
    const map = new Map<string, { clicks: number; impressions: number; weighted: number }>();
    for (const r of rows) {
      const k = r[key];
      const acc = map.get(k) ?? { clicks: 0, impressions: 0, weighted: 0 };
      acc.clicks += r.clicks;
      acc.impressions += r.impressions;
      acc.weighted += r.position * r.impressions;
      map.set(k, acc);
    }

    return [...map.entries()]
      .map(([name, acc]) => ({
        query: key === "query" ? name : "",
        page: key === "page" ? name : "",
        clicks: acc.clicks,
        impressions: acc.impressions,
        ctr: acc.impressions > 0 ? acc.clicks / acc.impressions : 0,
        position: acc.impressions > 0 ? acc.weighted / acc.impressions : 0,
      }))
      .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
      .slice(0, 20);
  };

  const dates = rows.map((r) => r.date.toISOString().slice(0, 10)).sort();

  return {
    configured: Boolean(settings?.gscSiteUrl),
    days,
    from: dates[0] ?? null,
    to: dates[dates.length - 1] ?? null,
    totals: {
      clicks: totals.clicks,
      impressions: totals.impressions,
      ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
      position:
        totals.impressions > 0 ? totals.weightedPosition / totals.impressions : 0,
    },
    topQueries: group("query"),
    topPages: group("page"),
    lastSync: lastRun
      ? {
          at: (lastRun.finishedAt ?? lastRun.startedAt).toISOString(),
          status: lastRun.status,
          rows: lastRun.rowsWritten,
          error: lastRun.error,
        }
      : null,
  };
}

export type { Locale };
