import type { GoalSource, GoalStatus } from "@nassican/db";
import { fieldProblems, isPartialDate } from "@/lib/draft-fields";

/**
 * Goals: the shape being edited, and how progress and deadlines read.
 *
 * The plan — «si… entonces…» — is the one required part besides the title. That
 * is the evidence the module rests on (implementation intentions: d = 0.65 over
 * 94 tests in 2006, confirmed over 642 in 2024), and it is larger in exactly
 * this conditional form, so the form asks for the two halves separately.
 */

export type GoalDraft = {
  id: string;
  title: string;
  why: string;
  planIf: string;
  planThen: string;
  deadline: string;
  target: string;
  unit: string;
  source: GoalSource | "";
  since: string;
};

export const sources: { value: GoalSource; label: string; unit: string }[] = [
  { value: "books_finished", label: "Libros terminados", unit: "libros" },
  { value: "games_finished", label: "Juegos terminados", unit: "juegos" },
  { value: "posts_published", label: "Artículos publicados", unit: "artículos" },
  { value: "tasks_done", label: "Pendientes completados", unit: "pendientes" },
];

export const sourceLabel = (s: GoalSource) => sources.find((x) => x.value === s)?.label ?? s;

export const statusLabels: Record<GoalStatus, string> = {
  active: "En curso",
  achieved: "Lograda",
  dropped: "Abandonada",
};

export function emptyGoal(today: string): GoalDraft {
  return {
    id: "",
    title: "",
    why: "",
    planIf: "",
    planThen: "",
    deadline: "",
    target: "",
    unit: "",
    source: "",
    since: today,
  };
}

export function goalProblems(draft: GoalDraft): string[] {
  const problems: string[] = [];
  if (!draft.title.trim()) problems.push("Falta la meta.");
  if (!draft.planIf.trim() || !draft.planThen.trim()) {
    problems.push("Falta el plan: «si [situación], entonces [acción]». Es lo que hace que una meta se cumpla.");
  }

  problems.push(
    ...fieldProblems([
      { label: "límite", value: draft.deadline, kind: "date" },
      { label: "inicio", value: draft.since, kind: "date" },
    ]),
  );

  if (draft.target.trim()) {
    const n = Number(draft.target.trim());
    if (!Number.isInteger(n) || n <= 0) problems.push("La cifra objetivo tiene que ser un número entero positivo.");
  }

  if (draft.source && !draft.since.trim()) {
    problems.push("Una meta que se cuenta sola necesita desde cuándo contar.");
  }

  return problems;
}

/** Progress against the target, or null when there is no number to reach. */
export function progressRatio(count: number, target: number | null): number | null {
  if (target === null || target <= 0) return null;
  return Math.min(1, count / target);
}

/**
 * Whether a partial finish date falls on or after `since`.
 *
 * Compared at the precision the finish date has: a book finished «2026» counts
 * towards a goal counting from «2026-03-01», because nothing says it was before
 * March. Excluding it would be inventing a precision the date never had — the
 * same reason these dates are text.
 */
export function finishedSince(finishedAt: string | null, since: string): boolean {
  if (!finishedAt || !isPartialDate(finishedAt)) return false;
  const date = finishedAt.slice(0, 10);
  return date >= since.slice(0, date.length);
}
