"use server";

import { revalidatePath } from "next/cache";
import { db } from "@nassican/db";
import { logAudit } from "@/lib/audit";
import { calendarDate } from "@nassican/shared";
import { formatPartialDate, isFullDay, isPartialDate, splitDateTime } from "@/lib/draft-fields";
import { getTimezone } from "@/lib/site-config";
import { createTask } from "@/lib/tasks";
import { writeReview } from "@/lib/journal";
import { requireUser } from "@/lib/session";
import { TRASH_DAYS, moveToTrash } from "@/lib/trash";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

const MAX_TEXT = 2000;

/**
 * An entry needs a whole day: it belongs to one week, and «2026-10» does not
 * say which. The rules run here as well as in the form — a server action is a
 * public endpoint.
 */
function problem(at: string, text: string): string | null {
  if (!text.trim()) return "La nota está vacía.";
  if (text.length > MAX_TEXT) return `La nota pasa de ${MAX_TEXT} caracteres.`;
  if (!isPartialDate(at) || !isFullDay(splitDateTime(at).date)) return "Elige un día completo para la nota.";
  return null;
}

/*
 * Writing a note is not audited: the log would then describe itself, and the
 * week would fill with «añadiste una nota». Moving one to the trash is, like
 * every deletion.
 */

export async function addEntry(at: string, text: string): Promise<ActionResult> {
  await requireUser();
  const why = problem(at, text);
  if (why) return { ok: false, message: why };

  await db.journalEntry.create({ data: { at: at.trim(), text: text.trim() } });
  revalidatePath("/bitacora");
  return { ok: true, message: "Nota añadida." };
}

export async function updateEntry(id: string, at: string, text: string): Promise<ActionResult> {
  await requireUser();
  const why = problem(at, text);
  if (why) return { ok: false, message: why };

  await db.journalEntry.update({ where: { id }, data: { at: at.trim(), text: text.trim() } });
  revalidatePath("/bitacora");
  return { ok: true, message: "Nota guardada." };
}

export async function deleteEntry(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const trashed = await moveToTrash("journal", id, user.id);
  if (trashed) {
    await logAudit({ userId: user.id, action: "delete", entityType: "journal", entityId: id, diff: { label: trashed.label, trash: true } });
  }
  revalidatePath("/bitacora");
  return { ok: true, message: `Nota en la papelera durante ${TRASH_DAYS} días.` };
}


const isWeek = (week: string) => /^\d{4}-\d{2}-\d{2}$/.test(week);

/**
 * The guided review of `week`: its answers, and the priorities it sets for the
 * week after. One action and one transaction, so the review is never half saved
 * — answers without the plan they led to.
 *
 * Priorities are matched by id, so editing one keeps its tick; any left out of
 * the list are removed, and an empty review removes its row rather than
 * storing blanks.
 */
export async function saveReview(
  week: string,
  review: { wentWell: string; change: string; summary: string },
  priorities: { id: string | null; text: string }[],
): Promise<ActionResult> {
  await requireUser();
  if (!isWeek(week)) return { ok: false, message: "Esa semana no existe." };
  if ([review.wentWell, review.change, review.summary].some((t) => t.length > 8000)) {
    return { ok: false, message: "La revisión es demasiado larga." };
  }

  const kept = await writeReview(week, review, priorities);

  revalidatePath("/bitacora");
  revalidatePath("/");
  return {
    ok: true,
    message: kept > 0 ? `Revisión guardada, con ${kept} ${kept === 1 ? "prioridad" : "prioridades"} para la semana siguiente.` : "Revisión guardada.",
  };
}

export async function togglePriority(id: string, done: boolean): Promise<ActionResult> {
  await requireUser();
  const priority = await db.weekPriority.update({ where: { id }, data: { done }, select: { text: true } });
  revalidatePath("/bitacora");
  return { ok: true, message: done ? `«${priority.text}» cumplida.` : `«${priority.text}» pendiente otra vez.` };
}

/**
 * A priority as a task, planned for the Monday of its week: the review names
 * what matters, and the task list is where it gets a day.
 */
export async function priorityToTask(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const priority = await db.weekPriority.findUniqueOrThrow({ where: { id }, select: { text: true, week: true } });
  const today = calendarDate(await getTimezone());
  // Its week's Monday, or today if that Monday has already passed.
  const plannedFor = priority.week < today ? today : priority.week;

  const task = await createTask({ title: priority.text, plannedFor });
  await logAudit({ userId: user.id, action: "create", entityType: "task", entityId: task.id, diff: { title: task.title } });
  revalidatePath("/pendientes");
  return { ok: true, message: `«${task.title}» está en Pendientes para el ${formatPartialDate(plannedFor)}.` };
}
