"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { listAnalyticsProperties, syncAnalytics } from "@/lib/analytics";

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

  return result.ok
    ? {
        ok: true,
        message:
          result.days === 0
            ? `Sin datos entre ${result.from} y ${result.to}. Si la etiqueta se instaló hace poco, aún no hay nada que traer.`
            : `${result.days} días traídos (${result.from} → ${result.to}).`,
      }
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
