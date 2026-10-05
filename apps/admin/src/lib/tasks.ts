import "server-only";

import { db, type TaskStatus } from "@nassican/db";
import { calendarDate } from "@nassican/shared";
import { blankToNull } from "@/lib/draft-fields";
import { addDays, zonedMidnight } from "@/lib/journal-draft";
import { getTimezone } from "@/lib/site-config";
import { groupOf, type TaskRow } from "@/lib/task-draft";

/**
 * Tasks, read and written.
 *
 * Open tasks are all read every time — a personal list is dozens, not
 * thousands — and closed ones only from the last month, because what was done
 * in March is the journal's business and not the list's.
 */

const CLOSED_DAYS = 30;

export type TasksSummary = {
  open: TaskRow[];
  closed: TaskRow[];
  today: string;
  areas: string[];
  counts: { inbox: number; overdue: number; today: number; doneThisWeek: number };
};

function toRow(t: {
  id: string;
  title: string;
  note: string | null;
  area: string | null;
  status: TaskStatus;
  plannedFor: string | null;
  closedAt: Date | null;
  createdAt: Date;
}): TaskRow {
  return {
    id: t.id,
    title: t.title,
    note: t.note,
    area: t.area,
    status: t.status,
    plannedFor: t.plannedFor,
    closedAt: t.closedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
  };
}

export async function getTasks(): Promise<TasksSummary> {
  const timezone = await getTimezone();
  const today = calendarDate(timezone);
  const since = new Date(Date.now() - CLOSED_DAYS * 86_400_000);

  const [open, closed] = await Promise.all([
    db.task.findMany({ where: { status: { in: ["inbox", "planned"] } } }),
    db.task.findMany({
      where: { status: { in: ["done", "dropped"] }, closedAt: { gte: since } },
      orderBy: { closedAt: "desc" },
    }),
  ]);

  const rows = open.map(toRow);
  // Monday of this week at local midnight: «hechos esta semana» is a local idea.
  const weekday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
  const weekStart = zonedMidnight(addDays(today, -weekday), timezone);

  return {
    open: rows,
    closed: closed.map(toRow),
    today,
    areas: [...new Set([...open, ...closed].map((t) => t.area).filter((a): a is string => !!a))].sort((a, b) =>
      a.localeCompare(b, "es"),
    ),
    counts: {
      inbox: rows.filter((t) => groupOf(t, today) === "inbox").length,
      overdue: rows.filter((t) => groupOf(t, today) === "overdue").length,
      today: rows.filter((t) => groupOf(t, today) === "today").length,
      doneThisWeek: closed.filter((t) => t.status === "done" && t.closedAt && t.closedAt >= weekStart).length,
    },
  };
}

export async function createTask(fields: {
  title: string;
  plannedFor?: string | null;
  area?: string | null;
  note?: string | null;
}): Promise<{ id: string; title: string }> {
  const plannedFor = fields.plannedFor ? fields.plannedFor.trim() : null;
  return db.task.create({
    data: {
      title: fields.title.trim(),
      plannedFor,
      status: plannedFor ? "planned" : "inbox",
      area: fields.area ? blankToNull(fields.area) : null,
      note: fields.note ? blankToNull(fields.note) : null,
    },
    select: { id: true, title: true },
  });
}

export async function updateTask(
  id: string,
  fields: { title: string; plannedFor: string; area: string; note: string },
): Promise<{ title: string }> {
  const plannedFor = blankToNull(fields.plannedFor);
  const current = await db.task.findUniqueOrThrow({ where: { id }, select: { status: true } });
  return db.task.update({
    where: { id },
    data: {
      title: fields.title.trim(),
      plannedFor,
      area: blankToNull(fields.area),
      note: blankToNull(fields.note),
      // Editing never reopens or closes; it only moves an open task between
      // the inbox and the plan, by whether it now has a day.
      status: current.status === "done" || current.status === "dropped" ? current.status : plannedFor ? "planned" : "inbox",
    },
    select: { title: true },
  });
}

/** Gives an open task a day, or takes it back to the inbox with null. */
export async function planTask(id: string, plannedFor: string | null): Promise<{ title: string }> {
  return db.task.update({
    where: { id },
    data: { plannedFor, status: plannedFor ? "planned" : "inbox" },
    select: { title: true },
  });
}

export async function closeTask(id: string, status: "done" | "dropped"): Promise<{ title: string }> {
  return db.task.update({ where: { id }, data: { status, closedAt: new Date() }, select: { title: true } });
}

/** Back to open, keeping its day if it had one. */
export async function reopenTask(id: string): Promise<{ title: string }> {
  const task = await db.task.findUniqueOrThrow({ where: { id }, select: { plannedFor: true } });
  return db.task.update({
    where: { id },
    data: { status: task.plannedFor ? "planned" : "inbox", closedAt: null },
    select: { title: true },
  });
}

/** For the dashboard: what is late and what is for today. */
export async function taskAlerts(): Promise<{ overdue: string[]; today: string[] }> {
  const [timezone, open] = await Promise.all([
    getTimezone(),
    db.task.findMany({
      where: { status: "planned" },
      select: { title: true, plannedFor: true, status: true },
      orderBy: { plannedFor: "asc" },
    }),
  ]);
  const today = calendarDate(timezone);
  return {
    overdue: open.filter((t) => groupOf(t, today) === "overdue").map((t) => t.title),
    today: open.filter((t) => groupOf(t, today) === "today").map((t) => t.title),
  };
}
