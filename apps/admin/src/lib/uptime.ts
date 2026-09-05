import "server-only";

import { db } from "@nassican/db";

/**
 * Whether the public site is answering, and how fast.
 *
 * On demand rather than on a schedule: this panel has no scheduler, and
 * pretending otherwise - a "monitoring" page whose data only moves when
 * somebody opens it - would be worse than saying so. What it does give is a
 * record over time, so "it feels slow lately" has something to check against.
 *
 * A HEAD would be cheaper and would prove less. What matters is that the page
 * renders, and the site renders on demand when the cache is cold, which is
 * exactly the case worth measuring.
 */
export async function runUptimeCheck(): Promise<
  { ok: true; statusCode: number | null; responseMs: number; isOk: boolean }
  | { ok: false; reason: string }
> {
  const url = process.env.PUBLIC_SITE_URL;
  if (!url) return { ok: false, reason: "PUBLIC_SITE_URL sin definir" };

  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  let statusCode: number | null = null;
  let isOk = false;

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
      headers: { "User-Agent": "NassicanUptime/1.0" },
    });
    statusCode = response.status;
    isOk = response.ok;
  } catch {
    isOk = false;
  } finally {
    clearTimeout(timer);
  }

  const responseMs = Math.round(performance.now() - started);

  await db.uptimeCheck.create({
    data: { url, statusCode, responseMs, isOk },
  });

  return { ok: true, statusCode, responseMs, isOk };
}
