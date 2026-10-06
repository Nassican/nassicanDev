/**
 * The month's budget, the part that needs no network: how a budget is going.
 *
 * Wallet computes what was spent; this adds the one reading Wallet does not
 * show — the pace. Seventy per cent spent on the 12th of a 30-day month is not
 * «70 %», it is thirty points ahead of the month, and at that rate the budget
 * closes over its limit. That projection is what turns a report into a
 * warning while there is still time to act on it.
 */

export type Pace =
  /** Spent more than the limit already. */
  | "exceeded"
  /** At this rate the period closes over the limit. */
  | "over"
  /** Within the limit and the rate. */
  | "ok"
  /** Nothing spent yet. */
  | "idle";

export type LineStatus = {
  spent: number;
  limit: number;
  /** spent / limit, unclamped: 1.3 is 30 % over. */
  ratio: number;
  /** How much of the period has gone, 0–1. */
  elapsed: number;
  /** What the period ends at if spending keeps this rate. */
  projected: number;
  pace: Pace;
};

/**
 * The projection only counts once a few days have passed: two days in, one
 * dinner out projects to a month that is not going to happen, and warning about
 * it is how a budget learns to be ignored.
 */
export const PROJECT_FROM_DAY = 5;

/** `day` is the day of the period (1 on its first day); `days` its length. */
export function lineStatus(spent: number, limit: number, day: number, days: number): LineStatus {
  const elapsed = Math.min(1, Math.max(0, day / days));
  const projected = day > 0 ? (spent / day) * days : spent;
  const ratio = limit > 0 ? spent / limit : spent > 0 ? Infinity : 0;
  const pace: Pace =
    spent <= 0 ? "idle" : spent > limit ? "exceeded" : day >= PROJECT_FROM_DAY && projected > limit ? "over" : "ok";
  return { spent, limit, ratio, elapsed, projected, pace };
}

const dayNumber = (day: string) => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) / 86_400_000;

/**
 * Where today falls in a Wallet period. Both ends are inclusive — Wallet sends
 * 2026-10-01 to 2026-10-31 for October — so the first day is day 1.
 */
export function periodPosition(start: string, end: string, today: string): { day: number; days: number } {
  const days = dayNumber(end) - dayNumber(start) + 1;
  const day = Math.min(days, Math.max(0, dayNumber(today) - dayNumber(start) + 1));
  return { day, days };
}

export function daysIn(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** "2026-10" → "octubre de 2026". Built by hand so no timezone moves the month. */
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export function monthName(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]} de ${y}`;
}

export const MAX_BUDGET_NAME = 80;

export function newBudgetProblems(input: { name: string; limit: number | null; categoryIds: string[] }): string[] {
  const problems: string[] = [];
  if (!input.name.trim()) problems.push("El presupuesto necesita un nombre.");
  if (input.name.trim().length > MAX_BUDGET_NAME) problems.push(`El nombre pasa de ${MAX_BUDGET_NAME} caracteres.`);
  if (input.limit === null || !(input.limit > 0)) problems.push("El límite tiene que ser mayor que cero.");
  return problems;
}
