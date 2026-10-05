import type { TaskStatus } from "@nassican/db";
import { isFullDay, isPartialDate, splitDateTime } from "@/lib/draft-fields";
import { addDays, dayLabel, mondayOf } from "@/lib/journal-draft";

/**
 * Tasks: what a list of them means on a given day.
 *
 * Pure and imported by the client, so the page groups and labels without a
 * round trip and the tests can pin the calendar edges: a Sunday whose
 * «tomorrow» is next week, a task planned for an hour that already passed.
 */

export type TaskRow = {
  id: string;
  title: string;
  note: string | null;
  area: string | null;
  status: TaskStatus;
  plannedFor: string | null;
  /** ISO instant, when it was done or dropped. */
  closedAt: string | null;
  createdAt: string;
};

export type TaskGroupKey = "overdue" | "today" | "tomorrow" | "week" | "later" | "inbox";

export const groupLabels: Record<TaskGroupKey, string> = {
  overdue: "Atrasados",
  today: "Hoy",
  tomorrow: "Mañana",
  week: "Esta semana",
  later: "Más adelante",
  inbox: "Bandeja",
};

const ORDER: TaskGroupKey[] = ["overdue", "today", "tomorrow", "week", "later", "inbox"];

/** Where an open task belongs from `today`, or null for a closed one. */
export function groupOf(task: Pick<TaskRow, "status" | "plannedFor">, today: string): TaskGroupKey | null {
  if (task.status === "done" || task.status === "dropped") return null;
  if (!task.plannedFor) return "inbox";

  const day = splitDateTime(task.plannedFor).date;
  if (day < today) return "overdue";
  if (day === today) return "today";
  if (day === addDays(today, 1)) return "tomorrow";
  // Up to Sunday: «esta semana» means the calendar week, not the next 7 days.
  if (day <= addDays(mondayOf(today), 6)) return "week";
  return "later";
}

export function groupTasks(tasks: TaskRow[], today: string): { key: TaskGroupKey; label: string; tasks: TaskRow[] }[] {
  const groups = new Map<TaskGroupKey, TaskRow[]>(ORDER.map((k) => [k, []]));
  for (const task of tasks) {
    const key = groupOf(task, today);
    if (key) groups.get(key)!.push(task);
  }

  return ORDER.map((key) => ({
    key,
    label: groupLabels[key],
    tasks: groups.get(key)!.sort((a, b) =>
      // The inbox reads newest first — what you just captured is on top.
      key === "inbox"
        ? b.createdAt.localeCompare(a.createdAt)
        : (a.plannedFor ?? "").localeCompare(b.plannedFor ?? "") || a.createdAt.localeCompare(b.createdAt),
    ),
  })).filter((g) => g.tasks.length > 0);
}

/** The three days a plan is usually for, so most planning is one tap. */
export function quickDays(today: string): { label: string; date: string }[] {
  const nextMonday = addDays(mondayOf(today), 7);
  const days = [
    { label: "Hoy", date: today },
    { label: "Mañana", date: addDays(today, 1) },
  ];
  // On a Sunday, «mañana» already is next Monday; a second chip would repeat it.
  if (nextMonday !== addDays(today, 1)) days.push({ label: "Próximo lunes", date: nextMonday });
  return days;
}

/** «hoy», «mañana», «ayer», «hace 3 días», «lun 6 oct», with the hour when there is one. */
export function relativeDay(plannedFor: string | null, today: string): string {
  if (!plannedFor) return "";
  const { date, time } = splitDateTime(plannedFor);
  const hour = time ? `, ${time}` : "";

  if (date === today) return `hoy${hour}`;
  if (date === addDays(today, 1)) return `mañana${hour}`;
  if (date === addDays(today, -1)) return `ayer${hour}`;

  const days = Math.round((Date.parse(today) - Date.parse(date)) / 86_400_000);
  if (days > 1 && days <= 30) return `hace ${days} días`;
  return `${dayLabel(date)}${hour}`;
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * What the palette's «+» captures: the text, and a day when it ends in «hoy»
 * or «mañana». «+ pagar la luz mañana» is planned in the same keystroke, which
 * is the whole point of capturing — the plan is what clears the mind.
 */
export function parseCapture(raw: string, today: string): { title: string; plannedFor: string | null } {
  let title = raw.trim().replace(/^\+\s*/, "").trim();
  let plannedFor: string | null = null;

  const words = title.split(/\s+/);
  const last = fold(words.at(-1) ?? "");
  if (words.length > 1 && (last === "hoy" || last === "manana")) {
    plannedFor = last === "hoy" ? today : addDays(today, 1);
    title = words.slice(0, -1).join(" ");
  }

  return { title, plannedFor };
}

export const MAX_TITLE = 300;

export function taskProblems(fields: { title: string; plannedFor: string }): string[] {
  const problems: string[] = [];
  const title = fields.title.trim();
  if (!title) problems.push("Falta qué hay que hacer.");
  if (title.length > MAX_TITLE) problems.push(`El pendiente pasa de ${MAX_TITLE} caracteres; el detalle va en la nota.`);

  const planned = fields.plannedFor.trim();
  // A plan is a day: «2026-10» is a month you might do it in, not a plan.
  if (planned && (!isPartialDate(planned) || !isFullDay(splitDateTime(planned).date))) {
    problems.push("Elige un día concreto para planificarlo.");
  }
  return problems;
}
