import "server-only";

import { db, prismaJson } from "@nassican/db";
import { calendarDate } from "@nassican/shared";
import { daysIn, lineStatus, periodPosition, type LineStatus } from "@/lib/budget-draft";
import { TRANSFER_CATEGORY } from "@/lib/personal";
import { getTimezone } from "@/lib/site-config";
import { getTrm } from "@/lib/trm";
import { readBudgetsWithSpending, type WalletBudgetLive } from "@/lib/wallet-budgets";

/**
 * The month's budget: Wallet's own budgets, read live with what Wallet computed
 * as spent, plus the pace this panel adds.
 *
 * Read live and not from the mirror because these numbers are the ones being
 * acted on, and Wallet is the source a budget is edited in. If Wallet does not
 * answer, the page falls back to the mirror and computes the spending itself
 * from mirrored records — and says so, because the two can differ by whatever
 * was logged since the last sync.
 */

export type BudgetCard = LineStatus & {
  id: string;
  name: string;
  type: WalletBudgetLive["type"];
  currencyCode: string;
  categoryIds: string[];
  /** Category names, or «todas» when the budget covers every category. */
  categories: string[];
  period: string;
  recordCount: number | null;
};

export type BudgetView = {
  source: "wallet" | "mirror";
  /** Why it fell back to the mirror, when it did. */
  error: string | null;
  today: string;
  month: string;
  cards: BudgetCard[];
  closed: { id: string; name: string }[];
  /** Spending this month in categories no open budget covers, by group. */
  unbudgeted: { group: string; spent: number }[];
  renewals: { name: string; on: string; cop: number | null; price: number; currency: string }[];
  wishlist: number;
  categories: { id: string; name: string; group: string }[];
  lastSync: string | null;
  syncDays: number | null;
};

const monthRange = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };
};

/** Expenses as Personal counts them: no transfers, by id or by category. */
const expensesIn = (month: string) => ({
  amount: { lt: 0 },
  transferId: null,
  categoryId: { not: TRANSFER_CATEGORY },
  recordDate: monthRange(month),
});

export async function getBudget(): Promise<BudgetView> {
  const today = calendarDate(await getTimezone());
  const month = today.slice(0, 7);

  const [live, mirror, byCategory, categories, subscriptions, trm, games, books, courses, sync] = await Promise.all([
    readBudgetsWithSpending(),
    db.walletBudget.findMany({ orderBy: { name: "asc" } }),
    db.walletRecord.groupBy({ by: ["categoryId", "categoryGroup"], where: expensesIn(month), _sum: { amount: true } }),
    db.walletCategory.findMany({
      where: { archived: false, id: { not: TRANSFER_CATEGORY } },
      select: { id: true, name: true, groupName: true },
      orderBy: [{ groupName: "asc" }, { name: "asc" }],
    }),
    db.subscription.findMany({
      where: { status: "active", nextRenewal: { not: null } },
      select: { name: true, nextRenewal: true, price: true, currency: true },
    }),
    getTrm(),
    db.game.aggregate({ where: { status: "wishlist" }, _sum: { price: true } }),
    db.book.aggregate({ where: { status: "wishlist" }, _sum: { price: true } }),
    db.course.aggregate({ where: { status: "wishlist" }, _sum: { price: true } }),
    db.syncRun.findFirst({
      where: { source: "wallet", status: "ok" },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true },
    }),
  ]);

  const nameOf = new Map(categories.map((c) => [c.id, c.name]));
  const spentBy = new Map(byCategory.map((r) => [r.categoryId, Math.abs(Number(r._sum.amount ?? 0))]));
  const localSpend = (ids: string[]) =>
    ids.length === 0 ? [...spentBy.values()].reduce((n, v) => n + v, 0) : ids.reduce((n, id) => n + (spentBy.get(id) ?? 0), 0);
  const labels = (ids: string[]) => (ids.length === 0 ? ["todas las categorías"] : ids.map((id) => nameOf.get(id) ?? "categoría archivada"));

  const monthDays = periodPosition(`${month}-01`, `${month}-${String(daysIn(month)).padStart(2, "0")}`, today);

  let cards: BudgetCard[];
  if (live.ok) {
    cards = live.value
      .filter((b) => b.type !== "BUDGET_ALL")
      .map((b) => {
        const current = b.spending?.current;
        const position = current?.periodStart && current.periodEnd ? periodPosition(current.periodStart, current.periodEnd, today) : monthDays;
        return {
          id: b.id,
          name: b.name,
          type: b.type,
          currencyCode: b.currencyCode,
          categoryIds: b.categoryIds ?? [],
          categories: labels(b.categoryIds ?? []),
          period: current?.period ?? month,
          recordCount: current?.recordCount ?? null,
          ...lineStatus(current?.spent ?? 0, current?.effectiveLimit ?? b.limit ?? 0, position.day, position.days),
        };
      });
  } else {
    // The mirror knows the limits and the categories; the spending is computed
    // here from mirrored records, monthly budgets only.
    cards = mirror
      .filter((b) => !b.closed && b.type === "BUDGET_INTERVAL_MONTH")
      .map((b) => ({
        id: b.id,
        name: b.name,
        type: b.type as WalletBudgetLive["type"],
        currencyCode: b.currencyCode,
        categoryIds: b.categoryIds,
        categories: labels(b.categoryIds),
        period: month,
        recordCount: null,
        ...lineStatus(localSpend(b.categoryIds), Number(b.limitAmount), monthDays.day, monthDays.days),
      }));
  }

  const covered = new Set(cards.flatMap((c) => c.categoryIds));
  const coversAll = cards.some((c) => c.categoryIds.length === 0);
  const groups = new Map<string, number>();
  if (!coversAll) {
    for (const r of byCategory) {
      if (!r.categoryId || covered.has(r.categoryId)) continue;
      const group = r.categoryGroup ?? "Sin grupo";
      groups.set(group, (groups.get(group) ?? 0) + Math.abs(Number(r._sum.amount ?? 0)));
    }
  }

  const end = `${month}-${String(monthDays.days).padStart(2, "0")}`;
  const renewals = subscriptions
    .filter((s) => {
      const on = s.nextRenewal!;
      return on.length === 7 ? on === month : on.slice(0, 10) >= today && on.slice(0, 10) <= end;
    })
    .map((s) => {
      const price = Number(s.price);
      const cop = s.currency === "COP" ? price : s.currency === "USD" && trm ? price * trm.value : null;
      return { name: s.name, on: s.nextRenewal!, cop, price, currency: s.currency };
    })
    .sort((a, b) => a.on.localeCompare(b.on));

  return {
    source: live.ok ? "wallet" : "mirror",
    error: live.ok ? null : live.reason,
    today,
    month,
    cards,
    closed: mirror.filter((b) => b.closed).map((b) => ({ id: b.id, name: b.name })),
    unbudgeted: [...groups].map(([group, spent]) => ({ group, spent })).filter((g) => g.spent > 0.5).sort((a, b) => b.spent - a.spent),
    renewals,
    wishlist: [games, books, courses].reduce((n, r) => n + Number(r._sum.price ?? 0), 0),
    categories: categories.map((c) => ({ id: c.id, name: c.name, group: c.groupName ?? "Sin grupo" })),
    lastSync: sync?.startedAt.toISOString() ?? null,
    syncDays: sync ? Math.floor((Date.now() - sync.startedAt.getTime()) / 86_400_000) : null,
  };
}

/**
 * After a write, the mirror is updated from what Wallet answered, so Movimientos
 * and the dashboard see the change before the next full sync.
 */
export async function mirrorBudget(b: WalletBudgetLive): Promise<void> {
  const fields = {
    name: b.name,
    limitAmount: b.spending?.current?.effectiveLimit ?? b.limit ?? 0,
    currencyCode: b.currencyCode,
    type: b.type,
    closed: b.closed ?? false,
    accountIds: prismaJson.strings(b.accountIds ?? []),
    categoryIds: prismaJson.strings(b.categoryIds ?? []),
    syncedAt: new Date(),
  };
  await db.walletBudget.upsert({ where: { id: b.id }, update: fields, create: { id: b.id, ...fields } });
}

/**
 * For the dashboard: monthly budgets over their limit or heading there, from
 * the mirror. No call to Wallet — the dashboard opens every day, and the
 * budget page is where the live numbers are read.
 */
export async function budgetWarnings(): Promise<BudgetCard[]> {
  const budgets = await db.walletBudget.findMany({ where: { closed: false, type: "BUDGET_INTERVAL_MONTH" } });
  if (budgets.length === 0) return [];
  const today = calendarDate(await getTimezone());
  const month = today.slice(0, 7);
  const rows = await db.walletRecord.groupBy({ by: ["categoryId"], where: expensesIn(month), _sum: { amount: true } });
  const spentBy = new Map(rows.map((r) => [r.categoryId, Math.abs(Number(r._sum.amount ?? 0))]));
  const days = daysIn(month);
  const day = Number(today.slice(8, 10));
  return budgets
    .map((b) => {
      const spent =
        b.categoryIds.length === 0
          ? [...spentBy.values()].reduce((n, v) => n + v, 0)
          : b.categoryIds.reduce((n, id) => n + (spentBy.get(id) ?? 0), 0);
      return {
        id: b.id,
        name: b.name,
        type: b.type as WalletBudgetLive["type"],
        currencyCode: b.currencyCode,
        categoryIds: b.categoryIds,
        categories: [],
        period: month,
        recordCount: null,
        ...lineStatus(spent, Number(b.limitAmount), day, days),
      };
    })
    .filter((c) => c.pace === "exceeded" || c.pace === "over");
}
