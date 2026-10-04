import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Liveness: this process is up and answering. Nothing else.
 *
 * **Deliberately does not touch the database**, and that is a cost decision
 * before it is a technical one. A load balancer or an uptime monitor calls this
 * every minute; Neon suspends its compute after a few minutes without queries,
 * and a probe that queried it every sixty seconds would keep it awake around the
 * clock — billed compute hours spent on asking whether the site is alive.
 *
 * Whether Postgres answers is `/api/health/db`, for a slower monitor or a human.
 *
 * Outside the locale proxy: its matcher already skips `/api/`.
 */
function answer(): NextResponse {
  return NextResponse.json(
    { status: "ok", service: "web", time: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export function GET() {
  return answer();
}

/** Some balancers probe with HEAD; the status line is the whole answer. */
export function HEAD() {
  return new NextResponse(null, { status: 200, headers: { "Cache-Control": "no-store" } });
}
