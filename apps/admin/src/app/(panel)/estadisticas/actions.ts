"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { checkOutboundLinks } from "@/lib/link-check";
import { snapshotStats } from "@/lib/stats";

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

/**
 * Checking links and recording the day's figures happen together: the snapshot
 * stores how many links were broken, so taking it before the check would file
 * yesterday's answer under today's date.
 */
export async function runContentCheck(): Promise<ActionResult> {
  await requireUser();

  const links = await checkOutboundLinks();
  if (!links.ok) {
    revalidatePath("/estadisticas");
    return { ok: false, message: links.reason };
  }

  const { date } = await snapshotStats();
  revalidatePath("/estadisticas");

  // "Broken" and "unverifiable" are reported separately on purpose: folding a
  // host's anti-bot answer into the broken count is the one thing that would
  // make this number untrustworthy.
  const parts = [`${links.checked} enlaces revisados`];
  parts.push(
    links.broken === 0
      ? "ninguno roto"
      : `${links.broken} ${links.broken === 1 ? "roto" : "rotos"}`,
  );
  if (links.unverifiable > 0) {
    parts.push(`${links.unverifiable} sin comprobar`);
  }

  return {
    ok: true,
    message: `${parts.join(", ")}. Instantánea del ${date} guardada.`,
  };
}
