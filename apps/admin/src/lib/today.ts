import "server-only";

import { db } from "@nassican/db";
import { calendarDate } from "@nassican/shared";
import { lateEditorial } from "@/lib/editorial";
import { focusBetween } from "@/lib/focus";
import { dueFollowUps } from "@/lib/opportunities";
import { habitsToday } from "@/lib/goals";
import { missingReview, readActivity } from "@/lib/journal";
import { addDays, longDayLabel, mondayOf } from "@/lib/journal-draft";
import { getTimezone } from "@/lib/site-config";
import { renewalState } from "@/lib/subscription-draft";
import { groupOf } from "@/lib/task-draft";

/**
 * «Hoy»: what today asks of you, on one screen.
 *
 * The rest of the dashboard looks back — traffic, syncs, content health. This
 * looks forward, and only as far as today: what is due, what is late, which
 * habits are pending, what the week's review promised. Anything further away
 * lives in its own module, and pulling it in here would turn a glance into a
 * list.
 *
 * One batch: every source is independent, and at this distance from the
 * database a query that waits on another is a whole round trip.
 */

/** How close a renewal or a deadline has to be to belong to today. */
const RENEWAL_DAYS = 3;
const DEADLINE_DAYS = 7;
/** «Ayer» is a reminder, not a report: the top few, highlights only. */
const YESTERDAY_LINES = 4;

export type TodayView = {
  today: string;
  label: string;
  tasks: { id: string; title: string; plannedFor: string | null; late: boolean }[];
  habits: { id: string; title: string; done: boolean }[];
  priorities: { id: string; text: string; done: boolean }[];
  renewals: { name: string; nextRenewal: string; days: number | null; overdue: boolean }[];
  goals: { title: string; deadline: string; days: number | null; overdue: boolean }[];
  yesterday: string[];
  review: { week: string; label: string } | null;
  /** Ideas and drafts whose target date came and went without publishing. */
  editorial: { title: string; targetDate: string; postId: string | null }[];
  /** Closed focus blocks today. */
  focus: { minutes: number; blocks: number };
  /** Opportunities whose next step is due today or already late. */
  followUps: { id: string; title: string; nextStep: string | null; overdue: boolean }[];
};

export async function getToday(): Promise<TodayView> {
  const timezone = await getTimezone();
  const today = calendarDate(timezone);
  const yesterday = addDays(today, -1);

  const [tasks, habits, priorities, subscriptions, goals, activity, review, editorial, focus, followUps] = await Promise.all([
    db.task.findMany({
      where: { status: "planned" },
      orderBy: { plannedFor: "asc" },
      select: { id: true, title: true, plannedFor: true, status: true },
    }),
    habitsToday(),
    db.weekPriority.findMany({
      where: { week: mondayOf(today) },
      orderBy: { position: "asc" },
      select: { id: true, text: true, done: true },
    }),
    db.subscription.findMany({
      where: { status: "active", nextRenewal: { not: null } },
      select: { name: true, nextRenewal: true },
    }),
    db.goal.findMany({
      where: { status: "active", deadline: { not: null } },
      select: { title: true, deadline: true },
    }),
    readActivity(yesterday, today, timezone),
    missingReview(),
    lateEditorial(today),
    focusBetween(today, addDays(today, 1), timezone),
    dueFollowUps(today),
  ]);

  return {
    today,
    label: longDayLabel(today),
    tasks: tasks.flatMap((t) => {
      const group = groupOf(t, today);
      return group === "today" || group === "overdue"
        ? [{ id: t.id, title: t.title, plannedFor: t.plannedFor, late: group === "overdue" }]
        : [];
    }),
    habits: habits.habits,
    priorities,
    renewals: subscriptions.flatMap((s) => {
      const state = renewalState(s.nextRenewal, today, RENEWAL_DAYS);
      return state.kind === "overdue" || state.kind === "soon"
        ? [{ name: s.name, nextRenewal: s.nextRenewal!, days: state.days, overdue: state.kind === "overdue" }]
        : [];
    }),
    goals: goals.flatMap((g) => {
      const state = renewalState(g.deadline, today, DEADLINE_DAYS);
      return state.kind === "overdue" || state.kind === "soon"
        ? [{ title: g.title, deadline: g.deadline!, days: state.days, overdue: state.kind === "overdue" }]
        : [];
    }),
    yesterday: activity
      .filter(({ item }) => item.highlight)
      .slice(-YESTERDAY_LINES)
      .map(({ item }) => item.text),
    review,
    editorial,
    focus: { minutes: focus.reduce((n, b) => n + b.minutes, 0), blocks: focus.length },
    followUps,
  };
}
