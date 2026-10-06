import "server-only";

import { db } from "@nassican/db";

/**
 * The overview of everything that is not the website.
 *
 * Finanzas, Juegos and Libros each answer their own question well and none of
 * them answers the one you arrive with — *¿cómo voy?* — because that one is a
 * comparison and lives between the three.
 *
 * Everything is one `Promise.all`. At this distance a dependent query costs a
 * whole round trip, and the page is nothing but folds over rows that are already
 * coming.
 */

/**
 * Wallet's own Transfer category, which is money moving between your accounts.
 *
 * Filtering on `transfer_id` alone is not enough and the number says so: without
 * this id the top of the spending ranking was 36 million pesos that were never
 * spent on anything. The id is fixed across every Wallet account.
 */
export const TRANSFER_CATEGORY = "5c5c4e21-00c8-8000-8000-000000000000";

export type PersonalOverview = {
  games: {
    total: number;
    wishlist: number;
    backlog: number;
    playing: number;
    finished: number;
    /** What the unopened pile cost. The figure the games module exists for. */
    backlogSpend: number;
    hours: number;
  };
  books: {
    total: number;
    wishlist: number;
    backlog: number;
    reading: number;
    finished: number;
    backlogSpend: number;
  };
  money: {
    /**
     * Assets minus debts. Null when Wallet has never been synced, which is a
     * different answer from zero.
     */
    balance: number | null;
    /** What the non-credit accounts hold. */
    assets: number;
    /** What the cards owe, as a positive magnitude. */
    debts: number;
    /**
     * Cards whose starting balance was never entered, so `debts` is smaller
     * than the truth. Counted and named rather than silently absorbed into the
     * figure — this is the fingerprint `understatesDebt` already describes, and
     * a total that quietly inherits it would be the same lie one level up.
     */
    understated: number;
    /** Held in accounts the operator excluded from statistics inside Wallet. */
    outsideStats: number;
    monthSpend: number;
    monthLabel: string;
    topCategories: { name: string; total: number }[];
    lastSync: Date | null;
  };
};

type Count = { status: string; _count: { _all: number } };
const countOf = (rows: Count[], status: string) =>
  rows.find((r) => r.status === status)?._count._all ?? 0;

export async function getPersonalOverview(): Promise<PersonalOverview> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [
    gameCounts,
    gameMoney,
    bookCounts,
    bookMoney,
    accounts,
    monthSpend,
    topCategories,
    lastSync,
    hours,
  ] = await Promise.all([
    db.game.groupBy({ by: ["status"], _count: { _all: true } }),
    db.game.aggregate({
      where: { status: "backlog" },
      _sum: { price: true },
    }),
    db.book.groupBy({ by: ["status"], _count: { _all: true } }),
    db.book.aggregate({ where: { status: "backlog" }, _sum: { price: true } }),
    /*
     * Archived accounts are gone, but the ones flagged `excludeFromStats` are
     * not. That flag means «keep this out of my charts», and «¿cuánto tengo?» is
     * not a chart — filtering on it silently dropped 946.309 pesos of cash from
     * the total. They are counted, and how much they contribute is reported
     * separately, so the page imposes neither reading.
     */
    db.walletAccount.findMany({
      where: { archived: false },
      select: {
        accountType: true,
        currentBalance: true,
        initialBalance: true,
        recordCount: true,
        excludeFromStats: true,
      },
    }),
    db.walletRecord.aggregate({
      where: {
        amount: { lt: 0 },
        transferId: null,
        categoryId: { not: TRANSFER_CATEGORY },
        recordDate: { gte: monthStart },
      },
      _sum: { amount: true },
    }),
    db.walletRecord.groupBy({
      by: ["categoryName"],
      where: {
        amount: { lt: 0 },
        transferId: null,
        categoryId: { not: TRANSFER_CATEGORY },
        recordDate: { gte: monthStart },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "asc" } },
      take: 3,
    }),
    db.syncRun.findFirst({
      where: { source: "wallet", status: "ok" },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true },
    }),
    /*
     * Hours over every game that recorded them, played or dropped: the question
     * is how much time went in, and a game you abandoned after forty hours took
     * forty hours.
     *
     * In the same batch as the rest, not awaited after it. Doing that was
     * `getStats`'s original mistake and cost a whole round trip for a figure
     * nothing else depended on.
     */
    db.game.aggregate({ _sum: { hours: true } }),
  ]);

  /*
   * Split by account **type**, never by the sign of the balance.
   *
   * A savings account that went overdrawn is still somewhere you keep money, and
   * a card you overpaid is still a card. Sorting by sign would move an account
   * between «tengo» and «debo» depending on the week, and a figure that changes
   * category on its own is a figure nobody can read.
   */
  const assets = accounts
    .filter((a) => a.accountType !== "CreditCard")
    .reduce((n, a) => n + Number(a.currentBalance), 0);

  const debts = accounts
    .filter((a) => a.accountType === "CreditCard")
    // Wallet signs a card's balance negative; what is owed is its magnitude.
    .reduce((n, a) => n + Math.abs(Number(a.currentBalance)), 0);

  const understated = accounts.filter(
    (a) =>
      a.accountType === "CreditCard" &&
      Number(a.initialBalance) === 0 &&
      a.recordCount > 0,
  ).length;

  const outsideStats = accounts
    .filter((a) => a.excludeFromStats)
    .reduce((n, a) => n + Number(a.currentBalance), 0);

  return {
    games: {
      total: gameCounts.reduce((n, r) => n + r._count._all, 0),
      wishlist: countOf(gameCounts, "wishlist"),
      backlog: countOf(gameCounts, "backlog"),
      playing: countOf(gameCounts, "playing"),
      finished: countOf(gameCounts, "finished"),
      backlogSpend: Number(gameMoney._sum.price ?? 0),
      hours: hours._sum.hours ?? 0,
    },
    books: {
      total: bookCounts.reduce((n, r) => n + r._count._all, 0),
      wishlist: countOf(bookCounts, "wishlist"),
      backlog: countOf(bookCounts, "backlog"),
      reading: countOf(bookCounts, "reading"),
      finished: countOf(bookCounts, "finished"),
      backlogSpend: Number(bookMoney._sum.price ?? 0),
    },
    money: {
      // Null and zero are different answers: one means Wallet was never synced,
      // the other means the accounts really are empty.
      balance: accounts.length === 0 ? null : assets - debts,
      assets,
      debts,
      understated,
      outsideStats,
      // Wallet signs expenses negative, so the sum is negative and the page
      // wants a magnitude.
      monthSpend: Math.abs(Number(monthSpend._sum.amount ?? 0)),
      /*
       * Formatted in UTC because the boundary above is in UTC. Without it the
       * label read «septiembre» on the third of October: midnight UTC on the
       * first is seven in the evening on the thirtieth in Bogotá, so the name of
       * the month disagreed with the rows being counted.
       *
       * UTC on both sides is safe here rather than merely consistent: Wallet
       * stores a date-only record at 12:00:00Z, so a five-hour shift cannot move
       * one across a month boundary.
       */
      monthLabel: monthStart.toLocaleDateString("es-CO", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }),
      topCategories: topCategories
        .filter((c) => c.categoryName)
        .map((c) => ({ name: c.categoryName as string, total: Math.abs(Number(c._sum.amount ?? 0)) })),
      lastSync: lastSync?.startedAt ?? null,
    },
  };
}
