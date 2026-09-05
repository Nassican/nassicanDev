import "server-only";

import { db } from "@nassican/db";

/**
 * Vercel's REST API: deployments and Web Analytics.
 *
 * Unlike Google, this one is not reached with the operator's own OAuth token -
 * Vercel has no user-consent flow for a token like that, so it is a personal
 * access token in the environment. That also means the panel cannot create it
 * for you: `listProjects` exists so at least the project ids do not have to be
 * hunted for in the dashboard.
 */

const API = "https://api.vercel.com";

export type VercelConfig = {
  configured: boolean;
  hasToken: boolean;
  teamId: string | null;
  projects: { key: string; id: string }[];
  /** What is missing, in the order it has to be fixed. */
  missing: string[];
};

export function vercelConfig(): VercelConfig {
  const token = process.env.VERCEL_TOKEN?.trim();
  const teamId = process.env.VERCEL_TEAM_ID?.trim() || null;
  const web = process.env.VERCEL_PROJECT_WEB?.trim();
  const admin = process.env.VERCEL_PROJECT_ADMIN?.trim();

  const projects = [
    ...(web ? [{ key: "web", id: web }] : []),
    ...(admin ? [{ key: "admin", id: admin }] : []),
  ];

  const missing: string[] = [];
  if (!token) missing.push("VERCEL_TOKEN");
  if (projects.length === 0) missing.push("VERCEL_PROJECT_WEB");

  return {
    configured: missing.length === 0,
    hasToken: Boolean(token),
    teamId,
    projects,
    missing,
  };
}

async function call<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const token = process.env.VERCEL_TOKEN?.trim();
  if (!token) throw new Error("falta VERCEL_TOKEN");

  const url = new URL(path, API);
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  if (teamId) url.searchParams.set("teamId", teamId);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    // Vercel answers 403 both for a bad token and for a project the token
    // cannot see, so the message has to carry the status to be useful.
    throw new Error(
      `Vercel respondió ${response.status}: ${body.slice(0, 200) || "sin cuerpo"}`,
    );
  }

  return (await response.json()) as T;
}

/** The ids to paste into the environment, asked rather than guessed. */
export async function listVercelProjects(): Promise<
  { id: string; name: string; framework: string | null }[]
> {
  const data = await call<{
    projects: { id: string; name: string; framework: string | null }[];
  }>("/v9/projects", { limit: 50 });

  return data.projects.map((p) => ({
    id: p.id,
    name: p.name,
    framework: p.framework,
  }));
}

// ---------------------------------------------------------------- despliegues

type VercelDeployment = {
  uid: string;
  name: string;
  state?: string;
  readyState?: string;
  created: number;
  ready?: number;
  meta?: { githubCommitSha?: string; githubCommitRef?: string };
};

/**
 * Brings the recent deployments of every configured project into `deployments`.
 *
 * Upserted by Vercel's own id, so re-running mid-build simply updates the row
 * once the build finishes rather than adding a second one.
 *
 * Each project is tried on its own. A token that reaches one project and not
 * the other is the normal case, not an exception - Vercel scopes tokens to an
 * account or a team, so two projects living in different scopes can never both
 * be readable with one token. Letting the first 403 abort the loop threw away
 * the deployments that had already been read and reported a total failure for
 * a partial one.
 */
export async function syncDeployments(): Promise<
  | { ok: true; rows: number; skipped: { project: string; reason: string }[] }
  | { ok: false; reason: string }
> {
  const config = vercelConfig();
  if (!config.configured) {
    return { ok: false, reason: `falta ${config.missing.join(" y ")}` };
  }

  const run = await db.syncRun.create({
    data: { source: "vercel", status: "running" },
  });

  try {
    let rows = 0;
    const skipped: { project: string; reason: string }[] = [];

    for (const project of config.projects) {
      let data: { deployments: VercelDeployment[] };
      try {
        data = await call<{ deployments: VercelDeployment[] }>(
          "/v6/deployments",
          { projectId: project.id, limit: 20 },
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "no se pudo leer";
        skipped.push({
          project: project.key,
          // A 403 here is about reach, not about the token being invalid, and
          // saying so is the difference between changing one variable and
          // regenerating a token that was fine.
          reason: message.includes("403")
            ? "el token no alcanza a este proyecto (¿está en otro equipo o cuenta?)"
            : message,
        });
        continue;
      }

      for (const d of data.deployments) {
        const fields = {
          project: project.key,
          commitSha: d.meta?.githubCommitSha ?? null,
          branch: d.meta?.githubCommitRef ?? null,
          state: d.readyState ?? d.state ?? "UNKNOWN",
          createdAt: new Date(d.created),
          readyAt: d.ready ? new Date(d.ready) : null,
        };

        await db.deployment.upsert({
          where: { id: d.uid },
          update: fields,
          create: { id: d.uid, ...fields },
        });
        rows += 1;
      }
    }

    // Every project unreachable is a failure; some of them is a warning with
    // real data behind it.
    if (skipped.length === config.projects.length) {
      const reason = skipped.map((s) => `${s.project}: ${s.reason}`).join("; ");
      await db.syncRun.update({
        where: { id: run.id },
        data: { status: "failed", error: reason, finishedAt: new Date() },
      });
      return { ok: false, reason };
    }

    await db.syncRun.update({
      where: { id: run.id },
      data: {
        status: "ok",
        rowsWritten: rows,
        error:
          skipped.length > 0
            ? skipped.map((s) => `${s.project}: ${s.reason}`).join("; ")
            : null,
        finishedAt: new Date(),
      },
    });

    return { ok: true, rows, skipped };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "fallo al sincronizar";
    await db.syncRun.update({
      where: { id: run.id },
      data: { status: "failed", error: reason, finishedAt: new Date() },
    });
    return { ok: false, reason };
  }
}

// ------------------------------------------------------------------ analítica

type AggregateRow = Record<string, string | number> & {
  pageviews: number;
  visitors: number;
};

/**
 * The dimensions worth storing, and what each is called on the way in and out.
 *
 * `day` is stored as `total` because a row grouped only by day *is* the day's
 * total; giving it its own name would mean explaining twice that the value
 * column is empty for it.
 */
const DIMENSIONS = [
  { by: "day", as: "total", field: null },
  { by: "route", as: "route", field: "route" },
  { by: "country", as: "country", field: "country" },
  { by: "referrerHostname", as: "referrer", field: "referrerHostname" },
  { by: "deviceType", as: "device", field: "deviceType" },
] as const;

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Vercel Web Analytics into `vercel_analytics_daily`.
 *
 * Same shape as Search Console and GA4: sync to a table, and let the panel read
 * from the table. A dashboard that queries a third party on every render is a
 * dashboard that is slow and occasionally broken.
 *
 * The non-day groupings have no date of their own - they are totals for the
 * whole range - so they are all filed under the range's last day. That is what
 * makes "top routes over the last 28 days" a single row set rather than 28.
 */
export async function syncVercelAnalytics(
  days = 28,
): Promise<{ ok: true; rows: number } | { ok: false; reason: string }> {
  const config = vercelConfig();
  const project = config.projects.find((p) => p.key === "web");
  if (!config.hasToken || !project) {
    return {
      ok: false,
      reason: `falta ${!config.hasToken ? "VERCEL_TOKEN" : "VERCEL_PROJECT_WEB"}`,
    };
  }

  const until = new Date();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);

  const run = await db.syncRun.create({
    data: {
      source: "vercel",
      status: "running",
      rangeStart: new Date(`${isoDate(since)}T00:00:00.000Z`),
      rangeEnd: new Date(`${isoDate(until)}T00:00:00.000Z`),
    },
  });

  try {
    let rows = 0;

    for (const dimension of DIMENSIONS) {
      const data = await call<{ data: AggregateRow[] }>(
        "/v1/query/web-analytics/visits/aggregate",
        {
          projectId: project.id,
          since: isoDate(since),
          until: isoDate(until),
          by: dimension.by,
          limit: dimension.by === "day" ? undefined : 20,
        },
      );

      for (const row of data.data) {
        const date =
          dimension.by === "day" && typeof row.timestamp === "string"
            ? new Date(`${row.timestamp.slice(0, 10)}T00:00:00.000Z`)
            : new Date(`${isoDate(until)}T00:00:00.000Z`);

        const value =
          dimension.field === null
            ? ""
            : String(row[dimension.field] ?? "").slice(0, 300) || "(sin dato)";

        const fields = {
          pageviews: Number(row.pageviews ?? 0),
          visitors: Number(row.visitors ?? 0),
        };

        await db.vercelAnalyticsDaily.upsert({
          where: {
            date_dimension_value: { date, dimension: dimension.as, value },
          },
          update: fields,
          create: { date, dimension: dimension.as, value, ...fields },
        });
        rows += 1;
      }
    }

    await db.syncRun.update({
      where: { id: run.id },
      data: { status: "ok", rowsWritten: rows, finishedAt: new Date() },
    });

    return { ok: true, rows };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "fallo al sincronizar";
    await db.syncRun.update({
      where: { id: run.id },
      data: { status: "failed", error: reason, finishedAt: new Date() },
    });
    return { ok: false, reason };
  }
}

export type VercelSummary = {
  configured: boolean;
  missing: string[];
  from: string | null;
  to: string | null;
  totals: { pageviews: number; visitors: number };
  byDay: { date: string; pageviews: number; visitors: number }[];
  top: Record<
    "route" | "country" | "referrer" | "device",
    { value: string; pageviews: number; visitors: number }[]
  >;
  lastSync: { at: string; status: string; rows: number; error: string | null } | null;
};

export async function getVercelSummary(days = 28): Promise<VercelSummary> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);

  const [rows, lastRun] = await Promise.all([
    db.vercelAnalyticsDaily.findMany({ where: { date: { gte: since } } }),
    db.syncRun.findFirst({ where: { source: "vercel" }, orderBy: { startedAt: "desc" } }),
  ]);

  const byDay = rows
    .filter((r) => r.dimension === "total")
    .map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      pageviews: r.pageviews,
      visitors: r.visitors,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const pick = (dimension: string) =>
    rows
      .filter((r) => r.dimension === dimension)
      .map((r) => ({ value: r.value, pageviews: r.pageviews, visitors: r.visitors }))
      .sort((a, b) => b.pageviews - a.pageviews)
      .slice(0, 10);

  const config = vercelConfig();

  return {
    configured: config.configured,
    missing: config.missing,
    from: byDay[0]?.date ?? null,
    to: byDay[byDay.length - 1]?.date ?? null,
    totals: {
      pageviews: byDay.reduce((n, d) => n + d.pageviews, 0),
      // Visitors do not add up across days - the same person on Monday and
      // Tuesday is one visitor, not two - so the headline is the busiest day
      // rather than a sum that would quietly overcount.
      visitors: byDay.reduce((n, d) => Math.max(n, d.visitors), 0),
    },
    byDay,
    top: {
      route: pick("route"),
      country: pick("country"),
      referrer: pick("referrer"),
      device: pick("device"),
    },
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
