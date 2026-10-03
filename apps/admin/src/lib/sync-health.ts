import type { SyncSource } from "@nassican/db";

/**
 * Whether the mirrors are still being fed.
 *
 * **No `server-only` here, and that is deliberate.** Everything in this file is
 * pure, and `SyncSource` arrives through `import type`, which is erased at
 * compile time — so nothing in it reaches Prisma at runtime. It is the same
 * split as `post-draft.ts` against `posts.ts`: the reading lives in
 * `dashboard.ts`, which does carry the guard, and the deciding lives here, where
 * it can be tested without a request around it.
 *
 * This exists because of the scheduler, not before it. While every sync only ran
 * when somebody opened its module, the result was on screen a second later and
 * nothing could go unnoticed. Now they run at 06:00 unattended, and the only
 * place a failure shows is Sistema — which you have to go and look at. A cron
 * that fails in silence leaves stale analytics and missing snapshots piling up,
 * which is the exact problem the scheduler was built to prevent.
 */

/** What `/api/cron/daily` runs, and therefore what is expected to be fresh. */
const SCHEDULED = ["link_check", "ga4", "search_console", "vercel"] as const;

/**
 * Deliberately not watched:
 *
 * - `wallet` is synced by hand, so «no ha corrido en tres días» is not news.
 * - `uptime` is on demand for the same reason it is not in the cron: a daily
 *   check is a heartbeat, not monitoring.
 * - `content_stats` is an enum value nothing writes. The snapshot rides on
 *   `link_check`, which is the run that precedes it.
 */
export const UNWATCHED = ["wallet", "uptime", "content_stats"] as const;

/**
 * Every `SyncSource` has to be in exactly one of the two lists above, or this
 * stops compiling. Same trick as `localeParity` in `packages/db`: adding a
 * source to the schema and forgetting to decide whether it is watched would
 * otherwise be a silent gap, and a silent gap is what this module exists to
 * close.
 */
type Assigned = (typeof SCHEDULED)[number] | (typeof UNWATCHED)[number];
const sourceParity: Exclude<SyncSource, Assigned> extends never ? true : never = true;
void sourceParity;

/**
 * Two missed invocations, not one.
 *
 * The cron fires daily and Hobby may fire it anywhere inside the hour, so the
 * gap between two runs is up to 26 hours even when everything works. Vercel's
 * delivery is best effort and will occasionally skip one, and alerting on a
 * single skip is how an operator learns to ignore the warning. 48 h tolerates
 * one miss and still catches a cron that has actually stopped.
 */
const STALE_HOURS = 48;

/** A row left `running` longer than this was killed, not kept working. */
const ABANDONED_MINUTES = 15;

export type SyncProblem =
  | { kind: "failed"; source: SyncSource; at: Date; error: string | null }
  | { kind: "stale"; source: SyncSource; at: Date | null }
  | { kind: "abandoned"; source: SyncSource; at: Date };

type Run = {
  source: SyncSource;
  status: "running" | "ok" | "failed";
  startedAt: Date;
  finishedAt: Date | null;
  error: string | null;
};

/**
 * Reads the last run of every scheduled source and says what is wrong.
 *
 * Takes the runs rather than querying, so the dashboard can fetch them in the
 * same `Promise.all` as everything else — at this distance from the database a
 * dependent second query costs a whole round trip.
 *
 * **The window is a date, not a row count.** With `take: 50` a source that had
 * not run for a week would fall out behind fifty manual Wallet syncs and be
 * reported stale for the wrong reason.
 */
export function syncProblems(runs: Run[], now = new Date()): SyncProblem[] {
  const problems: SyncProblem[] = [];

  // Runs arrive newest first, so the first one seen per source is its latest.
  const latest = new Map<SyncSource, Run>();
  for (const run of runs) {
    if (!latest.has(run.source)) latest.set(run.source, run);
  }

  for (const source of SCHEDULED) {
    const run = latest.get(source);

    /*
     * Absence is the failure mode a naive version misses: a sync that fails
     * writes a row saying so, but a cron that never fired writes nothing at
     * all. Looking only for `failed` rows would have been blind to the one
     * thing that silently loses the snapshot every day.
     */
    if (!run) {
      problems.push({ kind: "stale", source, at: null });
      continue;
    }

    const ageHours = (now.getTime() - run.startedAt.getTime()) / 3_600_000;
    if (ageHours > STALE_HOURS) {
      problems.push({ kind: "stale", source, at: run.startedAt });
      continue;
    }

    /*
     * A row stuck on `running` is a function that was terminated mid-flight —
     * `maxDuration`, or a crash. Nothing else in the panel would ever mention
     * it: it is not a failure, so Sistema shows it as in progress forever.
     */
    if (run.status === "running" && !run.finishedAt) {
      const stuckMinutes = (now.getTime() - run.startedAt.getTime()) / 60_000;
      if (stuckMinutes > ABANDONED_MINUTES) {
        problems.push({ kind: "abandoned", source, at: run.startedAt });
      }
      continue;
    }

    /*
     * Only the **latest** run counts. A failure three days ago followed by
     * success is history, and reporting history as a problem is how a report
     * stops being read — the same reason Estadísticas keeps a host's anti-bot
     * answer out of the broken count.
     */
    if (run.status === "failed") {
      problems.push({
        kind: "failed",
        source,
        at: run.startedAt,
        error: run.error,
      });
    }
  }

  return problems;
}

/** How long ago, in the roughest terms that are still true. */
export function sinceLabel(at: Date | null, now = new Date()): string {
  if (!at) return "nunca";

  const hours = Math.floor((now.getTime() - at.getTime()) / 3_600_000);
  if (hours < 1) return "hace menos de una hora";
  if (hours < 24) return `hace ${hours} ${hours === 1 ? "hora" : "horas"}`;

  const days = Math.floor(hours / 24);
  return `hace ${days} ${days === 1 ? "día" : "días"}`;
}

/** The label the panel uses for each source, so it reads as a name. */
export const sourceLabels: Record<SyncSource, string> = {
  ga4: "Analítica",
  search_console: "Search Console",
  vercel: "Vercel",
  uptime: "Disponibilidad",
  content_stats: "Estadísticas",
  link_check: "Enlaces",
  wallet: "Wallet",
};

export const STALE_WINDOW_HOURS = STALE_HOURS;
