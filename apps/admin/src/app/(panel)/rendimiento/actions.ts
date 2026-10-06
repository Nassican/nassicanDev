"use server";

import { revalidatePath } from "next/cache";
import { syncPageSpeed } from "@/lib/pagespeed";
import { requireUser } from "@/lib/session";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

/** The same measurement the cron makes, on demand: five Lighthouse runs, in parallel. */
export async function measureNow(): Promise<ActionResult> {
  await requireUser();
  const result = await syncPageSpeed();
  revalidatePath("/rendimiento");
  revalidatePath("/");
  if (!result.ok) return { ok: false, message: result.reason };
  return {
    ok: true,
    message: result.note
      ? `${result.rows} mediciones guardadas. ${result.note}`
      : `${result.rows} mediciones guardadas.`,
  };
}
