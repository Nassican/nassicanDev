import "server-only";

import { db } from "@nassican/db";
import { calendarDate, calendarTime } from "@nassican/shared";
import { blankToNull } from "@/lib/draft-fields";
import {
  closingTime,
  formatFor,
  labelKey,
  workedMinutes,
  type FocusBlockView,
  type FocusNow,
} from "@/lib/focus-draft";
import { addDays, mondayOf, zonedMidnight } from "@/lib/journal-draft";
import { getTimezone } from "@/lib/site-config";
import { groupOf } from "@/lib/task-draft";

/**
 * Focus blocks, read and written.
 *
 * The running block lives in the database and not in the browser: a reload, a
 * second tab or the phone all see the same clock, because the clock is one
 * instant — `startedAt` — and everything else is arithmetic on it.
 */

type Row = {
  id: string;
  label: string;
  taskId: string | null;
  plannedMinutes: number;
  breakMinutes: number;
  startedAt: Date;
  endedAt: Date | null;
  returnNote: string | null;
};

function view(row: Row): FocusBlockView {
  return {
    id: row.id,
    label: row.label,
    taskId: row.taskId,
    plannedMinutes: row.plannedMinutes,
    breakMinutes: row.breakMinutes,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
    returnNote: row.returnNote,
  };
}

export type { FocusNow };

/** What the header chip needs, and nothing else: two reads, on first load. */
export async function focusNow(): Promise<FocusNow> {
  const [running, last] = await Promise.all([
    db.focusBlock.findFirst({ where: { endedAt: null }, orderBy: { startedAt: "desc" } }),
    db.focusBlock.findFirst({ where: { endedAt: { not: null } }, orderBy: { endedAt: "desc" } }),
  ]);
  return { running: running ? view(running) : null, last: last ? view(last) : null };
}

export type FocusDay = {
  date: string;
  minutes: number;
  blocks: (FocusBlockView & { time: string; minutes: number })[];
};

export type FocusView = FocusNow & {
  today: string;
  minutesToday: number;
  blocksToday: number;
  minutesWeek: number;
  /** This week, newest day first. */
  days: FocusDay[];
  /** Today's and late tasks first: what a block is most likely to be for. */
  tasks: { id: string; title: string; when: "today" | "overdue" | "later" }[];
  /**
   * The last «dónde lo dejé» per task and per free label, to show when a block
   * starts on the same thing again — that is the whole point of writing it.
   */
  resume: { byTask: Record<string, string>; byLabel: Record<string, string> };
};

/** How far back a return note is still worth showing. */
const RESUME_DAYS = 30;

export async function getFocus(): Promise<FocusView> {
  const timezone = await getTimezone();
  const today = calendarDate(timezone);
  const monday = mondayOf(today);
  const weekStart = zonedMidnight(monday, timezone);
  const weekEnd = zonedMidnight(addDays(monday, 7), timezone);

  const [now, week, notes, tasks] = await Promise.all([
    focusNow(),
    db.focusBlock.findMany({
      where: { endedAt: { not: null }, startedAt: { gte: weekStart, lt: weekEnd } },
      orderBy: { startedAt: "desc" },
    }),
    db.focusBlock.findMany({
      where: {
        endedAt: { gte: new Date(Date.now() - RESUME_DAYS * 86_400_000) },
        returnNote: { not: null },
      },
      orderBy: { endedAt: "desc" },
      select: { taskId: true, label: true, returnNote: true },
    }),
    db.task.findMany({
      where: { status: { in: ["planned", "inbox"] } },
      orderBy: [{ plannedFor: "asc" }, { createdAt: "desc" }],
      select: { id: true, title: true, status: true, plannedFor: true },
      take: 60,
    }),
  ]);

  const byDay = new Map<string, FocusDay>();
  for (const row of week) {
    const date = calendarDate(timezone, row.startedAt);
    const block = view(row);
    const minutes = workedMinutes(block);
    const day = byDay.get(date) ?? { date, minutes: 0, blocks: [] };
    day.minutes += minutes;
    day.blocks.push({ ...block, time: calendarTime(timezone, row.startedAt), minutes });
    byDay.set(date, day);
  }
  const days = [...byDay.values()];
  const todayDay = byDay.get(today);

  // Newest first, so the first note seen for a task is its latest.
  const byTask: Record<string, string> = {};
  const byLabel: Record<string, string> = {};
  for (const n of notes) {
    if (n.taskId && !(n.taskId in byTask)) byTask[n.taskId] = n.returnNote!;
    const key = labelKey(n.label);
    if (!(key in byLabel)) byLabel[key] = n.returnNote!;
  }

  const rank = { overdue: 0, today: 1, later: 2 } as const;
  return {
    ...now,
    today,
    minutesToday: todayDay?.minutes ?? 0,
    blocksToday: todayDay?.blocks.length ?? 0,
    minutesWeek: days.reduce((n, d) => n + d.minutes, 0),
    days,
    tasks: tasks
      .map((t) => {
        const group = groupOf(t, today);
        const when: "today" | "overdue" | "later" =
          group === "overdue" ? "overdue" : group === "today" ? "today" : "later";
        return { id: t.id, title: t.title, when };
      })
      .sort((a, b) => rank[a.when] - rank[b.when]),
    resume: { byTask, byLabel },
  };
}

export class FocusConflict extends Error {}

/**
 * Starts a block. One at a time: a second one would be two clocks claiming the
 * same minutes, and «horas de foco» would count them twice. The check and the
 * insert share a transaction so two tabs pressing at once cannot both win.
 */
export async function startBlock(fields: { label: string; taskId: string | null; format: string }): Promise<FocusBlockView> {
  const format = formatFor(fields.format);

  return db.$transaction(async (tx) => {
    const running = await tx.focusBlock.findFirst({ where: { endedAt: null }, select: { label: true } });
    if (running) throw new FocusConflict(`Ya hay un bloque en marcha: «${running.label}».`);

    const task = fields.taskId
      ? await tx.task.findUnique({ where: { id: fields.taskId }, select: { id: true, title: true } })
      : null;

    const row = await tx.focusBlock.create({
      data: {
        // A task's title is copied, so the history still reads after the task goes.
        label: fields.label.trim() || task?.title || "Sin nombre",
        taskId: task?.id ?? null,
        plannedMinutes: format.work,
        breakMinutes: format.rest,
        startedAt: new Date(),
      },
    });
    return view(row);
  });
}

/** Closes the running block, at its planned end at the latest, with its note. */
export async function finishBlock(id: string, returnNote: string): Promise<{ block: FocusBlockView; taskId: string | null }> {
  const row = await db.focusBlock.findUniqueOrThrow({ where: { id } });
  if (row.endedAt) return { block: view(row), taskId: row.taskId };

  const endedAt = new Date(closingTime(view(row), Date.now()));
  const saved = await db.focusBlock.update({
    where: { id },
    data: { endedAt, returnNote: blankToNull(returnNote) },
  });
  return { block: view(saved), taskId: saved.taskId };
}

export async function setReturnNote(id: string, returnNote: string): Promise<void> {
  await db.focusBlock.update({ where: { id }, data: { returnNote: blankToNull(returnNote) } });
}

export async function deleteBlock(id: string): Promise<{ label: string } | null> {
  const row = await db.focusBlock.findUnique({ where: { id }, select: { label: true } });
  if (!row) return null;
  await db.focusBlock.delete({ where: { id } });
  return row;
}

/**
 * Closed blocks between two local days (`to` excluded), for the journal: each
 * one a line on the day it started.
 */
export async function focusBetween(
  from: string,
  to: string,
  timezone: string,
): Promise<{ date: string; time: string; label: string; minutes: number; returnNote: string | null }[]> {
  const rows = await db.focusBlock.findMany({
    where: {
      endedAt: { not: null },
      startedAt: { gte: zonedMidnight(from, timezone), lt: zonedMidnight(to, timezone) },
    },
    orderBy: { startedAt: "asc" },
  });
  return rows.map((row) => ({
    date: calendarDate(timezone, row.startedAt),
    time: calendarTime(timezone, row.startedAt),
    label: row.label,
    minutes: workedMinutes(view(row)),
    returnNote: row.returnNote,
  }));
}
