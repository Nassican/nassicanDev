import "server-only";

/**
 * The second door to Wallet, and it opens onto budgets only.
 *
 * `wallet-client.ts` stays read-only. This module is the one place that writes,
 * and only to budgets — **by construction**, the same way the reader is
 * read-only by construction:
 *
 *  1. There is one address, `BUDGETS`, and no function takes a path. A caller
 *     cannot point a write at records, accounts or categories.
 *  2. The verbs are GET, POST and PATCH, written into each function. There is
 *     no DELETE: Wallet's delete is one generic endpoint for every type, and
 *     closing a budget — which Wallet keeps, with its history — is the
 *     reversible way to retire one.
 *  3. Nothing generic is exported. The surface is a handful of named
 *     operations, each sending only the fields it is about.
 *  4. A limit change never uses `resetLimit`, which rewrites the limit of every
 *     past period too. It writes an override from this month on, which Wallet
 *     applies forward and leaves the past alone.
 *
 * The token has no scopes — the same one could delete records — so these rules
 * are the whole guarantee. `wallet-budgets.test.ts` reads this file and fails
 * if any of them is broken.
 */

const BUDGETS = "https://rest.budgetbakers.com/wallet/v1/api/budgets";

export type BudgetType = "BUDGET_INTERVAL_WEEK" | "BUDGET_INTERVAL_MONTH" | "BUDGET_INTERVAL_YEAR" | "BUDGET_CUSTOM" | "BUDGET_ALL";

export type WalletBudgetSpending = {
  periodStart: string | null;
  periodEnd: string | null;
  period: string;
  effectiveLimit: number;
  spent: number | null;
  remaining: number | null;
  overspent: number | null;
  progress: number | null;
  recordCount: number;
};

export type WalletBudgetLive = {
  id: string;
  name: string;
  closed: boolean | null;
  limit: number | null;
  currencyCode: string;
  type: BudgetType;
  categoryIds: string[];
  accountIds: string[];
  createdAt?: string;
  updatedAt?: string;
  spending?: { current: WalletBudgetSpending | null };
};

export type BudgetOutcome<T> = { ok: true; value: T } | { ok: false; reason: string };

function token(): string | null {
  return process.env.WALLET_API_TOKEN?.trim() || null;
}

async function failure(response: Response): Promise<string> {
  if (response.status === 429) {
    const wait = response.headers.get("retry-after");
    return `Wallet limitó las peticiones (300 por hora)${wait ? `; prueba en ${wait} s` : ""}.`;
  }
  const body = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
  return `Wallet respondió ${response.status}: ${body?.message ?? body?.error ?? response.statusText}`;
}

/** Open budgets, with what Wallet computed as spent in the current period. */
export async function readBudgetsWithSpending(): Promise<BudgetOutcome<WalletBudgetLive[]>> {
  const apiToken = token();
  if (!apiToken) return { ok: false, reason: "falta WALLET_API_TOKEN" };
  const out: WalletBudgetLive[] = [];
  // /budgets answers «limit must be at most 20», unlike the other endpoints.
  for (let offset = 0; offset < 200; offset += 20) {
    const url = `${BUDGETS}?limit=20&offset=${offset}&closed=false&spending=current`;
    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiToken}`, Accept: "application/json" },
      cache: "no-store",
    }).catch(() => null);
    if (!response) return { ok: false, reason: "No se pudo contactar con Wallet." };
    if (!response.ok) return { ok: false, reason: await failure(response) };
    const page = (await response.json()) as { budgets?: WalletBudgetLive[]; nextOffset?: number | null };
    out.push(...(page.budgets ?? []));
    if (!page.budgets || page.budgets.length < 20) break;
  }
  return { ok: true, value: out };
}

/** A new monthly budget in pesos, over the given categories (empty = all). */
export async function createMonthlyBudget(input: {
  name: string;
  limit: number;
  categoryIds: string[];
}): Promise<BudgetOutcome<WalletBudgetLive>> {
  const apiToken = token();
  if (!apiToken) return { ok: false, reason: "falta WALLET_API_TOKEN" };
  const response = await fetch(BUDGETS, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiToken}`, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      limit: input.limit,
      currencyCode: "COP",
      type: "BUDGET_INTERVAL_MONTH",
      categoryIds: input.categoryIds,
    }),
    cache: "no-store",
  }).catch(() => null);
  if (!response) return { ok: false, reason: "No se pudo contactar con Wallet." };
  if (!response.ok) return { ok: false, reason: await failure(response) };
  const body = (await response.json()) as { budget?: WalletBudgetLive };
  return body.budget ? { ok: true, value: body.budget } : { ok: false, reason: "Wallet no devolvió el presupuesto creado." };
}

/**
 * The only PATCH, and not exported. Its argument type is the whole list of
 * what this panel may change on a budget: the name, the limit from a month on,
 * the categories, and closed or open.
 */
type BudgetPatch =
  | { name: string }
  | { limitOverrides: { period: string; limit: number }[] }
  | { categoryIds: string[] }
  | { closed: boolean };

async function patchBudget(id: string, patch: BudgetPatch): Promise<BudgetOutcome<WalletBudgetLive>> {
  const apiToken = token();
  if (!apiToken) return { ok: false, reason: "falta WALLET_API_TOKEN" };
  const response = await fetch(`${BUDGETS}?returnData=true`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${apiToken}`, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify([{ id, ...patch }]),
    cache: "no-store",
  }).catch(() => null);
  if (!response) return { ok: false, reason: "No se pudo contactar con Wallet." };
  if (!response.ok) return { ok: false, reason: await failure(response) };
  const body = (await response.json()) as { results?: { success: boolean; budget?: WalletBudgetLive; error?: string }[] };
  const result = body.results?.[0];
  if (!result?.success) return { ok: false, reason: `Wallet no lo aceptó: ${result?.error ?? "sin detalle"}` };
  return result.budget ? { ok: true, value: result.budget } : { ok: false, reason: "Wallet no devolvió el presupuesto." };
}

export const renameBudget = (id: string, name: string) => patchBudget(id, { name });

/**
 * The limit from `period` («2026-10») onward. Wallet keeps every earlier
 * month's limit as it was; a change scheduled later than this month is
 * replaced, which is what «from now on» means.
 */
export const setBudgetLimitFrom = (id: string, period: string, limit: number) =>
  patchBudget(id, { limitOverrides: [{ period, limit }] });

export const setBudgetCategories = (id: string, categoryIds: string[]) => patchBudget(id, { categoryIds });

/** Closing keeps the budget and its history in Wallet; reopening brings it back. */
export const closeBudget = (id: string) => patchBudget(id, { closed: true });
export const reopenBudget = (id: string) => patchBudget(id, { closed: false });
