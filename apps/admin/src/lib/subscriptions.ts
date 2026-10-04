import "server-only";

import { db, type Currency, type SubscriptionStatus } from "@nassican/db";
import { calendarDate, calendarTime } from "@nassican/shared";
import { blankToNull, parseNumber } from "@/lib/draft-fields";
import { getTimezone } from "@/lib/site-config";
import {
  addMonths,
  monthlyCost,
  periodOf,
  renewalState,
  type SubscriptionDraft,
} from "@/lib/subscription-draft";
import { getTrm, type Trm } from "@/lib/trm";

/**
 * Subscriptions, entered by hand, and the months marked as paid.
 *
 * Everything the page shows is a fold over two small tables, read in one
 * batch. Money leaves here as numbers: a `Decimal` does not survive the trip to
 * a client component.
 */

export type PaymentRow = {
  id: string;
  period: string;
  amount: number | null;
  currency: Currency | null;
  paidAt: string | null;
  note: string | null;
};

export type SubscriptionRow = {
  id: string;
  name: string;
  category: string | null;
  price: number;
  currency: Currency;
  intervalMonths: number;
  status: SubscriptionStatus;
  nextRenewal: string | null;
  startedAt: string | null;
  paymentMethod: string | null;
  url: string | null;
  note: string | null;
  payments: PaymentRow[];
};

export type SubscriptionsSummary = {
  subscriptions: SubscriptionRow[];
  /** The local calendar day, so the client judges «vence en 3 días» the same way. */
  today: string;
  trm: Trm | null;
  /** Active plans only, per month, per currency. */
  monthly: Partial<Record<Currency, number>>;
  /**
   * The same, in pesos — null when a currency has no rate (EUR, or USD with the
   * TRM unreachable). A partial sum labelled as a total is the one figure this
   * page must not show.
   */
  monthlyCop: number | null;
  /** Marked as paid this calendar year, per currency, at what was charged. */
  paidThisYear: Partial<Record<Currency, number>>;
  counts: Record<SubscriptionStatus, number>;
  categories: string[];
  paymentMethods: string[];
};

export function toCop(amount: number, currency: Currency, trm: Trm | null): number | null {
  if (currency === "COP") return amount;
  if (currency === "USD" && trm) return amount * trm.value;
  return null;
}

export async function getSubscriptions(): Promise<SubscriptionsSummary> {
  const [rows, timezone, trm] = await Promise.all([
    db.subscription.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
      include: { payments: { orderBy: { period: "desc" } } },
    }),
    getTimezone(),
    getTrm(),
  ]);

  const today = calendarDate(timezone);
  const year = today.slice(0, 4);

  const subscriptions: SubscriptionRow[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    price: Number(row.price),
    currency: row.currency,
    intervalMonths: row.intervalMonths,
    status: row.status,
    nextRenewal: row.nextRenewal,
    startedAt: row.startedAt,
    paymentMethod: row.paymentMethod,
    url: row.url,
    note: row.note,
    payments: row.payments.map((p) => ({
      id: p.id,
      period: p.period,
      amount: p.amount === null ? null : Number(p.amount),
      currency: p.currency,
      paidAt: p.paidAt,
      note: p.note,
    })),
  }));

  const monthly: Partial<Record<Currency, number>> = {};
  let monthlyCop: number | null = 0;
  const paidThisYear: Partial<Record<Currency, number>> = {};
  const counts: Record<SubscriptionStatus, number> = { active: 0, paused: 0, cancelled: 0 };

  for (const sub of subscriptions) {
    counts[sub.status] += 1;

    if (sub.status === "active") {
      const cost = monthlyCost(sub.price, sub.intervalMonths);
      monthly[sub.currency] = (monthly[sub.currency] ?? 0) + cost;
      const cop = toCop(cost, sub.currency, trm);
      monthlyCop = monthlyCop === null || cop === null ? null : monthlyCop + cop;
    }

    for (const p of sub.payments) {
      if (!p.period.startsWith(year)) continue;
      // A month ticked without an amount was paid at the list price.
      const currency = p.currency ?? sub.currency;
      paidThisYear[currency] = (paidThisYear[currency] ?? 0) + (p.amount ?? sub.price);
    }
  }

  const distinct = (values: (string | null)[]) =>
    [...new Set(values.filter((v): v is string => !!v?.trim()))].sort((a, b) => a.localeCompare(b, "es"));

  return {
    subscriptions,
    today,
    trm,
    monthly,
    monthlyCop: counts.active === 0 ? 0 : monthlyCop,
    paidThisYear,
    counts,
    categories: distinct(subscriptions.map((s) => s.category)),
    paymentMethods: distinct(subscriptions.map((s) => s.paymentMethod)),
  };
}

function toRow(draft: SubscriptionDraft) {
  return {
    name: draft.name.trim(),
    category: blankToNull(draft.category),
    price: parseNumber(draft.price) ?? 0,
    currency: draft.currency,
    intervalMonths: Number(draft.intervalMonths),
    status: draft.status,
    nextRenewal: blankToNull(draft.nextRenewal),
    startedAt: blankToNull(draft.startedAt),
    paymentMethod: blankToNull(draft.paymentMethod),
    url: blankToNull(draft.url),
    note: blankToNull(draft.note),
  };
}

export async function createSubscription(draft: SubscriptionDraft): Promise<string> {
  const row = await db.subscription.create({ data: toRow(draft), select: { id: true } });
  return row.id;
}

export async function updateSubscription(draft: SubscriptionDraft): Promise<void> {
  await db.subscription.update({ where: { id: draft.id }, data: toRow(draft) });
}

export async function setSubscriptionStatus(id: string, status: SubscriptionStatus): Promise<string> {
  const row = await db.subscription.update({ where: { id }, data: { status }, select: { name: true } });
  return row.name;
}

/**
 * «Pagado» from the list: marks the period that was due and moves the renewal
 * one cycle on.
 *
 * The period is the renewal's month when there is one — a charge for
 * September made on the 31st of August is September's — and otherwise this
 * month. The renewal only moves when the payment was for it, so ticking an old
 * month never pushes the next date into the future by accident.
 */
export async function markPaid(id: string): Promise<{ name: string; period: string; next: string | null }> {
  const [sub, timezone] = await Promise.all([
    db.subscription.findUniqueOrThrow({ where: { id } }),
    getTimezone(),
  ]);

  const today = calendarDate(timezone);
  const period = periodOf(sub.nextRenewal) ?? today.slice(0, 7);
  const paidAt = `${today}T${calendarTime(timezone)}`;

  const advances = sub.nextRenewal !== null && periodOf(sub.nextRenewal) === period;
  const next = advances && sub.nextRenewal ? addMonths(sub.nextRenewal, sub.intervalMonths) : sub.nextRenewal;

  await db.$transaction([
    db.subscriptionPayment.upsert({
      where: { subscriptionId_period: { subscriptionId: id, period } },
      create: { subscriptionId: id, period, amount: sub.price, currency: sub.currency, paidAt },
      update: { paidAt, amount: sub.price, currency: sub.currency },
    }),
    db.subscription.update({ where: { id }, data: { nextRenewal: next } }),
  ]);

  return { name: sub.name, period, next };
}

/**
 * A month in the grid, ticked or unticked.
 *
 * Ticking records the list price with no date: a month marked months later is
 * a fact about the month, and an invented day would be a fact about nothing.
 * The amount and the day can be filled in afterwards.
 */
export async function togglePeriod(id: string, period: string): Promise<{ name: string; paid: boolean }> {
  const sub = await db.subscription.findUniqueOrThrow({
    where: { id },
    select: { name: true, price: true, currency: true },
  });

  const existing = await db.subscriptionPayment.findUnique({
    where: { subscriptionId_period: { subscriptionId: id, period } },
    select: { id: true },
  });

  if (existing) {
    await db.subscriptionPayment.delete({ where: { id: existing.id } });
    return { name: sub.name, paid: false };
  }

  await db.subscriptionPayment.create({
    data: { subscriptionId: id, period, amount: sub.price, currency: sub.currency },
  });
  return { name: sub.name, paid: true };
}

export async function updatePayment(
  paymentId: string,
  fields: { amount: string; paidAt: string; note: string },
): Promise<string> {
  const payment = await db.subscriptionPayment.update({
    where: { id: paymentId },
    data: {
      amount: parseNumber(fields.amount),
      paidAt: blankToNull(fields.paidAt),
      note: blankToNull(fields.note),
    },
    select: { period: true, subscription: { select: { name: true } } },
  });
  return `${payment.subscription.name} (${payment.period})`;
}

/** For the dashboard and Personal: what needs looking at. */
export async function subscriptionAlerts(): Promise<{
  overdue: { name: string; nextRenewal: string }[];
  soon: { name: string; nextRenewal: string; days: number | null }[];
}> {
  const [rows, timezone] = await Promise.all([
    db.subscription.findMany({
      where: { status: "active", nextRenewal: { not: null } },
      select: { name: true, nextRenewal: true },
    }),
    getTimezone(),
  ]);

  const today = calendarDate(timezone);
  const overdue: { name: string; nextRenewal: string }[] = [];
  const soon: { name: string; nextRenewal: string; days: number | null }[] = [];

  for (const row of rows) {
    const state = renewalState(row.nextRenewal, today);
    if (state.kind === "overdue") overdue.push({ name: row.name, nextRenewal: row.nextRenewal! });
    if (state.kind === "soon") soon.push({ name: row.name, nextRenewal: row.nextRenewal!, days: state.days });
  }

  soon.sort((a, b) => (a.nextRenewal < b.nextRenewal ? -1 : 1));
  return { overdue, soon };
}
