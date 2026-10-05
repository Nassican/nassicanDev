/**
 * Focus blocks, the part that needs no database: formats, phases, the clock.
 *
 * Pure, so the page, the header chip and the server all read a block the same
 * way, and the tests can move the clock without waiting for it.
 */

export type FocusFormat = { key: string; work: number; rest: number; label: string };

/**
 * 25/5 is the classic; 50/10 suits work that takes ten minutes to get into.
 * Biwer and colleagues found fixed breaks of this kind gave better mood and the
 * same output in less time than breaks taken at will — not more output, so the
 * module promises neither.
 */
export const focusFormats: FocusFormat[] = [
  { key: "25", work: 25, rest: 5, label: "25 / 5" },
  { key: "50", work: 50, rest: 10, label: "50 / 10" },
];

export function formatFor(key: string): FocusFormat {
  return focusFormats.find((f) => f.key === key) ?? focusFormats[0];
}

/** A block as the client sees it: instants as ISO strings, so it survives the wire. */
export type FocusBlockView = {
  id: string;
  label: string;
  taskId: string | null;
  plannedMinutes: number;
  breakMinutes: number;
  startedAt: string;
  endedAt: string | null;
  returnNote: string | null;
};

/** The running block, and the last closed one for its break. */
export type FocusNow = { running: FocusBlockView | null; last: FocusBlockView | null };

export type FocusPhase =
  | { kind: "idle" }
  /** Counting down. */
  | { kind: "work"; block: FocusBlockView; remainingMs: number }
  /** Time is up and the block is still open: waiting for «dónde lo dejé». */
  | { kind: "over"; block: FocusBlockView }
  /** A finished block's break, counting down from when it was closed. */
  | { kind: "break"; block: FocusBlockView; remainingMs: number };

const MINUTE = 60_000;

export function plannedEnd(block: Pick<FocusBlockView, "startedAt" | "plannedMinutes">): number {
  return Date.parse(block.startedAt) + block.plannedMinutes * MINUTE;
}

/** True when the block ran its whole length — cut short, it earns no break. */
export function completed(block: Pick<FocusBlockView, "startedAt" | "endedAt" | "plannedMinutes">): boolean {
  return block.endedAt !== null && Date.parse(block.endedAt) >= plannedEnd(block);
}

/**
 * Where things stand at `now`, from the running block or, failing that, the
 * last one closed.
 *
 * The break runs from the end of the block. A block is never closed later than
 * its planned end, so writing «dónde lo dejé» two minutes after the alarm leaves
 * three minutes of rest, and coming back an hour later leaves none — it was
 * taken.
 */
export function focusPhase(running: FocusBlockView | null, last: FocusBlockView | null, now: number): FocusPhase {
  if (running) {
    const remainingMs = plannedEnd(running) - now;
    return remainingMs > 0 ? { kind: "work", block: running, remainingMs } : { kind: "over", block: running };
  }
  if (last && last.endedAt && completed(last)) {
    const remainingMs = Date.parse(last.endedAt) + last.breakMinutes * MINUTE - now;
    if (remainingMs > 0) return { kind: "break", block: last, remainingMs };
  }
  return { kind: "idle" };
}

/**
 * When a block closes. Never after its planned end: a block left running over
 * lunch is a 25-minute block, not a three-hour one, and «horas de foco» would
 * otherwise count lunch.
 */
export function closingTime(block: Pick<FocusBlockView, "startedAt" | "plannedMinutes">, now: number): number {
  return Math.min(now, plannedEnd(block));
}

export function workedMinutes(block: Pick<FocusBlockView, "startedAt" | "endedAt">): number {
  if (!block.endedAt) return 0;
  return Math.max(0, Math.round((Date.parse(block.endedAt) - Date.parse(block.startedAt)) / MINUTE));
}

/** "24:59". Rounds up, so the clock shows 0:00 only when the time is really up. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** "25 min", "1 h", "2 h 05 min". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")} min`;
}

export const MAX_LABEL = 200;
export const MAX_RETURN_NOTE = 500;

export function focusProblems(fields: { label: string; taskId: string | null }): string[] {
  const problems: string[] = [];
  if (!fields.taskId && !fields.label.trim()) problems.push("Di en qué vas a trabajar o elige un pendiente.");
  if (fields.label.trim().length > MAX_LABEL) problems.push(`El nombre pasa de ${MAX_LABEL} caracteres.`);
  return problems;
}

/** Folded for matching a free-text label to an earlier one: «Informe» and «informe ». */
export function labelKey(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
