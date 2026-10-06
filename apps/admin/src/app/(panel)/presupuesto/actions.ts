"use server";

import { revalidatePath } from "next/cache";
import { calendarDate } from "@nassican/shared";
import { logAudit, type AuditAction } from "@/lib/audit";
import { mirrorBudget } from "@/lib/budget";
import { MAX_BUDGET_NAME, newBudgetProblems } from "@/lib/budget-draft";
import { parseNumber } from "@/lib/draft-fields";
import { requireUser } from "@/lib/session";
import { getTimezone } from "@/lib/site-config";
import {
  closeBudget,
  createMonthlyBudget,
  renameBudget,
  reopenBudget,
  setBudgetCategories,
  setBudgetLimitFrom,
  type BudgetOutcome,
  type WalletBudgetLive,
} from "@/lib/wallet-budgets";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

/*
 * Every write to Wallet is audited: it changes something outside this panel,
 * in the app the operator also uses on the phone, and «who changed my budget»
 * deserves an answer.
 */
async function after(
  outcome: BudgetOutcome<WalletBudgetLive>,
  userId: string,
  action: AuditAction,
  detail: Record<string, unknown>,
  message: (b: WalletBudgetLive) => string,
): Promise<ActionResult> {
  if (!outcome.ok) return { ok: false, message: outcome.reason };
  await mirrorBudget(outcome.value);
  await logAudit({
    userId,
    action,
    entityType: "wallet-budget",
    entityId: outcome.value.id,
    diff: { name: outcome.value.name, ...detail },
  });
  revalidatePath("/presupuesto");
  revalidatePath("/finanzas");
  revalidatePath("/");
  return { ok: true, message: message(outcome.value) };
}

const cop = (n: number) => n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export async function createBudget(name: string, rawLimit: string, categoryIds: string[]): Promise<ActionResult> {
  const user = await requireUser();
  const limit = parseNumber(rawLimit);
  const problems = newBudgetProblems({ name, limit, categoryIds });
  if (problems.length > 0) return { ok: false, message: problems.join(" ") };

  const outcome = await createMonthlyBudget({ name: name.trim(), limit: limit!, categoryIds });
  return after(outcome, user.id, "create", { limit }, (b) => `«${b.name}» creado en Wallet: ${cop(limit!)} al mes.`);
}

/** From this month on: Wallet keeps every past month's limit as it was. */
export async function changeLimit(id: string, rawLimit: string): Promise<ActionResult> {
  const user = await requireUser();
  const limit = parseNumber(rawLimit);
  if (limit === null || !(limit > 0)) return { ok: false, message: "El límite tiene que ser mayor que cero." };
  const month = calendarDate(await getTimezone()).slice(0, 7);
  const outcome = await setBudgetLimitFrom(id, month, limit);
  return after(outcome, user.id, "update", { limit, from: month }, (b) => `«${b.name}»: ${cop(limit)} desde este mes.`);
}

export async function rename(id: string, name: string): Promise<ActionResult> {
  const user = await requireUser();
  const clean = name.trim();
  if (!clean || clean.length > MAX_BUDGET_NAME) return { ok: false, message: "El nombre no puede quedar vacío ni pasar de 80 caracteres." };
  const outcome = await renameBudget(id, clean);
  return after(outcome, user.id, "update", { renamed: true }, (b) => `Ahora se llama «${b.name}».`);
}

export async function changeCategories(id: string, categoryIds: string[]): Promise<ActionResult> {
  const user = await requireUser();
  const outcome = await setBudgetCategories(id, categoryIds);
  return after(outcome, user.id, "update", { categories: categoryIds.length }, (b) =>
    categoryIds.length === 0 ? `«${b.name}» cubre ahora todas las categorías.` : `«${b.name}»: ${categoryIds.length} categorías.`,
  );
}

export async function close(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const outcome = await closeBudget(id);
  return after(outcome, user.id, "update", { closed: true }, (b) => `«${b.name}» cerrado. Sigue en Wallet con su historial y se puede reabrir.`);
}

export async function reopen(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const outcome = await reopenBudget(id);
  return after(outcome, user.id, "update", { closed: false }, (b) => `«${b.name}» reabierto.`);
}
