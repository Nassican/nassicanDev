"use server";

import { revalidatePath } from "next/cache";
import type { BudgetScope } from "@nassican/db";
import { budgetProblems } from "@/lib/budget-draft";
import { deleteLine, saveLine } from "@/lib/budget";
import { parseNumber } from "@/lib/draft-fields";
import { requireUser } from "@/lib/session";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

/*
 * Limits are configuration, like the menu: not audited, and deleted outright
 * rather than trashed — a limit is one number, quicker to type again than to
 * restore.
 */

export async function saveBudgetLine(scope: BudgetScope, key: string, rawLimit: string): Promise<ActionResult> {
  await requireUser();
  const limit = parseNumber(rawLimit);
  const problems = budgetProblems({ scope, key, limit });
  if (problems.length > 0) return { ok: false, message: problems.join(" ") };

  await saveLine({ scope, key, limit: limit! });
  revalidatePath("/presupuesto");
  revalidatePath("/");
  return { ok: true, message: scope === "total" ? "Límite del mes guardado." : `Límite de «${key.trim()}» guardado.` };
}

export async function deleteBudgetLine(id: string): Promise<ActionResult> {
  await requireUser();
  const label = await deleteLine(id);
  revalidatePath("/presupuesto");
  revalidatePath("/");
  return { ok: true, message: `Límite de «${label}» quitado.` };
}
