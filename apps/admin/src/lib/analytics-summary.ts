import "server-only";

import { db } from "@nassican/db";
import type { Locale } from "@nassican/shared";

export type DailyPoint = {
  date: string;
  users: number;
  sessions: number;
  pageViews: number;
};

export type NamedRow = { name: string; users: number; sessions: number };

export type PageRow = {
  path: string;
  locale: Locale | null;
  pageViews: number;
  users: number;
  avgEngagementSeconds: number;
};

export type AnalyticsSummary = {
  configured: boolean;
  days: number;
  totals: {
    users: number;
    newUsers: number;
    sessions: number;
    pageViews: number;
    avgSessionSeconds: number;
    engagementRate: number;
  };
  daily: DailyPoint[];
  pages: PageRow[];
  channels: NamedRow[];
  sources: NamedRow[];
  countries: NamedRow[];
  devices: NamedRow[];
  lastSync: { at: string; status: string; rows: number; error: string | null } | null;
};

function group(
  rows: { name: string; users: number; sessions: number }[],
): NamedRow[] {
  const map = new Map<string, NamedRow>();
  for (const row of rows) {
    const acc = map.get(row.name) ?? { name: row.name, users: 0, sessions: 0 };
    acc.users += row.users;
    acc.sessions += row.sessions;
    map.set(row.name, acc);
  }
  return [...map.values()].sort((a, b) => b.sessions - a.sessions).slice(0, 10);
}

/**
 * Reads the rollups. The panel never calls GA4 to render: a dashboard that
 * depends on a third-party API is slow and sometimes broken.
 */
export async function getAnalyticsSummary(days = 28): Promise<AnalyticsSummary> {
  const settings = await db.seoSettings.findUnique({
    where: { id: 1 },
    select: { ga4PropertyId: true },
  });

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);

  const [totals, pages, sources, geo, devices, lastRun] = await Promise.all([
    db.analyticsDailyTotals.findMany({
      where: { date: { gte: since } },
      orderBy: { date: "asc" },
    }),
    db.analyticsDailyPage.findMany({ where: { date: { gte: since } } }),
    db.analyticsDailySource.findMany({ where: { date: { gte: since } } }),
    db.analyticsDailyGeo.findMany({ where: { date: { gte: since } } }),
    db.analyticsDailyDevice.findMany({ where: { date: { gte: since } } }),
    db.syncRun.findFirst({ where: { source: "ga4" }, orderBy: { startedAt: "desc" } }),
  ]);

  const sum = totals.reduce(
    (acc, r) => ({
      users: acc.users + r.users,
      newUsers: acc.newUsers + r.newUsers,
      sessions: acc.sessions + r.sessions,
      pageViews: acc.pageViews + r.pageViews,
      // Both are per-session averages, so weighting by sessions is the only
      // way summing them across days means anything.
      weightedDuration: acc.weightedDuration + r.avgSessionSeconds * r.sessions,
      weightedEngagement: acc.weightedEngagement + r.engagementRate * r.sessions,
    }),
    {
      users: 0,
      newUsers: 0,
      sessions: 0,
      pageViews: 0,
      weightedDuration: 0,
      weightedEngagement: 0,
    },
  );

  const pageMap = new Map<string, PageRow>();
  for (const row of pages) {
    const acc = pageMap.get(row.path) ?? {
      path: row.path,
      locale: row.locale,
      pageViews: 0,
      users: 0,
      avgEngagementSeconds: 0,
    };
    acc.avgEngagementSeconds =
      acc.pageViews + row.pageViews > 0
        ? (acc.avgEngagementSeconds * acc.pageViews +
            row.avgEngagementSeconds * row.pageViews) /
          (acc.pageViews + row.pageViews)
        : 0;
    acc.pageViews += row.pageViews;
    acc.users += row.users;
    pageMap.set(row.path, acc);
  }

  return {
    configured: Boolean(settings?.ga4PropertyId),
    days,
    totals: {
      users: sum.users,
      newUsers: sum.newUsers,
      sessions: sum.sessions,
      pageViews: sum.pageViews,
      avgSessionSeconds:
        sum.sessions > 0 ? sum.weightedDuration / sum.sessions : 0,
      engagementRate:
        sum.sessions > 0 ? sum.weightedEngagement / sum.sessions : 0,
    },
    daily: totals.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      users: r.users,
      sessions: r.sessions,
      pageViews: r.pageViews,
    })),
    pages: [...pageMap.values()]
      .sort((a, b) => b.pageViews - a.pageViews)
      .slice(0, 15),
    channels: group(
      sources.map((r) => ({
        name: r.channelGroup || "(sin canal)",
        users: r.users,
        sessions: r.sessions,
      })),
    ),
    sources: group(
      sources.map((r) => ({
        name: `${r.source} / ${r.medium}`,
        users: r.users,
        sessions: r.sessions,
      })),
    ),
    countries: group(
      geo.map((r) => ({
        name: r.countryCode || "??",
        users: r.users,
        sessions: r.sessions,
      })),
    ),
    devices: group(
      devices.map((r) => ({
        name: r.deviceCategory || "(desconocido)",
        users: r.users,
        sessions: r.sessions,
      })),
    ),
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
