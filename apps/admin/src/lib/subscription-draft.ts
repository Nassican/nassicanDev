import type { Currency, SubscriptionStatus } from "@nassican/db";
import { fieldProblems, isPartialDate, parseNumber, splitDateTime } from "@/lib/draft-fields";

/**
 * The shape a subscription has while it is being edited, and the arithmetic of
 * renewals.
 *
 * Pure and imported by the client, like `game-draft.ts`: the list works out
 * «vence en 3 días» and which months are owed without a round trip, and the
 * tests can pin the calendar edge cases without a database.
 */

export type SubscriptionDraft = {
  id: string;
  name: string;
  category: string;
  price: string;
  currency: Currency;
  intervalMonths: string;
  status: SubscriptionStatus;
  nextRenewal: string;
  startedAt: string;
  paymentMethod: string;
  url: string;
  note: string;
};

export const cycles = [
  { months: 1, label: "Mensual", short: "al mes" },
  { months: 3, label: "Trimestral", short: "cada 3 meses" },
  { months: 6, label: "Semestral", short: "cada 6 meses" },
  { months: 12, label: "Anual", short: "al año" },
] as const;

export const cycleLabel = (months: number): string =>
  cycles.find((c) => c.months === months)?.label ?? `Cada ${months} meses`;

export const cycleShort = (months: number): string =>
  cycles.find((c) => c.months === months)?.short ?? `cada ${months} meses`;

export const statuses: { value: SubscriptionStatus; label: string }[] = [
  { value: "active", label: "Activa" },
  { value: "paused", label: "En pausa" },
  { value: "cancelled", label: "Cancelada" },
];

export const statusLabel = (s: SubscriptionStatus): string =>
  statuses.find((x) => x.value === s)?.label ?? s;

export const currencies: Currency[] = ["COP", "USD", "EUR"];

export function emptySubscription(): SubscriptionDraft {
  return {
    id: "",
    name: "",
    category: "",
    price: "",
    currency: "COP",
    intervalMonths: "1",
    status: "active",
    nextRenewal: "",
    startedAt: "",
    paymentMethod: "",
    url: "",
    note: "",
  };
}

export function subscriptionProblems(draft: SubscriptionDraft): string[] {
  const problems: string[] = [];

  if (!draft.name.trim()) problems.push("Falta el nombre.");

  const price = parseNumber(draft.price);
  if (!draft.price.trim()) problems.push("Falta el precio.");
  else if (price === null || price < 0) problems.push("El precio tiene que ser un número positivo.");

  const months = Number(draft.intervalMonths);
  if (!Number.isInteger(months) || months < 1 || months > 24) {
    problems.push("El ciclo tiene que ser de 1 a 24 meses.");
  }

  problems.push(
    ...fieldProblems([
      { label: "próxima renovación", value: draft.nextRenewal, kind: "date" },
      { label: "inicio", value: draft.startedAt, kind: "date" },
    ]),
  );

  if (draft.url.trim() && !/^https?:\/\//i.test(draft.url.trim())) {
    problems.push("El enlace tiene que empezar por http:// o https://.");
  }

  return problems;
}

/** What it costs per month, so a yearly plan and a monthly one can be added. */
export function monthlyCost(price: number, intervalMonths: number): number {
  return intervalMonths > 0 ? price / intervalMonths : price;
}

/**
 * A partial date moved forward by whole months, keeping its precision.
 *
 * «2026-11» stays a month and «2026-11-03T09:00» keeps its day and hour. A day
 * that the target month lacks is clamped to its last: the 31st of January plus
 * one month is the 28th or 29th of February, which is what a card does.
 */
export function addMonths(partial: string, months: number): string {
  const { date, time } = splitDateTime(partial);
  const [y, m, d] = date.split("-").map(Number);

  if (m === undefined || Number.isNaN(m)) {
    // A year alone moves by whole years; anything shorter has no month to land on.
    return String(y + Math.max(1, Math.round(months / 12)));
  }

  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  const mm = String(month).padStart(2, "0");

  if (d === undefined || Number.isNaN(d)) return `${year}-${mm}`;

  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = String(Math.min(d, last)).padStart(2, "0");
  return `${year}-${mm}-${day}${time ? `T${time}` : ""}`;
}

/** The month a date falls in, «2026-09», or null when it names only a year. */
export function periodOf(partial: string | null | undefined): string | null {
  if (!partial || !isPartialDate(partial)) return null;
  const match = /^(\d{4})-(\d{2})/.exec(partial);
  return match ? `${match[1]}-${match[2]}` : null;
}

export type RenewalState =
  | { kind: "overdue"; days: number | null }
  | { kind: "soon"; days: number | null }
  | { kind: "later"; days: number | null }
  | { kind: "unknown" };

/** Days from `today` to a full day, both "YYYY-MM-DD". */
function daysBetween(today: string, day: string): number {
  const at = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((at(day) - at(today)) / 86_400_000);
}

/**
 * Where a renewal stands from `today`, the local calendar day.
 *
 * A renewal written as a month is judged by month: due this month is «soon»,
 * a past month is overdue. Inventing the first of the month would call it
 * overdue on the second when nothing about it was known.
 */
export function renewalState(nextRenewal: string | null | undefined, today: string, soonDays = 7): RenewalState {
  if (!nextRenewal || !isPartialDate(nextRenewal)) return { kind: "unknown" };
  const { date } = splitDateTime(nextRenewal);

  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const days = daysBetween(today, date);
    if (days < 0) return { kind: "overdue", days };
    if (days <= soonDays) return { kind: "soon", days };
    return { kind: "later", days };
  }

  const period = periodOf(date);
  if (!period) return { kind: "unknown" };
  const now = today.slice(0, 7);
  if (period < now) return { kind: "overdue", days: null };
  if (period === now) return { kind: "soon", days: null };
  return { kind: "later", days: null };
}

/**
 * The months of `year` when a charge is expected, for the payment grid.
 *
 * Counted from an anchor — the next renewal, or the start — every
 * `intervalMonths`, and never before the start: a plan begun in June owes
 * nothing for March. Without an anchor every month is a candidate for a monthly
 * plan, and none can be predicted for a longer one.
 */
export function expectedPeriods(
  year: number,
  intervalMonths: number,
  anchor: string | null,
  startedAt: string | null,
): Set<string> {
  const result = new Set<string>();
  const start = periodOf(startedAt);
  const anchorPeriod = periodOf(anchor) ?? start;

  for (let month = 1; month <= 12; month++) {
    const period = `${year}-${String(month).padStart(2, "0")}`;
    if (start && period < start) continue;

    if (!anchorPeriod) {
      if (intervalMonths === 1) result.add(period);
      continue;
    }

    const [ay, am] = anchorPeriod.split("-").map(Number);
    const offset = year * 12 + (month - 1) - (ay * 12 + (am - 1));
    if (((offset % intervalMonths) + intervalMonths) % intervalMonths === 0) result.add(period);
  }

  return result;
}
