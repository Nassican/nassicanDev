import "server-only";

import { db } from "@nassican/db";
import { vercelConfig } from "@/lib/vercel";

export type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  user: string | null;
  diff: Record<string, unknown> | null;
  at: string;
};

export type SyncEntry = {
  id: string;
  source: string;
  status: string;
  rows: number;
  error: string | null;
  startedAt: string;
  durationMs: number | null;
};

export type DeploymentEntry = {
  id: string;
  project: string;
  state: string;
  branch: string | null;
  commitSha: string | null;
  createdAt: string;
  buildMs: number | null;
};

export type EventEntry = {
  id: string;
  level: string;
  source: string;
  message: string;
  at: string;
};

export type UptimeSummary = {
  url: string | null;
  checks: number;
  okRatio: number;
  medianMs: number | null;
  last: { at: string; statusCode: number | null; responseMs: number | null; isOk: boolean } | null;
  recent: { at: string; statusCode: number | null; responseMs: number | null; isOk: boolean }[];
};

export type SystemSummary = {
  audit: AuditEntry[];
  syncs: SyncEntry[];
  deployments: DeploymentEntry[];
  events: EventEntry[];
  uptime: UptimeSummary;
  vercel: { configured: boolean; missing: string[]; hasToken: boolean };
};

const iso = (d: Date) => d.toISOString();

/**
 * Everything the Sistema module shows, in one round trip's worth of queries.
 *
 * All five lists are bounded and independent, so they go together - at this
 * distance the cost of a query is the trip, not the rows.
 */
export async function getSystemSummary(): Promise<SystemSummary> {
  const [audit, syncs, deployments, events, uptimeRows, uptimeAgg] =
    await Promise.all([
      db.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: { select: { email: true, name: true } } },
      }),
      db.syncRun.findMany({ orderBy: { startedAt: "desc" }, take: 25 }),
      db.deployment.findMany({ orderBy: { createdAt: "desc" }, take: 15 }),
      db.systemEvent.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
      db.uptimeCheck.findMany({ orderBy: { checkedAt: "desc" }, take: 50 }),
      db.uptimeCheck.aggregate({ _count: { _all: true } }),
    ]);

  const durations = uptimeRows
    .map((r) => r.responseMs)
    .filter((ms): ms is number => ms !== null)
    .sort((a, b) => a - b);

  const config = vercelConfig();

  return {
    audit: audit.map((row) => ({
      id: row.id.toString(),
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      user: row.user?.name ?? row.user?.email ?? null,
      diff: (row.diff as Record<string, unknown> | null) ?? null,
      at: iso(row.createdAt),
    })),

    syncs: syncs.map((row) => ({
      id: row.id,
      source: row.source,
      status: row.status,
      rows: row.rowsWritten,
      error: row.error,
      startedAt: iso(row.startedAt),
      durationMs: row.finishedAt
        ? row.finishedAt.getTime() - row.startedAt.getTime()
        : null,
    })),

    deployments: deployments.map((row) => ({
      id: row.id,
      project: row.project,
      state: row.state,
      branch: row.branch,
      commitSha: row.commitSha,
      createdAt: iso(row.createdAt),
      buildMs: row.readyAt
        ? row.readyAt.getTime() - row.createdAt.getTime()
        : null,
    })),

    events: events.map((row) => ({
      id: row.id.toString(),
      level: row.level,
      source: row.source,
      message: row.message,
      at: iso(row.createdAt),
    })),

    uptime: {
      url: process.env.PUBLIC_SITE_URL ?? null,
      checks: uptimeAgg._count._all,
      okRatio:
        uptimeRows.length > 0
          ? uptimeRows.filter((r) => r.isOk).length / uptimeRows.length
          : 1,
      medianMs: durations.length > 0 ? durations[Math.floor(durations.length / 2)] : null,
      last: uptimeRows[0]
        ? {
            at: iso(uptimeRows[0].checkedAt),
            statusCode: uptimeRows[0].statusCode,
            responseMs: uptimeRows[0].responseMs,
            isOk: uptimeRows[0].isOk,
          }
        : null,
      recent: uptimeRows.slice(0, 20).map((r) => ({
        at: iso(r.checkedAt),
        statusCode: r.statusCode,
        responseMs: r.responseMs,
        isOk: r.isOk,
      })),
    },

    vercel: {
      configured: config.configured,
      missing: config.missing,
      hasToken: config.hasToken,
    },
  };
}
