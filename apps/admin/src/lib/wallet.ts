import "server-only";

import { Prisma } from "@nassican/db";
import { db, prismaJson } from "@nassican/db";
import {
  BUDGETS_PAGE_SIZE,
  hasWalletToken,
  PAGE_SIZE,
  readAccounts,
  readBudgets,
  readCategories,
  readRecords,
  type ApiBudget,
  type ApiRecord,
} from "@/lib/wallet-client";
import type { FinanceFilters, FinanceSummary } from "@/lib/wallet-draft";

export * from "@/lib/wallet-draft";
export { hasWalletToken };

/**
 * How far back a full sync reaches.
 *
 * Earlier than Wallet existed, so "everything" is a date and not a special
 * case. The API needs an explicit range or it applies a three-month window of
 * its own, so there is no way to say "all" except by saying a year.
 */
const EPOCH = "2000-01-01";

/** A money value for Postgres `numeric`, via string so no float rounds it. */
const money = (value: number) => new Prisma.Decimal(value.toFixed(4));

/**
 * A timestamp, or null if the source did not give a usable one.
 *
 * `new Date(undefined)` is an Invalid Date that Prisma rejects at insert time,
 * which is how one record with no `createdAt` killed a sync after writing 460
 * good ones. Parsing defensively keeps one odd row from costing the other
 * thousand.
 */
const when = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export type SyncOutcome =
  | {
      ok: true;
      accounts: number;
      categories: number;
      records: number;
      budgets: number;
      requests: number;
      remaining: number | null;
    }
  | { ok: false; reason: string };

/**
 * Pulls Wallet into the mirror.
 *
 * Replaces rather than appends: every row is upserted by Wallet's own id, and
 * records that no longer exist upstream are deleted. A mirror answers "what
 * does Wallet say now", not "what has it ever said" - the same reasoning the
 * outbound-link table follows.
 *
 * Request budget matters here. 300 an hour is the limit; a full sync of 1.300
 * records costs about a dozen, so `requests` is reported to make that visible
 * rather than something to find out by being throttled.
 */
export async function syncWallet(since = EPOCH): Promise<SyncOutcome> {
  if (!hasWalletToken()) {
    return { ok: false, reason: "falta WALLET_API_TOKEN en el entorno del panel" };
  }

  const run = await db.syncRun.create({
    data: { source: "wallet", status: "running" },
  });

  let requests = 0;
  let remaining: number | null = null;

  const fail = async (reason: string): Promise<SyncOutcome> => {
    await db.syncRun.update({
      where: { id: run.id },
      data: { status: "failed", error: reason, finishedAt: new Date() },
    });
    return { ok: false, reason };
  };

  try {
    // ---- accounts -------------------------------------------------------
    const accounts = await readAccounts();
    requests += 1;
    remaining = accounts.ok ? accounts.rate.remaining : remaining;
    if (!accounts.ok) return fail(accounts.reason);

    for (const a of accounts.items) {
      const fields = {
        name: a.name,
        accountType: a.accountType,
        currencyCode: a.currencyCode,
        color: a.color ?? null,
        archived: a.archived ?? false,
        excludeFromStats: a.excludeFromStats ?? false,
        isBankSync: a.isBankSync ?? false,
        initialBalance: money(a.balance?.initial ?? 0),
        currentBalance: money(a.balance?.currentBalance ?? 0),
        recordCount: a.recordStats?.recordCount ?? 0,
        createdAt: when(a.createdAt),
        updatedAt: when(a.updatedAt),
        syncedAt: new Date(),
      };
      await db.walletAccount.upsert({
        where: { id: a.id },
        update: fields,
        create: { id: a.id, ...fields },
      });
    }

    // ---- categories -----------------------------------------------------
    const categories = await readCategories();
    requests += 1;
    remaining = categories.ok ? categories.rate.remaining : remaining;
    if (!categories.ok) return fail(categories.reason);

    for (const c of categories.items) {
      const fields = {
        name: c.name,
        groupId: c.group?.id ?? null,
        groupName: c.group?.name ?? null,
        color: c.color ?? null,
        systemId: c.systemId ?? null,
        cardinality: c.cardinality ?? null,
        customCategory: c.customCategory ?? false,
        archived: c.archived ?? false,
        createdAt: when(c.createdAt),
        updatedAt: when(c.updatedAt),
        syncedAt: new Date(),
      };
      await db.walletCategory.upsert({
        where: { id: c.id },
        update: fields,
        create: { id: c.id, ...fields },
      });
    }

    // ---- budgets --------------------------------------------------------
    // Paged, because this endpoint caps at 20 while the others take 200. The
    // documented maximum is 200 for all of them; it is not.
    const budgetItems: ApiBudget[] = [];
    let budgetOffset = 0;

    for (;;) {
      const page = await readBudgets(budgetOffset);
      requests += 1;
      if (!page.ok) return fail(page.reason);
      remaining = page.rate.remaining;
      budgetItems.push(...page.items);

      if (page.items.length < BUDGETS_PAGE_SIZE) break;
      if (page.nextOffset === null || page.nextOffset <= budgetOffset) break;
      budgetOffset = page.nextOffset;
      if (requests > 40) break;
    }

    for (const b of budgetItems) {
      const fields = {
        name: b.name,
        limitAmount: money(b.limit ?? 0),
        currencyCode: b.currencyCode,
        type: b.type,
        closed: b.closed ?? false,
        accountIds: prismaJson.strings(b.accountIds ?? []),
        categoryIds: prismaJson.strings(b.categoryIds ?? []),
        createdAt: when(b.createdAt),
        updatedAt: when(b.updatedAt),
        syncedAt: new Date(),
      };
      await db.walletBudget.upsert({
        where: { id: b.id },
        update: fields,
        create: { id: b.id, ...fields },
      });
    }

    // ---- records, paged -------------------------------------------------
    const seen = new Set<string>();
    let offset = 0;

    for (;;) {
      const page = await readRecords(since, offset);
      requests += 1;
      if (!page.ok) return fail(page.reason);
      remaining = page.rate.remaining;

      for (const r of page.items) {
        seen.add(r.id);
        await writeRecord(r);
      }

      // The API stops advancing rather than returning an explicit end, so a
      // short page or a stalled offset is the terminator.
      if (page.items.length < PAGE_SIZE) break;
      if (page.nextOffset === null || page.nextOffset <= offset) break;
      offset = page.nextOffset;

      // A belt: 300 requests an hour is shared with everything else, and a
      // runaway loop would spend it all before anyone noticed.
      if (requests > 60) break;
    }

    // Deleted upstream means deleted here. Scoped to the window that was
    // actually read, so a partial sync cannot wipe older history.
    const removed = await db.walletRecord.deleteMany({
      where: { id: { notIn: [...seen] }, recordDate: { gte: new Date(since) } },
    });

    await db.syncRun.update({
      where: { id: run.id },
      data: {
        status: "ok",
        rowsWritten: seen.size,
        error:
          removed.count > 0
            ? `${removed.count} movimientos ya no existen en Wallet y se borraron del espejo`
            : null,
        finishedAt: new Date(),
      },
    });

    return {
      ok: true,
      accounts: accounts.items.length,
      categories: categories.items.length,
      records: seen.size,
      budgets: budgetItems.length,
      requests,
      remaining,
    };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "fallo al sincronizar Wallet");
  }
}

async function writeRecord(r: ApiRecord): Promise<void> {
  const fields = {
    accountId: r.accountId,
    accountName: r.accountName ?? "",
    categoryId: r.category?.id ?? null,
    categoryName: r.category?.name ?? null,
    categoryGroup: r.category?.group?.name ?? null,
    amount: money(r.amount?.value ?? 0),
    currencyCode: r.amount?.currencyCode ?? "",
    recordDate: new Date(r.recordDate),
    recordType: r.recordType,
    recordState: r.recordState,
    note: r.note ?? null,
    counterParty: r.counterParty ?? null,
    labels: prismaJson.strings(r.labels ?? []),
    transferId: r.transfer?.id ?? null,
    source: r.source ?? null,
    createdAt: when(r.createdAt),
    updatedAt: when(r.updatedAt),
    syncedAt: new Date(),
  };

  await db.walletRecord.upsert({
    where: { id: r.id },
    update: fields,
    create: { id: r.id, ...fields },
  });
}

// ------------------------------------------------------------------- reading

/** How many rows a page of the listing shows. */
export const RECORDS_PER_PAGE = 50;

/**
 * The mirror, filtered and sorted however the operator asked.
 *
 * This is the whole reason the data is local: four filters and a free choice of
 * sort column, which the API caps at two conditions and one fixed order.
 */
export async function getFinances(
  filters: FinanceFilters,
): Promise<FinanceSummary> {
  const where: Prisma.WalletRecordWhereInput = {
    ...(filters.accountId ? { accountId: filters.accountId } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.type ? { recordType: filters.type } : {}),
    ...(filters.from || filters.to
      ? {
          recordDate: {
            ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00Z`) } : {}),
            // Inclusive end: a day-only bound means the whole day, and Wallet
            // stores date-only records at 12:00:00Z.
            ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59Z`) } : {}),
          },
        }
      : {}),
    ...(filters.search
      ? {
          OR: [
            { note: { contains: filters.search, mode: "insensitive" } },
            { counterParty: { contains: filters.search, mode: "insensitive" } },
            { accountName: { contains: filters.search, mode: "insensitive" } },
            { categoryName: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const order: Prisma.WalletRecordOrderByWithRelationInput =
    filters.sort === "amount"
      ? { amount: filters.direction }
      : filters.sort === "category"
        ? { categoryName: filters.direction }
        : filters.sort === "account"
          ? { accountName: filters.direction }
          : { recordDate: filters.direction };

  const page = Math.max(1, filters.page);

  const [records, total, accounts, categories, budgets, lastRun, totals] =
    await Promise.all([
      db.walletRecord.findMany({
        where,
        orderBy: [order, { id: "asc" }],
        skip: (page - 1) * RECORDS_PER_PAGE,
        take: RECORDS_PER_PAGE,
      }),
      db.walletRecord.count({ where }),
      db.walletAccount.findMany({ orderBy: [{ archived: "asc" }, { name: "asc" }] }),
      db.walletCategory.findMany({
        where: { archived: false },
        orderBy: [{ groupName: "asc" }, { name: "asc" }],
      }),
      db.walletBudget.findMany({ where: { closed: false }, orderBy: { name: "asc" } }),
      db.syncRun.findFirst({ where: { source: "wallet" }, orderBy: { startedAt: "desc" } }),
      // Over the filtered set, not the page: a total that changes when you turn
      // the page is not a total.
      db.walletRecord.groupBy({ by: ["recordType"], where, _sum: { amount: true } }),
    ]);

  const sumFor = (type: string) =>
    Number(totals.find((t) => t.recordType === type)?._sum.amount ?? 0);

  return {
    records: records.map((r) => ({
      id: r.id,
      accountName: r.accountName,
      categoryName: r.categoryName,
      categoryGroup: r.categoryGroup,
      amount: Number(r.amount),
      currencyCode: r.currencyCode,
      recordDate: r.recordDate.toISOString(),
      recordType: r.recordType,
      note: r.note,
      counterParty: r.counterParty,
    })),
    total,
    page,
    perPage: RECORDS_PER_PAGE,
    totals: {
      income: sumFor("income"),
      expense: sumFor("expense"),
      transfer: sumFor("transfer"),
    },
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      accountType: a.accountType,
      currencyCode: a.currencyCode,
      currentBalance: Number(a.currentBalance),
      archived: a.archived,
      excludeFromStats: a.excludeFromStats,
      recordCount: a.recordCount,
    })),
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      groupName: c.groupName,
      color: c.color,
    })),
    budgets: budgets.map((b) => ({
      id: b.id,
      name: b.name,
      limitAmount: Number(b.limitAmount),
      currencyCode: b.currencyCode,
      type: b.type,
    })),
    lastSync: lastRun
      ? {
          at: (lastRun.finishedAt ?? lastRun.startedAt).toISOString(),
          status: lastRun.status,
          rows: lastRun.rowsWritten,
          note: lastRun.error,
        }
      : null,
    configured: hasWalletToken(),
  };
}
