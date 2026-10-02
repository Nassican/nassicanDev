"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { listAnalyticsProperties, syncAnalytics } from "@/lib/analytics";
import { syncVercelAnalytics } from "@/lib/vercel";

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export type DetectedProperty = { id: string; name: string };

export type DetectPropertiesResult =
  | { ok: true; properties: DetectedProperty[] }
  | { ok: false; message: string };

export async function runAnalyticsSync(days: number): Promise<ActionResult> {
  await requireUser();

  const result = await syncAnalytics(days);
  revalidatePath("/analitica");

  if (!result.ok) return { ok: false, message: result.reason };

  // A zero now explains itself: GA4 was asked whether the property has data at
  // all, so the message distinguishes "this range is empty" from "nothing has
  // ever arrived".
  if (result.days === 0) {
    return {
      ok: true,
      message:
        result.note ??
        `Sin datos entre ${result.from} y ${result.to}.`,
    };
  }

  return {
    ok: true,
    message: `${result.days} días traídos (${result.from} → ${result.to}).`,
  };
}

/**
 * Vercel Web Analytics into its own table.
 *
 * Its own action rather than part of the GA4 sync: they are different
 * providers with different credentials, and one being unconfigured must not
 * stop the other from refreshing.
 */
export async function runVercelSync(): Promise<ActionResult> {
  await requireUser();

  const result = await syncVercelAnalytics();
  revalidatePath("/analitica");

  return result.ok
    ? { ok: true, message: `${result.rows} filas traídas de Vercel.` }
    : { ok: false, message: result.reason };
}

/** Lists the GA4 properties this Google account can read. */
export async function detectAnalyticsProperties(): Promise<DetectPropertiesResult> {
  await requireUser();

  const result = await listAnalyticsProperties();
  return result.ok
    ? { ok: true, properties: result.properties }
    : { ok: false, message: result.reason };
}
