import "server-only";

import { db, type GoalSource, type GoalStatus } from "@nassican/db";
import { calendarDate } from "@nassican/shared";
import { blankToNull } from "@/lib/draft-fields";
import { finishedSince, type GoalDraft } from "@/lib/goal-draft";
import type { HabitDraft } from "@/lib/habit-draft";
import { addDays, zonedMidnight } from "@/lib/journal-draft";
import { getTimezone } from "@/lib/site-config";

/**
 * Goals and habits, read and written.
 *
 * Automatic goals are counted here, from rows other modules already keep, in the
 * same batch as everything else: a goal that reads «4 de 12 libros» has to agree
 * with Libros the moment a book is marked finished, or it is a second answer.
 */

export type GoalRow = {
  id: string;
  title: string;
  why: string | null;
  planIf: string;
  planThen: string;
  deadline: string | null;
  status: GoalStatus;
  target: number | null;
  unit: string | null;
  source: GoalSource | null;
  since: string | null;
  /** Counted from the source, or the hand-kept progress. */
  count: number;
};

export type HabitRow = {
  id: string;
  title: string;
  cue: string;
  days: string;
  archived: boolean;
  /** Local days it was done, newest first. */
  checks: string[];
  /** Every check ever, for the formation count. */
  total: number;
};

export type GoalsSummary = { today: string; goals: GoalRow[]; habits: HabitRow[] };

/** How far back checks are read: enough for any streak a person keeps by hand. */
const CHECK_WINDOW = 400;

export async function getGoalsAndHabits(): Promise<GoalsSummary> {
  const timezone = await getTimezone();
  const today = calendarDate(timezone);

  const [goals, habits, totals] = await Promise.all([
    db.goal.findMany({ orderBy: [{ status: "asc" }, { deadline: "asc" }, { createdAt: "asc" }] }),
    db.habit.findMany({
      orderBy: [{ archived: "asc" }, { createdAt: "asc" }],
      include: {
        checks: {
          where: { date: { gte: addDays(today, -CHECK_WINDOW) } },
          orderBy: { date: "desc" },
          select: { date: true },
        },
      },
    }),
    db.habitCheck.groupBy({ by: ["habitId"], _count: { _all: true } }),
  ]);

  const counts = await countSources(goals.filter((g) => g.source && g.since), timezone);
  const totalOf = new Map(totals.map((t) => [t.habitId, t._count._all]));

  return {
    today,
    goals: goals.map((g) => ({
      id: g.id,
      title: g.title,
      why: g.why,
      planIf: g.planIf,
      planThen: g.planThen,
      deadline: g.deadline,
      status: g.status,
      target: g.target,
      unit: g.unit,
      source: g.source,
      since: g.since,
      count: g.source ? (counts.get(g.id) ?? 0) : g.progress,
    })),
    habits: habits.map((h) => ({
      id: h.id,
      title: h.title,
      cue: h.cue,
      days: h.days,
      archived: h.archived,
      checks: h.checks.map((c) => c.date),
      total: totalOf.get(h.id) ?? 0,
    })),
  };
}

/**
 * The automatic counts, one query per source in use rather than per goal.
 *
 * Finished books and games are judged by their finish date at its own precision
 * (`finishedSince`), so a book with no finish date never counts — the same rule
 * the journal follows before it will say «terminaste».
 */
async function countSources(
  goals: { id: string; source: GoalSource | null; since: string | null }[],
  timezone: string,
): Promise<Map<string, number>> {
  const used = new Set(goals.map((g) => g.source));
  const [books, games, posts, tasks] = await Promise.all([
    used.has("books_finished")
      ? db.book.findMany({ where: { status: "finished" }, select: { finishedAt: true } })
      : [],
    used.has("games_finished")
      ? db.game.findMany({ where: { status: "finished" }, select: { finishedAt: true } })
      : [],
    used.has("posts_published")
      ? db.post.findMany({ where: { status: "published" }, select: { publishedAt: true } })
      : [],
    used.has("tasks_done")
      ? db.task.findMany({ where: { status: "done" }, select: { closedAt: true } })
      : [],
  ]);

  const result = new Map<string, number>();
  for (const goal of goals) {
    const since = goal.since!;
    const from = zonedMidnight(since.length === 4 ? `${since}-01-01` : since.length === 7 ? `${since}-01` : since.slice(0, 10), timezone);
    const count =
      goal.source === "books_finished"
        ? books.filter((b) => finishedSince(b.finishedAt, since)).length
        : goal.source === "games_finished"
          ? games.filter((g) => finishedSince(g.finishedAt, since)).length
          : goal.source === "posts_published"
            ? posts.filter((p) => p.publishedAt && p.publishedAt >= from).length
            : tasks.filter((t) => t.closedAt && t.closedAt >= from).length;
    result.set(goal.id, count);
  }
  return result;
}

function goalRow(draft: GoalDraft) {
  const target = draft.target.trim() ? Number(draft.target.trim()) : null;
  return {
    title: draft.title.trim(),
    why: blankToNull(draft.why),
    planIf: draft.planIf.trim(),
    planThen: draft.planThen.trim(),
    deadline: blankToNull(draft.deadline),
    target,
    unit: blankToNull(draft.unit),
    source: draft.source || null,
    since: blankToNull(draft.since),
  };
}

export async function saveGoalRow(draft: GoalDraft): Promise<string> {
  if (draft.id) {
    await db.goal.update({ where: { id: draft.id }, data: goalRow(draft) });
    return draft.id;
  }
  return (await db.goal.create({ data: goalRow(draft), select: { id: true } })).id;
}

export async function setGoalStatus(id: string, status: GoalStatus): Promise<string> {
  const goal = await db.goal.update({
    where: { id },
    data: { status, closedAt: status === "active" ? null : new Date() },
    select: { title: true },
  });
  return goal.title;
}

/** Hand-kept progress, never below zero. */
export async function bumpGoal(id: string, delta: 1 | -1): Promise<{ title: string; progress: number }> {
  const goal = await db.goal.findUniqueOrThrow({ where: { id }, select: { progress: true } });
  return db.goal.update({
    where: { id },
    data: { progress: Math.max(0, goal.progress + delta) },
    select: { title: true, progress: true },
  });
}

export async function saveHabitRow(draft: HabitDraft): Promise<string> {
  const data = { title: draft.title.trim(), cue: draft.cue.trim(), days: draft.days };
  if (draft.id) {
    await db.habit.update({ where: { id: draft.id }, data });
    return draft.id;
  }
  return (await db.habit.create({ data, select: { id: true } })).id;
}

/** Ticks or unticks one local day. Returns whether it is now done. */
export async function toggleCheck(habitId: string, date: string): Promise<{ title: string; done: boolean }> {
  const habit = await db.habit.findUniqueOrThrow({ where: { id: habitId }, select: { title: true } });
  const key = { habitId_date: { habitId, date } };
  const existing = await db.habitCheck.findUnique({ where: key });
  if (existing) {
    await db.habitCheck.delete({ where: key });
    return { title: habit.title, done: false };
  }
  await db.habitCheck.create({ data: { habitId, date } });
  return { title: habit.title, done: true };
}

export async function archiveHabit(id: string, archived: boolean): Promise<string> {
  return (await db.habit.update({ where: { id }, data: { archived }, select: { title: true } })).title;
}

/** Today's habits, for «Hoy»: due today and not archived, with whether they are done. */
export async function habitsToday(): Promise<{ today: string; habits: { id: string; title: string; done: boolean }[] }> {
  const timezone = await getTimezone();
  const today = calendarDate(timezone);
  const weekday = String(((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7) + 1);

  const habits = await db.habit.findMany({
    where: { archived: false, days: { contains: weekday } },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, checks: { where: { date: today }, select: { date: true } } },
  });

  return { today, habits: habits.map((h) => ({ id: h.id, title: h.title, done: h.checks.length > 0 })) };
}
