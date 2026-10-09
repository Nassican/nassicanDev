import type { Currency, WishPriority, WishStatus } from "@nassican/db";
import { fieldProblems, parseNumber } from "@/lib/draft-fields";

/**
 * The wish list, the part that needs no database: what a wish must have to be
 * saved, and the arithmetic of saving towards it.
 *
 * The saved figure is never stored. It is the sum of the amounts set aside, so
 * «cuánto llevo» cannot drift from the rows that explain it.
 */

export type WishDraft = {
  id: string;
  title: string;
  url: string;
  note: string;
  priority: WishPriority;
  status: WishStatus;
  price: string;
  currency: Currency;
  targetDate: string;
  boughtAt: string;
  paid: string;
};

export const priorities: { value: WishPriority; label: string }[] = [
  { value: "high", label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "low", label: "Baja" },
];

export const priorityLabel = (p: WishPriority) => priorities.find((x) => x.value === p)?.label ?? p;

export const statusLabels: Record<WishStatus, string> = {
  wanted: "Lo quiero",
  bought: "Comprado",
  dropped: "Descartado",
};

export function emptyWish(): WishDraft {
  return {
    id: "",
    title: "",
    url: "",
    note: "",
    priority: "medium",
    status: "wanted",
    price: "",
    currency: "COP",
    targetDate: "",
    boughtAt: "",
    paid: "",
  };
}

export function wishProblems(draft: WishDraft): string[] {
  const problems: string[] = [];
  if (!draft.title.trim()) problems.push("Falta qué es lo que quieres.");
  problems.push(
    ...fieldProblems([
      { label: "El precio", value: draft.price, kind: "amount" },
      { label: "Lo que pagaste", value: draft.paid, kind: "amount" },
      { label: "para cuándo", value: draft.targetDate, kind: "date" },
      { label: "compra", value: draft.boughtAt, kind: "date" },
    ]),
  );
  if (draft.url.trim() && !/^https?:\/\//i.test(draft.url.trim())) {
    problems.push("El enlace tiene que empezar por http:// o https://.");
  }
  if ((draft.boughtAt.trim() || draft.paid.trim()) && draft.status !== "bought") {
    problems.push("Tiene datos de compra pero no está marcado como comprado.");
  }
  return problems;
}

const cents = (n: number) => Math.round(n * 100) / 100;

/** What has been set aside: the sum, withdrawals included. */
export function savedTotal(savings: { amount: number }[]): number {
  return cents(savings.reduce((n, s) => n + s.amount, 0));
}

/**
 * How much is still missing, never below zero. Null without a price: «falta»
 * needs something to fall short of.
 */
export function missing(price: number | null, saved: number): number | null {
  return price === null ? null : cents(Math.max(0, price - saved));
}

/** Saved over price, capped at 1 for the bar. Null without a price above zero. */
export function savedRatio(price: number | null, saved: number): number | null {
  if (price === null || price <= 0) return null;
  return Math.min(1, Math.max(0, saved / price));
}

/**
 * An amount to set aside, as typed. A leading minus takes money back out, and
 * the total may not go below zero: you cannot withdraw what was never saved.
 */
export function readSaving(
  raw: string,
  saved: number,
): { ok: true; amount: number } | { ok: false; message: string } {
  const amount = parseNumber(raw);
  if (amount === null || amount === 0) return { ok: false, message: "Escribe cuánto apartaste." };
  if (cents(saved + amount) < 0) {
    return { ok: false, message: "No puedes retirar más de lo que hay ahorrado." };
  }
  return { ok: true, amount: cents(amount) };
}

const dayNumber = (day: string) => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) / 86_400_000;

/**
 * The last day a partial date covers: «2026-12» runs to the 31st and «2027» to
 * the end of that year. A target is met any time inside what was written.
 */
function lastDay(date: string): string {
  const day = date.slice(0, 10);
  if (day.length === 10) return day;
  const year = +day.slice(0, 4);
  const month = day.length === 7 ? +day.slice(5, 7) : 12;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(days).padStart(2, "0")}`;
}

/** Past its target date. A month is late only once that month is over. */
export function isPastTarget(targetDate: string | null, today: string): boolean {
  return !!targetDate && lastDay(targetDate) < today;
}

/**
 * What to set aside each month to have it by the target date.
 *
 * Months are counted from the days left, rounded, and never fewer than one: a
 * target three weeks away is «this month», not a division by zero. Null when
 * there is no date, nothing missing, or the date already passed — a plan for
 * last month is not a plan.
 */
export function monthlyNeeded(
  stillMissing: number | null,
  targetDate: string | null,
  today: string,
): { amount: number; months: number } | null {
  if (!stillMissing || !targetDate || isPastTarget(targetDate, today)) return null;
  const days = dayNumber(lastDay(targetDate)) - dayNumber(today);
  const months = Math.max(1, Math.round(days / 30.44));
  return { amount: cents(stillMissing / months), months };
}

const priorityOrder: Record<WishPriority, number> = { high: 0, medium: 1, low: 2 };

/**
 * The order of the list: what matters most first, and within a priority the
 * one closest to being paid for — that is the next one you can actually buy.
 */
export function compareWishes(
  a: { priority: WishPriority; ratio: number | null; title: string },
  b: { priority: WishPriority; ratio: number | null; title: string },
): number {
  return (
    priorityOrder[a.priority] - priorityOrder[b.priority] ||
    (b.ratio ?? -1) - (a.ratio ?? -1) ||
    a.title.localeCompare(b.title)
  );
}

export type CurrencyTotal = { currency: Currency; cost: number; saved: number; missing: number };

/**
 * Cost, saved and missing per currency, over what is still wanted.
 *
 * Missing is summed per wish and not taken as cost minus saved: money saved
 * beyond one thing's price does not pay for another until it is moved there.
 */
export function totalsByCurrency(
  rows: { currency: Currency; price: number | null; saved: number }[],
): CurrencyTotal[] {
  const byCurrency = new Map<Currency, CurrencyTotal>();
  for (const row of rows) {
    const total = byCurrency.get(row.currency) ?? { currency: row.currency, cost: 0, saved: 0, missing: 0 };
    total.cost = cents(total.cost + (row.price ?? 0));
    total.saved = cents(total.saved + row.saved);
    total.missing = cents(total.missing + (missing(row.price, row.saved) ?? 0));
    byCurrency.set(row.currency, total);
  }
  const order: Currency[] = ["COP", "USD", "EUR"];
  return [...byCurrency.values()].sort((a, b) => order.indexOf(a.currency) - order.indexOf(b.currency));
}
