import "server-only";

import { db, type ClientProjectStatus } from "@nassican/db";
import { calendarDate } from "@nassican/shared";
import {
  daysBetween,
  isLate,
  isQuiet,
  totalHours,
  type ClientProjectDraft,
} from "@/lib/client-project-draft";
import { blankToNull, parseNumber } from "@/lib/draft-fields";
import { getTimezone } from "@/lib/site-config";

export type ClientProjectEntryRow = { id: string; at: string; text: string; hours: number | null };

export type ClientProjectRow = {
  id: string;
  title: string;
  company: string;
  status: ClientProjectStatus;
  contactName: string | null;
  contact: string | null;
  url: string | null;
  description: string | null;
  startedAt: string | null;
  dueDate: string | null;
  finishedAt: string | null;
  amount: number | null;
  currency: ClientProjectDraft["currency"] | null;
  entries: ClientProjectEntryRow[];
  hours: number;
  /** The newest logged step, or null when nothing has been logged. */
  lastActivity: string | null;
  daysQuiet: number | null;
  late: boolean;
  quiet: boolean;
};

export type ClientProjectsView = {
  today: string;
  rows: ClientProjectRow[];
  companies: string[];
  counts: Record<ClientProjectStatus, number>;
};

export async function getClientProjects(): Promise<ClientProjectsView> {
  const [rows, timezone] = await Promise.all([
    db.clientProject.findMany({
      orderBy: [{ updatedAt: "desc" }],
      include: { entries: { orderBy: [{ at: "desc" }, { createdAt: "desc" }] } },
    }),
    getTimezone(),
  ]);
  const today = calendarDate(timezone);

  const view = rows.map((r): ClientProjectRow => {
    const entries = r.entries.map((e) => ({ id: e.id, at: e.at, text: e.text, hours: e.hours }));
    const lastActivity = entries[0]?.at ?? null;
    return {
      id: r.id,
      title: r.title,
      company: r.company,
      status: r.status,
      contactName: r.contactName,
      contact: r.contact,
      url: r.url,
      description: r.description,
      startedAt: r.startedAt,
      dueDate: r.dueDate,
      finishedAt: r.finishedAt,
      amount: r.amount === null ? null : Number(r.amount),
      currency: r.currency,
      entries,
      hours: totalHours(entries),
      lastActivity,
      daysQuiet: daysBetween(lastActivity, today),
      late: isLate(r.dueDate, r.status, today),
      quiet: isQuiet(r.status, lastActivity ?? r.startedAt, today),
    };
  });

  const counts = { not_started: 0, in_progress: 0, finished: 0 } satisfies Record<ClientProjectStatus, number>;
  for (const r of view) counts[r.status]++;

  return {
    today,
    rows: view,
    companies: [...new Set(view.map((r) => r.company))].sort((a, b) => a.localeCompare(b)),
    counts,
  };
}

function toRow(draft: ClientProjectDraft) {
  const amount = parseNumber(draft.amount);
  return {
    title: draft.title.trim(),
    company: draft.company.trim(),
    status: draft.status,
    contactName: blankToNull(draft.contactName),
    contact: blankToNull(draft.contact),
    url: blankToNull(draft.url),
    description: blankToNull(draft.description),
    startedAt: blankToNull(draft.startedAt),
    dueDate: blankToNull(draft.dueDate),
    finishedAt: blankToNull(draft.finishedAt),
    amount,
    currency: amount === null ? null : draft.currency,
  };
}

export async function saveClientProject(draft: ClientProjectDraft): Promise<{ id: string; created: boolean }> {
  if (draft.id) {
    await db.clientProject.update({ where: { id: draft.id }, data: toRow(draft) });
    return { id: draft.id, created: false };
  }
  const row = await db.clientProject.create({ data: toRow(draft), select: { id: true } });
  return { id: row.id, created: true };
}

/**
 * Status from the list. Starting stamps today as the start date when there is
 * none — the day work starts is known at that moment. Finishing does not stamp
 * the end: the list asks, because marking an old project finished is the other
 * reason to press it.
 */
export async function setStatus(
  id: string,
  status: ClientProjectStatus,
  today: string,
): Promise<{ title: string; finishedAt: string | null }> {
  const current = await db.clientProject.findUniqueOrThrow({ where: { id }, select: { startedAt: true } });
  return db.clientProject.update({
    where: { id },
    data: { status, ...(status === "in_progress" && !current.startedAt ? { startedAt: today } : {}) },
    select: { title: true, finishedAt: true },
  });
}

export async function setFinishedAt(id: string, finishedAt: string): Promise<string> {
  return (await db.clientProject.update({ where: { id }, data: { finishedAt }, select: { title: true } })).title;
}

/**
 * A step forward. Logging one on a project that had not started moves it to
 * «en marcha»: work being logged is work that started.
 */
export async function addEntry(
  projectId: string,
  entry: { at: string; text: string; hours: number | null },
): Promise<{ title: string; started: boolean }> {
  const project = await db.clientProject.findUniqueOrThrow({
    where: { id: projectId },
    select: { title: true, status: true, startedAt: true },
  });
  const start = project.status === "not_started";
  await db.$transaction([
    db.clientProjectEntry.create({
      data: { projectId, at: entry.at, text: entry.text.trim(), hours: entry.hours },
    }),
    db.clientProject.update({
      where: { id: projectId },
      data: start
        ? { status: "in_progress", startedAt: project.startedAt ?? entry.at.slice(0, 10) }
        : { updatedAt: new Date() },
    }),
  ]);
  return { title: project.title, started: start };
}

export async function deleteEntry(entryId: string): Promise<void> {
  await db.clientProjectEntry.delete({ where: { id: entryId } });
}

/** For «Hoy»: what is in progress, and how long since it moved. */
export async function activeWork(today: string): Promise<{ id: string; title: string; company: string; daysQuiet: number | null; quiet: boolean; late: boolean }[]> {
  const rows = await db.clientProject.findMany({
    where: { status: "in_progress" },
    select: {
      id: true,
      title: true,
      company: true,
      startedAt: true,
      dueDate: true,
      status: true,
      entries: { orderBy: { at: "desc" }, take: 1, select: { at: true } },
    },
  });
  return rows.map((r) => {
    const last = r.entries[0]?.at ?? r.startedAt;
    return {
      id: r.id,
      title: r.title,
      company: r.company,
      daysQuiet: daysBetween(last, today),
      quiet: isQuiet(r.status, last, today),
      late: isLate(r.dueDate, r.status, today),
    };
  });
}
