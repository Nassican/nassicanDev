import { addDays } from "@/lib/journal-draft";

/**
 * Habits: which days are due, how long the streak is, how far along the habit is.
 *
 * Pure and shared with the client. The two numbers here are where a habit app
 * usually lies, so both follow the study the module rests on (Lally et al.,
 * 2010): automaticity took **66 days on average** — anywhere from 18 to 254 —
 * and **missing a single day did not affect** forming the habit.
 */

/** The average days to automaticity in Lally et al. — not the 21 of the myth. */
export const FORMATION_DAYS = 66;

export const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
export const WEEKDAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

export const dayPresets = [
  { value: "1234567", label: "Todos los días" },
  { value: "12345", label: "Entre semana" },
  { value: "67", label: "Fines de semana" },
];

/** Monday is 0. */
export function weekdayIndex(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function isDue(days: string, date: string): boolean {
  return days.includes(String(weekdayIndex(date) + 1));
}

/** «Entre semana», «lunes, miércoles y viernes». */
export function describeDays(days: string): string {
  const preset = dayPresets.find((p) => p.value === days);
  if (preset) return preset.label;
  const names = [...days].map((d) => WEEKDAY_NAMES[Number(d) - 1]).filter(Boolean);
  return names.length <= 1 ? (names[0] ?? "ningún día") : `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
}

export type Streak = {
  /** Due days done in the current run. */
  days: number;
  /**
   * The last due day before today was missed. One more and the run ends — said
   * out loud, because a streak that is about to break is when it can be saved.
   */
  atRisk: boolean;
};

/**
 * The current run of due days done, forgiving one missed day.
 *
 * It breaks only on **two consecutive** missed due days. One miss is what the
 * study found harmless, and a streak that resets on it punishes exactly the slip
 * that does no damage — which is how streaks make people quit.
 *
 * Today does not count against it until it is over: an unticked today is a day
 * still in progress, not a miss.
 */
export function streak(checked: ReadonlySet<string>, days: string, today: string, limit = 400): Streak {
  let count = 0;
  let misses = 0;
  let atRisk = false;
  let first = true;

  for (let i = 0; i < limit; i++) {
    const date = addDays(today, -i);
    if (!isDue(days, date)) continue;

    if (checked.has(date)) {
      count++;
      misses = 0;
      first = false;
      continue;
    }

    if (i === 0) continue; // today, still in progress

    misses++;
    if (first) atRisk = true;
    first = false;
    if (misses >= 2) break;
  }

  // At risk only while there is a run left to save. The misses that end the
  // loop are where the run began, not a threat to it.
  return { days: count, atRisk: atRisk && count > 0 };
}

/** How far along a habit is, against the average — with its real spread said next to it. */
export function formation(checks: number): { days: number; ratio: number } {
  return { days: checks, ratio: Math.min(1, checks / FORMATION_DAYS) };
}

/** The last `n` days, oldest first, ending today. */
export function lastDays(today: string, n = 7): string[] {
  return Array.from({ length: n }, (_, i) => addDays(today, i - n + 1));
}

export type HabitDraft = { id: string; title: string; cue: string; days: string };

export const emptyHabit = (): HabitDraft => ({ id: "", title: "", cue: "", days: "1234567" });

export function habitProblems(draft: HabitDraft): string[] {
  const problems: string[] = [];
  if (!draft.title.trim()) problems.push("Falta el hábito.");
  if (!draft.cue.trim()) problems.push("Falta la señal: un hábito se forma alrededor de un momento concreto.");
  if (!/^[1-7]{1,7}$/.test(draft.days) || new Set(draft.days).size !== draft.days.length) {
    problems.push("Elige al menos un día de la semana.");
  }
  return problems;
}
