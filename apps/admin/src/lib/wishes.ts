import "server-only";

import { db, type Currency, type WishPriority, type WishStatus } from "@nassican/db";
import { calendarDate } from "@nassican/shared";
import { blankToNull, parseNumber } from "@/lib/draft-fields";
import { getTimezone } from "@/lib/site-config";
import { toCop } from "@/lib/subscriptions";
import { getTrm, type Trm } from "@/lib/trm";
import {
  compareWishes,
  isPastTarget,
  missing,
  monthlyNeeded,
  savedRatio,
  savedTotal,
  totalsByCurrency,
  type CurrencyTotal,
  type WishDraft,
} from "@/lib/wish-draft";

export type WishSavingRow = { id: string; at: string; amount: number; note: string | null };

export type WishRow = {
  id: string;
  title: string;
  url: string | null;
  note: string | null;
  priority: WishPriority;
  status: WishStatus;
  price: number | null;
  currency: Currency;
  targetDate: string | null;
  boughtAt: string | null;
  paid: number | null;
  savings: WishSavingRow[];
  saved: number;
  missing: number | null;
  ratio: number | null;
  /** Saved covers the price: it can be bought today. */
  ready: boolean;
  monthly: { amount: number; months: number } | null;
  pastTarget: boolean;
};

export type WishlistView = {
  today: string;
  rows: WishRow[];
  summary: {
    wanted: number;
    ready: number;
    /** Wanted with no price yet, so the totals do not count them. */
    unpriced: number;
    totals: CurrencyTotal[];
    /**
     * Everything in pesos, or null when some currency has no rate. A partial
     * sum labelled as a total is the figure this must not show.
     */
    cop: { cost: number; saved: number; missing: number } | null;
    trm: Trm | null;
  };
};

export async function getWishlist(): Promise<WishlistView> {
  const [items, timezone, trm] = await Promise.all([
    db.wishItem.findMany({
      include: { savings: { orderBy: [{ at: "desc" }, { createdAt: "desc" }] } },
    }),
    getTimezone(),
    getTrm(),
  ]);
  const today = calendarDate(timezone);

  const rows = items
    .map((item): WishRow => {
      const savings = item.savings.map((s) => ({ id: s.id, at: s.at, amount: Number(s.amount), note: s.note }));
      const price = item.price === null ? null : Number(item.price);
      const saved = savedTotal(savings);
      const stillMissing = missing(price, saved);
      const wanted = item.status === "wanted";
      return {
        id: item.id,
        title: item.title,
        url: item.url,
        note: item.note,
        priority: item.priority,
        status: item.status,
        price,
        currency: item.currency,
        targetDate: item.targetDate,
        boughtAt: item.boughtAt,
        paid: item.paid === null ? null : Number(item.paid),
        savings,
        saved,
        missing: stillMissing,
        ratio: savedRatio(price, saved),
        ready: wanted && price !== null && price > 0 && saved >= price,
        monthly: wanted ? monthlyNeeded(stillMissing, item.targetDate, today) : null,
        pastTarget: wanted && isPastTarget(item.targetDate, today),
      };
    })
    .sort(compareWishes);

  const wanted = rows.filter((r) => r.status === "wanted");
  const totals = totalsByCurrency(wanted);
  const converted = totals.map((t) => ({
    cost: toCop(t.cost, t.currency, trm),
    saved: toCop(t.saved, t.currency, trm),
    missing: toCop(t.missing, t.currency, trm),
  }));
  const sum = (key: "cost" | "saved" | "missing") => converted.reduce((n, t) => n + (t[key] ?? 0), 0);

  return {
    today,
    rows,
    summary: {
      wanted: wanted.length,
      ready: wanted.filter((r) => r.ready).length,
      unpriced: wanted.filter((r) => r.price === null).length,
      totals,
      cop: converted.every((t) => t.cost !== null) ? { cost: sum("cost"), saved: sum("saved"), missing: sum("missing") } : null,
      trm,
    },
  };
}

function toRow(draft: WishDraft) {
  const bought = draft.status === "bought";
  return {
    title: draft.title.trim(),
    url: blankToNull(draft.url),
    note: blankToNull(draft.note),
    priority: draft.priority,
    status: draft.status,
    price: parseNumber(draft.price),
    currency: draft.currency,
    targetDate: blankToNull(draft.targetDate),
    boughtAt: bought ? blankToNull(draft.boughtAt) : null,
    paid: bought ? parseNumber(draft.paid) : null,
  };
}

export async function saveWish(draft: WishDraft): Promise<{ id: string; created: boolean }> {
  if (draft.id) {
    await db.wishItem.update({ where: { id: draft.id }, data: toRow(draft) });
    return { id: draft.id, created: false };
  }
  const row = await db.wishItem.create({ data: toRow(draft), select: { id: true } });
  return { id: row.id, created: true };
}

/** A wish with what it has saved, for the rules that depend on the sum. */
export async function wishWithSaved(id: string): Promise<{ title: string; currency: Currency; status: WishStatus; saved: number }> {
  const item = await db.wishItem.findUniqueOrThrow({
    where: { id },
    select: { title: true, currency: true, status: true, savings: { select: { amount: true } } },
  });
  return {
    title: item.title,
    currency: item.currency,
    status: item.status,
    saved: savedTotal(item.savings.map((s) => ({ amount: Number(s.amount) }))),
  };
}

export async function addSaving(itemId: string, entry: { at: string; amount: number; note: string | null }): Promise<void> {
  await db.$transaction([
    db.wishSaving.create({ data: { itemId, at: entry.at, amount: entry.amount, note: entry.note } }),
    // Touched so «last changed» follows the saving, not only the edits.
    db.wishItem.update({ where: { id: itemId }, data: { updatedAt: new Date() } }),
  ]);
}

/** Null when it was already gone — a double click, or another tab. */
export async function deleteSaving(id: string): Promise<{ itemId: string; amount: number } | null> {
  const row = await db.wishSaving.findUnique({ where: { id }, select: { itemId: true, amount: true } });
  if (!row) return null;
  await db.wishSaving.delete({ where: { id } });
  return { itemId: row.itemId, amount: Number(row.amount) };
}

/**
 * Moves everything saved for one wish to another: a withdrawal on one side and
 * a deposit on the other, in one transaction and each naming the other, so both
 * histories still explain their totals.
 */
export async function moveSavings(
  fromId: string,
  toId: string,
  at: string,
): Promise<{ ok: true; amount: number; currency: Currency; from: string; to: string } | { ok: false; message: string }> {
  if (fromId === toId) return { ok: false, message: "Es el mismo deseo." };
  const [from, to] = await Promise.all([wishWithSaved(fromId), wishWithSaved(toId)]);
  if (from.saved <= 0) return { ok: false, message: `«${from.title}» no tiene nada ahorrado que pasar.` };
  if (from.currency !== to.currency) {
    return { ok: false, message: `«${from.title}» se ahorra en ${from.currency} y «${to.title}» en ${to.currency}.` };
  }
  await db.$transaction([
    db.wishSaving.create({ data: { itemId: fromId, at, amount: -from.saved, note: `Pasado a «${to.title}»` } }),
    db.wishSaving.create({ data: { itemId: toId, at, amount: from.saved, note: `Venía de «${from.title}»` } }),
  ]);
  return { ok: true, amount: from.saved, currency: from.currency, from: from.title, to: to.title };
}

export async function markBought(id: string, boughtAt: string, paid: number | null): Promise<string> {
  const row = await db.wishItem.update({
    where: { id },
    data: { status: "bought", boughtAt, paid },
    select: { title: true },
  });
  return row.title;
}

/**
 * Dropped, or back on the list. Going back to «lo quiero» clears the purchase:
 * something wanted again was not bought, and a date left behind would say it was.
 */
export async function setWishStatus(id: string, status: "wanted" | "dropped"): Promise<string> {
  const row = await db.wishItem.update({
    where: { id },
    data: { status, ...(status === "wanted" ? { boughtAt: null, paid: null } : {}) },
    select: { title: true },
  });
  return row.title;
}
