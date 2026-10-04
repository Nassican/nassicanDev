import { NextResponse } from "next/server";
import { db } from "@nassican/db";

export const dynamic = "force-dynamic";

/** Long enough for Neon to wake a suspended compute, short enough to mean down. */
const TIMEOUT_MS = 5000;

/**
 * Readiness: the site can reach Postgres, which is what any page not already
 * cached needs.
 *
 * 503 when it cannot, so a monitor reads the status line and nothing else. The
 * error itself stays in the logs: a driver message can name the database host,
 * and this route answers anyone.
 *
 * Not for a probe that runs every minute — see `/api/health` for why.
 */
export async function GET() {
  const started = Date.now();

  try {
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`sin respuesta en ${TIMEOUT_MS} ms`)), TIMEOUT_MS),
      ),
    ]);

    return NextResponse.json(
      { status: "ok", service: "web", database: "ok", ms: Date.now() - started },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("health/db:", error);
    return NextResponse.json(
      { status: "degraded", service: "web", database: "unreachable", ms: Date.now() - started },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
