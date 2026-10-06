import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { syncAnalytics } from "@/lib/analytics";
import { checkOutboundLinks } from "@/lib/link-check";
import { syncPageSpeed } from "@/lib/pagespeed";
import { syncSearchConsole } from "@/lib/search-console";
import { snapshotStats } from "@/lib/stats";
import { TRASH_DAYS, purgeTrash } from "@/lib/trash";
import { syncDeployments, syncVercelAnalytics } from "@/lib/vercel";

/**
 * Everything the panel used to do only when somebody opened the module.
 *
 * Measured worst cases, in series: link check 14.8 s, Vercel ~9.6 s, GA4 3.3 s,
 * Search Console 1 s. The externals run in parallel, so this lands well inside
 * the limit. Wallet is deliberately **not** here — it is synced by hand, and at
 * 126 s in its worst case it would have had to be its own job anyway.
 *
 * Uptime is not here either, and that is a judgement rather than an oversight: a
 * once-a-day check is a heartbeat, not monitoring. It would report an outage up
 * to 24 hours late, and a Hobby plan cannot schedule anything more frequent. It
 * stays on demand, where at least the page says plainly that the number moves
 * when you ask for it.
 */
export const maxDuration = 120;

/**
 * Never cached. Vercel does not list a cron invocation in the logs when the
 * response was cached or was a redirect, and the response body is the only
 * diagnostic this job has.
 */
export const dynamic = "force-dynamic";

/**
 * Vercel sends `Authorization: Bearer $CRON_SECRET` when that variable exists.
 *
 * **Not `requireUser()`.** That redirects to `/login`, and cron jobs do not
 * follow redirects: the job would take the 3xx, be recorded as finished, and
 * have done nothing at all. A silent success is the worst possible failure for
 * something nobody watches.
 */
function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // Fails closed: no secret, no run.

  const sent = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);

  // Length first, because `timingSafeEqual` throws on a mismatch and that throw
  // is itself a signal.
  return sent.length === expected.length && timingSafeEqual(sent, expected);
}

type Step = { task: string; ok: boolean; ms: number; detail?: string };

async function step(task: string, run: () => Promise<string | void>): Promise<Step> {
  const started = Date.now();
  try {
    const detail = await run();
    return { task, ok: true, ms: Date.now() - started, detail: detail ?? undefined };
  } catch (error) {
    return {
      task,
      ok: false,
      ms: Date.now() - started,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function GET(request: Request) {
  if (!authorised(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const steps: Step[] = [];

  /*
   * The link check runs first because the snapshot stores how many links were
   * broken, so checking after would file yesterday's answer under today's date.
   */
  const links = await step("link_check", async () => {
    const result = await checkOutboundLinks();
    if (!result.ok) throw new Error(result.reason);
    return `${result.checked} revisados, ${result.broken} rotos, ${result.unverifiable} sin comprobar`;
  });
  steps.push(links);

  /*
   * The snapshot is taken **even when the link check failed**, which is where
   * this differs from the button in Estadísticas.
   *
   * There it is right to bail: the operator sees the error and presses again.
   * Here there is no again — Vercel does not retry a failed cron, so a day
   * skipped is a day gone for good. Seven of the snapshot's eight fields have
   * nothing to do with links, and throwing away the content and translation
   * figures to avoid one stale count is the wrong side of that trade.
   */
  steps.push(await step("snapshot", async () => {
    const { date } = await snapshotStats();
    return date;
  }));

  // Its own step so a failure is named, and after the snapshot so it can never
  // be the reason the one unrecoverable step did not run.
  steps.push(await step("trash_purge", async () => {
    const removed = await purgeTrash();
    return `${removed} ${removed === 1 ? "elemento" : "elementos"} de más de ${TRASH_DAYS} días`;
  }));

  // Four different services, so these wait on each other for no reason.
  const external = await Promise.all([
    step("ga4", async () => {
      const r = await syncAnalytics();
      if (!r.ok) throw new Error(r.reason);
      // `note` is how GA4 tells an empty range apart from a broken sync, which
      // is precisely the distinction a log nobody reads daily needs to carry.
      return [`${r.days} días`, `${r.from} → ${r.to}`, r.note].filter(Boolean).join(" · ");
    }),
    step("search_console", async () => {
      const r = await syncSearchConsole();
      if (!r.ok) throw new Error(r.reason);
      return `${r.rows} filas`;
    }),
    step("vercel_analytics", async () => {
      const r = await syncVercelAnalytics();
      if (!r.ok) throw new Error(r.reason);
      return `${r.rows} filas`;
    }),
    step("vercel_deployments", async () => {
      const r = await syncDeployments();
      if (!r.ok) throw new Error(r.reason);
      return `${r.rows} filas`;
    }),
    // The slowest of the five — Lighthouse takes 10 to 30 s a page — and the
    // pages run in parallel inside it, so it fits the same window.
    step("pagespeed", async () => {
      const r = await syncPageSpeed();
      if (!r.ok) throw new Error(r.reason);
      return [`${r.rows} mediciones`, r.note].filter(Boolean).join(" · ");
    }),
  ]);

  steps.push(...external);

  /*
   * 200 even when a step failed, and the body says which.
   *
   * Each sync already writes its own `sync_runs` row, so Sistema lists the
   * failure with its message either way — that is the record that matters. A
   * 500 here would only mean the Vercel dashboard shows red for a Google outage
   * that nothing in this project can act on.
   */
  return NextResponse.json({
    ok: steps.every((s) => s.ok),
    ms: steps.reduce((total, s) => total + s.ms, 0),
    steps,
  });
}
