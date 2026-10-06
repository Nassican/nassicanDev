import "server-only";

import { db } from "@nassican/db";
import { calendarDate } from "@nassican/shared";
import { SCOPES, googleToken } from "@/lib/google";
import {
  PAGESPEED_TARGETS,
  explainError,
  isRegression,
  parseLighthouse,
  type PageSpeedMetrics,
  type Strategy,
} from "@/lib/pagespeed-draft";
import { getTimezone } from "@/lib/site-config";

/**
 * PageSpeed Insights, measured once a day by the cron and on demand from the
 * module, and kept in `pagespeed_runs` so the panel reads a trend, not a
 * third-party API.
 *
 * Credentials, in order: `PAGESPEED_API_KEY` if set; else a Google token from
 * the service account (or the operator's login), which only tells Google whose
 * quota to charge; else nothing, which shares an anonymous quota that was
 * already spent the day this was written (429).
 */

const API = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
/** A Lighthouse run takes 10 to 30 s; past a minute it is not coming back. */
const TIMEOUT_MS = 60_000;

type Measured = { ok: true; metrics: PageSpeedMetrics } | { ok: false; reason: string };

async function measure(url: string, strategy: Strategy, auth: { key?: string; token?: string }): Promise<Measured> {
  const query = new URLSearchParams({ url, strategy });
  for (const category of ["performance", "accessibility", "best-practices", "seo"]) query.append("category", category);
  if (auth.key) query.set("key", auth.key);

  try {
    const response = await fetch(`${API}?${query}`, {
      headers: auth.token ? { Authorization: `Bearer ${auth.token}` } : {},
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = (body as { error?: { message?: string } } | null)?.error;
      return { ok: false, reason: explainError(response.status, error?.message ?? response.statusText) };
    }
    return { ok: true, metrics: parseLighthouse(body) };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return { ok: false, reason: "PageSpeed tardó más de un minuto en responder." };
    }
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

export type PageSpeedSync = { ok: true; rows: number; note?: string } | { ok: false; reason: string };

/**
 * Measures every target in parallel — five requests to one service, but each
 * one is Google running Lighthouse on its own machines, so they do not compete
 * for anything of ours. Written one row per page, strategy and local day.
 */
export async function syncPageSpeed(): Promise<PageSpeedSync> {
  const origin = process.env.PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (!origin) return { ok: false, reason: "falta PUBLIC_SITE_URL" };

  const key = process.env.PAGESPEED_API_KEY?.trim();
  const token = key ? null : await googleToken(SCOPES.pagespeed);
  const auth = key ? { key } : token?.ok ? { token: token.token } : {};

  const date = calendarDate(await getTimezone());
  const run = await db.syncRun.create({ data: { source: "pagespeed", status: "running" } });

  const results = await Promise.all(
    PAGESPEED_TARGETS.map(async (target) => ({
      target,
      result: await measure(`${origin}${target.path === "/" ? "/" : target.path}`, target.strategy, auth),
    })),
  );

  let written = 0;
  for (const { target, result } of results) {
    if (!result.ok) continue;
    const where = { date_path_strategy: { date, path: target.path, strategy: target.strategy } };
    await db.pageSpeedRun.upsert({
      where,
      update: result.metrics,
      create: { date, path: target.path, strategy: target.strategy, ...result.metrics },
    });
    written++;
  }

  const failures = results.flatMap(({ target, result }) =>
    result.ok ? [] : [`${target.label} (${target.strategy === "mobile" ? "móvil" : "escritorio"}): ${result.reason}`],
  );
  // When every page fails it is one cause, nearly always — say it once.
  const reasons = [...new Set(results.flatMap(({ result }) => (result.ok ? [] : [result.reason])))];

  if (written === 0) {
    const reason = reasons.length === 1 ? reasons[0] : failures.join(" · ");
    await db.syncRun.update({
      where: { id: run.id },
      data: { status: "failed", error: reason.slice(0, 1000), finishedAt: new Date() },
    });
    return { ok: false, reason };
  }

  const note = failures.length > 0 ? `${failures.length} de ${results.length} fallaron: ${failures.join(" · ")}` : undefined;
  await db.syncRun.update({
    where: { id: run.id },
    data: { status: "ok", rowsWritten: written, error: note?.slice(0, 1000) ?? null, finishedAt: new Date() },
  });
  return { ok: true, rows: written, note };
}

export type PageSpeedRow = PageSpeedMetrics & { date: string };

export type PageSpeedView = {
  targets: {
    path: string;
    label: string;
    strategy: Strategy;
    latest: PageSpeedRow | null;
    previous: PageSpeedRow | null;
    /** Performance by day, oldest first, for the trend line. */
    history: { date: string; performance: number | null }[];
  }[];
  lastRun: { status: string; startedAt: string; error: string | null } | null;
  origin: string | null;
};

const HISTORY_DAYS = 30;

export async function getPageSpeed(): Promise<PageSpeedView> {
  const since = new Date(Date.now() - HISTORY_DAYS * 86_400_000).toISOString().slice(0, 10);
  const [rows, lastRun] = await Promise.all([
    db.pageSpeedRun.findMany({ where: { date: { gte: since } }, orderBy: { date: "asc" } }),
    db.syncRun.findFirst({
      where: { source: "pagespeed" },
      orderBy: { startedAt: "desc" },
      select: { status: true, startedAt: true, error: true },
    }),
  ]);

  return {
    targets: PAGESPEED_TARGETS.map((target) => {
      const mine = rows.filter((r) => r.path === target.path && r.strategy === target.strategy);
      const pick = (r: (typeof mine)[number] | undefined): PageSpeedRow | null =>
        r
          ? {
              date: r.date,
              performance: r.performance,
              accessibility: r.accessibility,
              bestPractices: r.bestPractices,
              seo: r.seo,
              lcpMs: r.lcpMs,
              fcpMs: r.fcpMs,
              tbtMs: r.tbtMs,
              cls: r.cls,
              fieldCategory: r.fieldCategory,
            }
          : null;
      return {
        ...target,
        latest: pick(mine.at(-1)),
        previous: pick(mine.at(-2)),
        history: mine.map((r) => ({ date: r.date, performance: r.performance })),
      };
    }),
    lastRun: lastRun
      ? { status: lastRun.status, startedAt: lastRun.startedAt.toISOString(), error: lastRun.error }
      : null,
    origin: process.env.PUBLIC_SITE_URL ?? null,
  };
}

/** For the dashboard: mobile pages whose performance just dropped. */
export async function pageSpeedDrops(): Promise<{ label: string; current: number; previous: number | null }[]> {
  const rows = await db.pageSpeedRun.findMany({
    where: { strategy: "mobile" },
    orderBy: { date: "desc" },
    take: PAGESPEED_TARGETS.length * 4,
    select: { path: true, date: true, performance: true },
  });
  return PAGESPEED_TARGETS.filter((t) => t.strategy === "mobile").flatMap((target) => {
    const [current, previous] = rows.filter((r) => r.path === target.path);
    if (!current || current.performance === null) return [];
    return isRegression(current.performance, previous?.performance ?? null)
      ? [{ label: target.label, current: current.performance, previous: previous?.performance ?? null }]
      : [];
  });
}
