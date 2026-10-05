"use server";

import { revalidatePath } from "next/cache";
import { calendarDate } from "@nassican/shared";
import { logAudit } from "@/lib/audit";
import { formatPartialDate } from "@/lib/draft-fields";
import { requireUser } from "@/lib/session";
import { getTimezone } from "@/lib/site-config";
import { parseCapture, taskProblems } from "@/lib/task-draft";
import { closeTask, createTask, planTask, reopenTask, updateTask } from "@/lib/tasks";
import { TRASH_DAYS, moveToTrash } from "@/lib/trash";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

function refresh() {
  revalidatePath("/pendientes");
  revalidatePath("/bitacora");
  revalidatePath("/");
}

/**
 * Capture: from the page and from the palette alike. «+» and a trailing «hoy» or
 * «mañana» are read here, on the server, against the configured timezone — the
 * browser's own day may not be Bogotá's.
 */
export async function captureTask(raw: string, area?: string): Promise<ActionResult> {
  const user = await requireUser();
  const { title, plannedFor } = parseCapture(raw, calendarDate(await getTimezone()));

  const problems = taskProblems({ title, plannedFor: plannedFor ?? "" });
  if (problems.length > 0) return { ok: false, message: problems.join(" ") };

  const task = await createTask({ title, plannedFor, area });
  await logAudit({ userId: user.id, action: "create", entityType: "task", entityId: task.id, diff: { title } });
  refresh();
  return {
    ok: true,
    message: plannedFor ? `«${title}» planificado para ${formatPartialDate(plannedFor)}.` : `«${title}» en la bandeja.`,
  };
}

export async function saveTask(
  id: string,
  fields: { title: string; plannedFor: string; area: string; note: string },
): Promise<ActionResult> {
  const user = await requireUser();
  const problems = taskProblems(fields);
  if (problems.length > 0) return { ok: false, message: problems.join(" ") };

  const { title } = await updateTask(id, fields);
  await logAudit({ userId: user.id, action: "update", entityType: "task", entityId: id, diff: { title } });
  refresh();
  return { ok: true, message: `«${title}» guardado.` };
}

export async function planOn(id: string, plannedFor: string | null): Promise<ActionResult> {
  const user = await requireUser();
  if (plannedFor && taskProblems({ title: "x", plannedFor }).length > 0) {
    return { ok: false, message: "Elige un día concreto para planificarlo." };
  }

  const { title } = await planTask(id, plannedFor);
  await logAudit({
    userId: user.id,
    action: "update",
    entityType: "task",
    entityId: id,
    diff: { title, plannedFor },
  });
  refresh();
  return {
    ok: true,
    message: plannedFor ? `«${title}» para ${formatPartialDate(plannedFor)}.` : `«${title}» volvió a la bandeja.`,
  };
}

export async function finishTask(id: string, outcome: "done" | "dropped"): Promise<ActionResult> {
  const user = await requireUser();
  const { title } = await closeTask(id, outcome);
  await logAudit({ userId: user.id, action: "update", entityType: "task", entityId: id, diff: { title, status: outcome } });
  refresh();
  return { ok: true, message: outcome === "done" ? `«${title}» hecho.` : `«${title}» descartado. También cuenta.` };
}

export async function reopen(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const { title } = await reopenTask(id);
  await logAudit({ userId: user.id, action: "update", entityType: "task", entityId: id, diff: { title, status: "reopened" } });
  refresh();
  return { ok: true, message: `«${title}» vuelve a estar abierto.` };
}

export async function deleteTask(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const trashed = await moveToTrash("task", id, user.id);
  if (trashed) {
    await logAudit({ userId: user.id, action: "delete", entityType: "task", entityId: id, diff: { title: trashed.label, trash: true } });
  }
  refresh();
  return { ok: true, message: `En la papelera durante ${TRASH_DAYS} días.` };
}
