"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { saveMarketQuote } from "@/lib/pricing";
import { marketQuoteProblems, type MarketQuoteDraft } from "@/lib/pricing-market";
import type { PricingActionResult } from "../actions";
import { moveToTrash, TRASH_DAYS } from "@/lib/trash";

export async function saveMarketQuoteAction(draft: MarketQuoteDraft): Promise<PricingActionResult> {
  const user = await requireUser();
  const problems = marketQuoteProblems(draft);
  if (problems.length) return { ok: false, message: problems.join(" ") };
  const row = await saveMarketQuote(draft);
  await logAudit({
    userId: user.id,
    action: draft.id ? "update" : "create",
    entityType: "market_quote",
    entityId: row.id,
    diff: { title: row.description, provider: row.provider },
  });
  revalidatePath("/precios/mercado");
  revalidatePath("/precios");
  return { ok: true, message: "Referencia de mercado guardada.", id: row.id };
}
export async function deleteMarketQuoteAction(id: string): Promise<PricingActionResult> {
  const user = await requireUser();
  const removed = await moveToTrash("market_quote", id, user.id);
  if (removed)
    await logAudit({
      userId: user.id,
      action: "delete",
      entityType: "market_quote",
      entityId: id,
      diff: { title: removed.label, trash: true },
    });
  revalidatePath("/precios/mercado");
  revalidatePath("/precios");
  return {
    ok: true,
    message: removed
      ? `Referencia en la papelera durante ${TRASH_DAYS} días.`
      : "La referencia ya no estaba.",
  };
}
