import type { BudgetScope } from "@nassican/db";

/**
 * The month's budget, the part that needs no database: how a line is going.
 *
 * What makes it a warning *before* the money is gone is the pace. Seventy per
 * cent spent on the 12th of a 30-day month is not «70 %», it is «ahead of the
 * month by thirty points», and at that rate the line closes over its limit.
 * That projection is the number the module exists for.
 */

export const scopeLabels: Record<BudgetScope, string> = {
  total: "Todo el mes",
  group: "Grupo de Wallet",
  category: "Categoría de Wallet",
};

export type Pace =
  /** Spent more than the limit already. */
  | "exceeded"
  /** At this rate the month closes over the limit. */
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
  /** How much of the month has gone, 0–1. */
  elapsed: number;
  /** What the month ends at if spending keeps this rate. */
  projected: number;
  pace: Pace;
};

/**
 * Where a line stands on a given day. The projection only counts once a few
 * days have passed: two days in, one dinner out projects to a month that is
 * not going to happen, and warning about it is how a budget learns to be
 * ignored.
 */
export const PROJECT_FROM_DAY = 5;

export function lineStatus(spent: number, limit: number, day: number, daysInMonth: number): LineStatus {
  const elapsed = Math.min(1, Math.max(0, day / daysInMonth));
  const projected = day > 0 ? (spent / day) * daysInMonth : spent;
  const ratio = limit > 0 ? spent / limit : spent > 0 ? Infinity : 0;
  const pace: Pace =
    spent <= 0 ? "idle" : spent > limit ? "exceeded" : day >= PROJECT_FROM_DAY && projected > limit ? "over" : "ok";
  return { spent, limit, ratio, elapsed, projected, pace };
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

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function budgetProblems(line: { scope: BudgetScope; key: string; limit: number | null }): string[] {
  const problems: string[] = [];
  if (line.scope !== "total" && !line.key.trim()) problems.push("Elige el grupo o la categoría.");
  if (line.limit === null || !(line.limit > 0)) problems.push("El límite tiene que ser mayor que cero.");
  return problems;
}
