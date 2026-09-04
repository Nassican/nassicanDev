import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Deployment check, and later the target of the uptime monitor. Deliberately
 * does not touch the database: it has to answer even when Neon is asleep.
 */
export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "admin",
    time: new Date().toISOString(),
  });
}
