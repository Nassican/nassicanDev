import "server-only";

import { db, type BudgetScope } from "@nassican/db";
import { calendarDate } from "@nassican/shared";
import { daysIn, lineStatus, type LineStatus } from "@/lib/budget-draft";
import { TRANSFER_CATEGORY } from "@/lib/personal";
import { getTimezone } from "@/lib/site-config";
import { getTrm } from "@/lib/trm";

/**
 * The month's budget against the Wallet mirror. Read-only towards Wallet, like
 * everything else here: the limits live in `budget_lines`, and the spending is
 * the mirror's own rows, filtered the way Personal filters them.
 *
 * The month is UTC on both sides, for the reason Personal already wrote down:
 * Wallet stores a date-only record at 12:00Z, so a five-hour offset cannot move
 * it across a month, and the label and the rows then speak of the same month.
 */

export type BudgetLineView = LineStatus & { id: string; scope: BudgetScope; key: string; label: string };

export type BudgetView = {
  month: string;
  current: boolean;
  /** Day of the month the pace is measured at: today, or the last day of a past month. */
  day: number;
  daysInMonth: number;
  lines: BudgetLineView[];
  /** All expenses of the month, budgeted or not. */
  monthSpend: number;
  /** Groups with spending and no line of their own, biggest first. */
  unbudgeted: { group: string; spent: number }[];
  /** Renewals still to come this month, in pesos where it can be said. */
  renewals: { name: string; on: string; cop: number | null; price: number; currency: string }[];
  /** What the wish lists would cost, if bought: games, books and courses. */
  wishlist: number;
  options: { groups: string[]; categories: { name: string; group: string | null }[] };
  lastSync: string | null;
  /** Whole days since that sync, measured on the server: null if never. */
  syncDays: number | null;
};

const monthRange = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };
};

export async function getBudget(requested?: string): Promise<BudgetView> {
  const today = calendarDate(await getTimezone());
  const month = requested && /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : today.slice(0, 7);
  const current = month === today.slice(0, 7);
  const total = daysIn(month);
  const day = current ? Number(today.slice(8, 10)) : month < today.slice(0, 7) ? total : 0;

  const expenses = {
    amount: { lt: 0 },
    transferId: null,
    categoryId: { not: TRANSFER_CATEGORY },
    recordDate: monthRange(month),
  };

  const [lines, byGroup, byCategory, categories, subscriptions, trm, games, books, courses, sync] = await Promise.all([
    db.budgetLine.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    db.walletRecord.groupBy({ by: ["categoryGroup"], where: expenses, _sum: { amount: true } }),
    db.walletRecord.groupBy({ by: ["categoryName"], where: expenses, _sum: { amount: true } }),
    db.walletCategory.findMany({
      where: { archived: false, id: { not: TRANSFER_CATEGORY } },
      select: { name: true, groupName: true },
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

  // Spending as a positive magnitude: the mirror keeps Wallet's sign, and a
  // budget reads «gastaste 70.000», not «−70.000».
  const magnitude = (sum: { amount: unknown }) => Math.abs(Number(sum.amount ?? 0));
  const groupSpend = new Map(byGroup.map((r) => [r.categoryGroup, magnitude(r._sum)]));
  const categorySpend = new Map(byCategory.map((r) => [r.categoryName, magnitude(r._sum)]));
  const monthSpend = [...groupSpend.values()].reduce((n, v) => n + v, 0);

  const views: BudgetLineView[] = lines.map((line) => {
    const spent =
      line.scope === "total" ? monthSpend : line.scope === "group" ? (groupSpend.get(line.key) ?? 0) : (categorySpend.get(line.key) ?? 0);
    return {
      id: line.id,
      scope: line.scope,
      key: line.key,
      label: line.scope === "total" ? "Todo el mes" : line.key,
      ...lineStatus(spent, Number(line.monthlyLimit), day, total),
    };
  });

  const budgetedGroups = new Set(lines.filter((l) => l.scope === "group").map((l) => l.key));
  // A category line covers part of its group; the group still counts as
  // unbudgeted for the rest, so it is listed with what the lines do not cover.
  const coveredByCategory = new Map<string, number>();
  for (const line of lines.filter((l) => l.scope === "category")) {
    const group = categories.find((c) => c.name === line.key)?.groupName;
    if (group) coveredByCategory.set(group, (coveredByCategory.get(group) ?? 0) + (categorySpend.get(line.key) ?? 0));
  }
  const unbudgeted = [...groupSpend]
    .filter(([group]) => group && !budgetedGroups.has(group))
    .map(([group, spent]) => ({ group: group!, spent: spent - (coveredByCategory.get(group!) ?? 0) }))
    .filter((g) => g.spent > 0.5)
    .sort((a, b) => b.spent - a.spent);

  const end = `${month}-${String(total).padStart(2, "0")}`;
  const from = current ? today : `${month}-01`;
  const renewals = subscriptions
    .filter((s) => {
      const on = s.nextRenewal!;
      // A renewal written as a month is «this month», not a day nobody chose.
      return on.length === 7 ? on === month && current : on.slice(0, 10) >= from && on.slice(0, 10) <= end;
    })
    .map((s) => {
      const price = Number(s.price);
      const cop = s.currency === "COP" ? price : s.currency === "USD" && trm ? price * trm.value : null;
      return { name: s.name, on: s.nextRenewal!, cop, price, currency: s.currency };
    })
    .sort((a, b) => a.on.localeCompare(b.on));

  return {
    month,
    current,
    day,
    daysInMonth: total,
    lines: views,
    monthSpend,
    unbudgeted,
    renewals,
    wishlist: [games, books, courses].reduce((n, r) => n + Number(r._sum.price ?? 0), 0),
    options: {
      groups: [...new Set(categories.flatMap((c) => (c.groupName ? [c.groupName] : [])))],
      categories: categories.map((c) => ({ name: c.name, group: c.groupName })),
    },
    lastSync: sync?.startedAt.toISOString() ?? null,
    syncDays: sync ? Math.floor((Date.now() - sync.startedAt.getTime()) / 86_400_000) : null,
  };
}

export async function saveLine(line: { scope: BudgetScope; key: string; limit: number }): Promise<void> {
  const key = line.scope === "total" ? "" : line.key.trim();
  const last = await db.budgetLine.aggregate({ _max: { position: true } });
  await db.budgetLine.upsert({
    where: { scope_key: { scope: line.scope, key } },
    update: { monthlyLimit: line.limit },
    create: { scope: line.scope, key, monthlyLimit: line.limit, position: (last._max.position ?? -1) + 1 },
  });
}

export async function deleteLine(id: string): Promise<string> {
  const line = await db.budgetLine.delete({ where: { id } });
  return line.scope === "total" ? "Todo el mes" : line.key;
}

/** For the dashboard: this month's lines that are over, or heading over. */
export async function budgetWarnings(): Promise<BudgetLineView[]> {
  if ((await db.budgetLine.count()) === 0) return [];
  const view = await getBudget();
  return view.lines.filter((l) => l.pace === "exceeded" || l.pace === "over");
}
