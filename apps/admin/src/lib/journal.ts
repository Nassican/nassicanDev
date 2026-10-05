import "server-only";

import { db } from "@nassican/db";
import { calendarDate, calendarTime } from "@nassican/shared";
import { blankToNull } from "@/lib/draft-fields";
import {
  addDays,
  collapse,
  dayLabel,
  describeAudit,
  mondayOf,
  weekDays,
  weekHighlights,
  weekLabel,
  zonedMidnight,
  type DayItem,
  type LineKind,
} from "@/lib/journal-draft";
import { focusBetween } from "@/lib/focus";
import { formatDuration } from "@/lib/focus-draft";
import { getTimezone } from "@/lib/site-config";
import { groupOf } from "@/lib/task-draft";

/**
 * One week of the log: what the audit trail says happened, interleaved with
 * what was written by hand.
 *
 * The automatic half is read at render time and never stored. It is a view of
 * the audit log, and a copy kept next to its source would be a second answer
 * waiting to disagree with the first.
 */

export type JournalDay = { date: string; label: string; items: DayItem[] };

export type JournalWeekView = {
  monday: string;
  label: string;
  today: string;
  /** "21:30" now, so a new note can default to it. */
  now: string;
  prev: string;
  next: string | null;
  isCurrent: boolean;
  days: JournalDay[];
  /** The guided review of this week: three answers, and free notes. */
  review: { wentWell: string; change: string; summary: string };
  /** What last week's review set out for this week, to be ticked here. */
  priorities: { id: string; text: string; done: boolean }[];
  /** What this review sets out for the following week. */
  nextPriorities: { id: string; text: string }[];
  nextLabel: string;
  toDecide: { inbox: number; overdue: number };
  /** Minutes of closed focus blocks this week. A sum, not a tally of lines. */
  focusMinutes: number;
  /** «2 juegos terminados · 3 pagos», in a fixed order. */
  highlights: { kind: LineKind; label: string; count: number }[];
  counts: { highlights: number; routine: number; notes: number; activeDays: number };
};

/** Rows whose diff did not name the thing — `setStatus` once logged only the status. */
const NAMED = new Set(["game", "book", "subscription"]);

/**
 * The audit trail between two local days (`to` excluded), as journal lines.
 *
 * Shared by the week and by «Hoy», so «ayer terminaste…» on the dashboard and the
 * same line in the journal are one reading, with the same names resolved and the
 * same evidence asked of every «terminaste».
 */
export async function readActivity(
  from: string,
  to: string,
  timezone: string,
): Promise<{ date: string; item: DayItem }[]> {
  const audit = await db.auditLog.findMany({
    where: { createdAt: { gte: zonedMidnight(from, timezone), lt: zonedMidnight(to, timezone) } },
    orderBy: { createdAt: "asc" },
    select: { action: true, entityType: true, entityId: true, diff: true, createdAt: true },
  });

  const ids = (type: string) => [
    ...new Set(audit.filter((a) => a.entityType === type && a.entityId && NAMED.has(type)).map((a) => a.entityId!)),
  ];
  const [games, books, subscriptions] = await Promise.all([
    ids("game").length
      ? db.game.findMany({ where: { id: { in: ids("game") } }, select: { id: true, title: true, finishedAt: true } })
      : [],
    ids("book").length
      ? db.book.findMany({ where: { id: { in: ids("book") } }, select: { id: true, title: true, finishedAt: true } })
      : [],
    ids("subscription").length
      ? db.subscription.findMany({ where: { id: { in: ids("subscription") } }, select: { id: true, name: true } })
      : [],
  ]);
  const names = new Map<string, string>([
    ...games.map((g): [string, string] => [g.id, g.title]),
    ...books.map((b): [string, string] => [b.id, b.title]),
    ...subscriptions.map((s): [string, string] => [s.id, s.name]),
  ]);
  const finishes = new Map<string, string | null>([
    ...games.map((g): [string, string | null] => [g.id, g.finishedAt]),
    ...books.map((b): [string, string | null] => [b.id, b.finishedAt]),
  ]);

  return audit.flatMap((row) => {
    const diff = typeof row.diff === "object" && row.diff !== null && !Array.isArray(row.diff) ? row.diff : null;
    const date = calendarDate(timezone, row.createdAt);
    const line = describeAudit({
      action: row.action,
      entityType: row.entityType,
      diff,
      name: row.entityId ? names.get(row.entityId) : null,
      on: date,
      finishedAt: row.entityId ? finishes.get(row.entityId) : null,
    });
    return line ? [{ date, item: { time: calendarTime(timezone, row.createdAt), ...line, count: 1 } }] : [];
  });
}

export async function getWeek(requested: string | undefined): Promise<JournalWeekView> {
  const timezone = await getTimezone();
  const today = calendarDate(timezone);
  const valid = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : today;
  const monday = mondayOf(valid);
  const nextMonday = addDays(monday, 7);

  const [activity, entries, week, priorities, nextPriorities, open, focus] = await Promise.all([
    readActivity(monday, nextMonday, timezone),
    // Text dates compare as text: «2026-10-04T21:30» sorts before «2026-10-05».
    db.journalEntry.findMany({
      where: { at: { gte: monday, lt: nextMonday } },
      orderBy: { at: "asc" },
    }),
    db.journalWeek.findUnique({ where: { week: monday } }),
    db.weekPriority.findMany({ where: { week: monday }, orderBy: { position: "asc" } }),
    db.weekPriority.findMany({ where: { week: nextMonday }, orderBy: { position: "asc" } }),
    // What is still to decide, for the review: an inbox and late tasks are
    // exactly what a weekly review exists to clear.
    db.task.findMany({ where: { status: { in: ["inbox", "planned"] } }, select: { status: true, plannedFor: true } }),
    focusBetween(monday, nextMonday, timezone),
  ]);

  const byDay = new Map<string, DayItem[]>(weekDays(monday).map((d) => [d, []]));
  for (const { date, item } of activity) byDay.get(date)?.push(item);

  // Focus blocks come from their own table, not the audit trail: one line per
  // block, with where it was left, because that line is what the block was for.
  for (const block of focus) {
    byDay.get(block.date)?.push({
      time: block.time,
      text: `Enfoque · ${formatDuration(block.minutes)} en «${block.label}»${
        block.returnNote ? ` — lo dejaste en: ${block.returnNote}` : ""
      }`,
      kind: "focus",
      highlight: true,
      count: 1,
    });
  }

  for (const entry of entries) {
    byDay.get(entry.at.slice(0, 10))?.push({
      time: entry.at.length > 10 ? entry.at.slice(11, 16) : null,
      text: entry.text,
      kind: "note",
      highlight: true,
      count: 1,
      noteId: entry.id,
      at: entry.at,
    });
  }

  const days: JournalDay[] = [...byDay].map(([date, items]) => ({
    date,
    label: dayLabel(date),
    // Notes without an hour lead the day: they are about the day, not a moment in it.
    items: collapse(
      [...items].sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "")),
    ),
  }));

  const all = days.flatMap((d) => d.items);
  const weigh = (pick: (i: DayItem) => boolean) => all.filter(pick).reduce((n, i) => n + i.count, 0);

  return {
    monday,
    label: weekLabel(monday),
    today,
    now: calendarTime(timezone),
    prev: addDays(monday, -7),
    next: nextMonday <= today ? nextMonday : null,
    isCurrent: monday === mondayOf(today),
    days,
    review: {
      wentWell: week?.wentWell ?? "",
      change: week?.change ?? "",
      summary: week?.summary ?? "",
    },
    priorities: priorities.map((p) => ({ id: p.id, text: p.text, done: p.done })),
    nextPriorities: nextPriorities.map((p) => ({ id: p.id, text: p.text })),
    nextLabel: weekLabel(nextMonday),
    toDecide: {
      inbox: open.filter((t) => groupOf(t, today) === "inbox").length,
      overdue: open.filter((t) => groupOf(t, today) === "overdue").length,
    },
    focusMinutes: focus.reduce((n, b) => n + b.minutes, 0),
    highlights: weekHighlights(all),
    counts: {
      highlights: weigh((i) => !i.noteId && i.highlight),
      routine: weigh((i) => !i.noteId && !i.highlight),
      notes: entries.length,
      activeDays: days.filter((d) => d.items.length > 0).length,
    },
  };
}

/**
 * Last week's review, when it is still missing and still worth doing.
 *
 * Only from Monday to Wednesday: a review is a look back to plan forward, and
 * by Thursday the week it would plan is half gone. Nagging about it on Saturday
 * would be a reminder that only teaches you to ignore reminders.
 */
export async function missingReview(): Promise<{ week: string; label: string } | null> {
  const timezone = await getTimezone();
  const today = calendarDate(timezone);
  const weekday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = Monday
  if (weekday > 2) return null;

  const week = addDays(mondayOf(today), -7);
  const [review, priorities] = await Promise.all([
    db.journalWeek.findUnique({ where: { week }, select: { summary: true, wentWell: true, change: true } }),
    db.weekPriority.count({ where: { week: addDays(week, 7) } }),
  ]);

  const done = Boolean(review?.summary?.trim() || review?.wentWell?.trim() || review?.change?.trim()) || priorities > 0;
  return done ? null : { week, label: weekLabel(week) };
}

/** Three at most: a list of priorities that grows is a list without any. */
export const MAX_PRIORITIES = 3;

/**
 * Writes the review of `week` and the priorities it sets for the week after,
 * in one transaction, so a review is never half saved. Returns how many
 * priorities were kept.
 */
export async function writeReview(
  week: string,
  review: { wentWell: string; change: string; summary: string },
  priorities: { id: string | null; text: string }[],
): Promise<number> {
  const next = addDays(week, 7);
  const kept = priorities.map((p) => ({ ...p, text: p.text.trim() })).filter((p) => p.text).slice(0, MAX_PRIORITIES);
  const answers = {
    wentWell: blankToNull(review.wentWell),
    change: blankToNull(review.change),
    summary: blankToNull(review.summary),
  };
  const empty = !answers.wentWell && !answers.change && !answers.summary;

  await db.$transaction([
    empty
      ? db.journalWeek.deleteMany({ where: { week } })
      : db.journalWeek.upsert({ where: { week }, create: { week, ...answers }, update: answers }),
    db.weekPriority.deleteMany({
      where: { week: next, id: { notIn: kept.flatMap((p) => (p.id ? [p.id] : [])) } },
    }),
    ...kept.map((p, position) =>
      p.id
        ? db.weekPriority.update({ where: { id: p.id }, data: { text: p.text, position } })
        : db.weekPriority.create({ data: { week: next, text: p.text, position } }),
    ),
  ]);
  return kept.length;
}
