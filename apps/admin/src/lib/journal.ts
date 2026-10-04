import "server-only";

import { db } from "@nassican/db";
import { calendarDate, calendarTime } from "@nassican/shared";
import {
  addDays,
  collapse,
  dayLabel,
  describeAudit,
  mondayOf,
  weekDays,
  weekLabel,
  zonedMidnight,
  type DayItem,
} from "@/lib/journal-draft";
import { getTimezone } from "@/lib/site-config";

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
  summary: string;
  counts: { done: number; notes: number; activeDays: number };
};

/** Rows whose diff did not name the thing — `setStatus` once logged only the status. */
const NAMED = new Set(["game", "book", "subscription"]);

export async function getWeek(requested: string | undefined): Promise<JournalWeekView> {
  const timezone = await getTimezone();
  const today = calendarDate(timezone);
  const valid = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : today;
  const monday = mondayOf(valid);
  const nextMonday = addDays(monday, 7);

  const [audit, entries, week] = await Promise.all([
    db.auditLog.findMany({
      where: {
        createdAt: { gte: zonedMidnight(monday, timezone), lt: zonedMidnight(nextMonday, timezone) },
      },
      orderBy: { createdAt: "asc" },
      select: { action: true, entityType: true, entityId: true, diff: true, createdAt: true },
    }),
    // Text dates compare as text: «2026-10-04T21:30» sorts before «2026-10-05».
    db.journalEntry.findMany({
      where: { at: { gte: monday, lt: nextMonday } },
      orderBy: { at: "asc" },
    }),
    db.journalWeek.findUnique({ where: { week: monday } }),
  ]);

  const ids = (type: string) => [
    ...new Set(
      audit.filter((a) => a.entityType === type && a.entityId && NAMED.has(type)).map((a) => a.entityId!),
    ),
  ];
  const [games, books, subscriptions] = await Promise.all([
    ids("game").length ? db.game.findMany({ where: { id: { in: ids("game") } }, select: { id: true, title: true } }) : [],
    ids("book").length ? db.book.findMany({ where: { id: { in: ids("book") } }, select: { id: true, title: true } }) : [],
    ids("subscription").length
      ? db.subscription.findMany({ where: { id: { in: ids("subscription") } }, select: { id: true, name: true } })
      : [],
  ]);
  const names = new Map<string, string>([
    ...games.map((g): [string, string] => [g.id, g.title]),
    ...books.map((b): [string, string] => [b.id, b.title]),
    ...subscriptions.map((s): [string, string] => [s.id, s.name]),
  ]);

  const byDay = new Map<string, DayItem[]>(weekDays(monday).map((d) => [d, []]));

  for (const row of audit) {
    const diff = typeof row.diff === "object" && row.diff !== null && !Array.isArray(row.diff) ? row.diff : null;
    const text = describeAudit({
      action: row.action,
      entityType: row.entityType,
      diff,
      name: row.entityId ? names.get(row.entityId) : null,
    });
    if (!text) continue;
    byDay.get(calendarDate(timezone, row.createdAt))?.push({
      time: calendarTime(timezone, row.createdAt),
      text,
      count: 1,
    });
  }

  for (const entry of entries) {
    byDay.get(entry.at.slice(0, 10))?.push({
      time: entry.at.length > 10 ? entry.at.slice(11, 16) : null,
      text: entry.text,
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

  const done = days.reduce((n, d) => n + d.items.filter((i) => !i.noteId).reduce((m, i) => m + i.count, 0), 0);

  return {
    monday,
    label: weekLabel(monday),
    today,
    now: calendarTime(timezone),
    prev: addDays(monday, -7),
    next: nextMonday <= today ? nextMonday : null,
    isCurrent: monday === mondayOf(today),
    days,
    summary: week?.summary ?? "",
    counts: {
      done,
      notes: entries.length,
      activeDays: days.filter((d) => d.items.length > 0).length,
    },
  };
}
