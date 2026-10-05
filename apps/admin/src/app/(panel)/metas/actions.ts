"use server";

import { revalidatePath } from "next/cache";
import type { GoalStatus } from "@nassican/db";
import { logAudit } from "@/lib/audit";
import { goalProblems, type GoalDraft } from "@/lib/goal-draft";
import { archiveHabit, bumpGoal, saveGoalRow, saveHabitRow, setGoalStatus, toggleCheck } from "@/lib/goals";
import { habitProblems, type HabitDraft } from "@/lib/habit-draft";
import { requireUser } from "@/lib/session";
import { TRASH_DAYS, moveToTrash } from "@/lib/trash";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

function refresh() {
  revalidatePath("/metas");
  revalidatePath("/bitacora");
  revalidatePath("/");
}

/** A server action is a public endpoint: the rules run here as well. */
export async function saveGoal(draft: GoalDraft): Promise<ActionResult> {
  const user = await requireUser();
  const problems = goalProblems(draft);
  if (problems.length > 0) return { ok: false, message: problems.join(" ") };

  const id = await saveGoalRow(draft);
  await logAudit({ userId: user.id, action: draft.id ? "update" : "create", entityType: "goal", entityId: id, diff: { title: draft.title.trim() } });
  refresh();
  return { ok: true, message: `«${draft.title.trim()}» guardada.` };
}

export async function changeGoalStatus(id: string, status: GoalStatus): Promise<ActionResult> {
  const user = await requireUser();
  const title = await setGoalStatus(id, status);
  await logAudit({ userId: user.id, action: "update", entityType: "goal", entityId: id, diff: { title, status } });
  refresh();
  const said: Record<GoalStatus, string> = {
    achieved: `«${title}» lograda.`,
    dropped: `«${title}» abandonada. Soltar una meta también es decidir.`,
    active: `«${title}» vuelve a estar en curso.`,
  };
  return { ok: true, message: said[status] };
}

export async function stepGoal(id: string, delta: 1 | -1): Promise<ActionResult> {
  await requireUser();
  const { title, progress } = await bumpGoal(id, delta);
  refresh();
  return { ok: true, message: `«${title}»: ${progress}.` };
}

export async function deleteGoal(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const trashed = await moveToTrash("goal", id, user.id);
  if (trashed) {
    await logAudit({ userId: user.id, action: "delete", entityType: "goal", entityId: id, diff: { title: trashed.label, trash: true } });
  }
  refresh();
  return { ok: true, message: `En la papelera durante ${TRASH_DAYS} días.` };
}

export async function saveHabit(draft: HabitDraft): Promise<ActionResult> {
  const user = await requireUser();
  const problems = habitProblems(draft);
  if (problems.length > 0) return { ok: false, message: problems.join(" ") };

  const id = await saveHabitRow(draft);
  await logAudit({ userId: user.id, action: draft.id ? "update" : "create", entityType: "habit", entityId: id, diff: { title: draft.title.trim() } });
  refresh();
  return { ok: true, message: `«${draft.title.trim()}» guardado.` };
}

export async function toggleHabit(id: string, date: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: "Ese día no existe." };

  const { title, done } = await toggleCheck(id, date);
  // Only the tick is recorded, not the untick: the journal says what you did.
  if (done) {
    await logAudit({ userId: user.id, action: "update", entityType: "habit", entityId: id, diff: { title, checked: date } });
  }
  refresh();
  return { ok: true, message: done ? `«${title}» hecho.` : `«${title}» desmarcado.` };
}

export async function setHabitArchived(id: string, archived: boolean): Promise<ActionResult> {
  await requireUser();
  const title = await archiveHabit(id, archived);
  refresh();
  return { ok: true, message: archived ? `«${title}» archivado: su historia se queda.` : `«${title}» vuelve a estar activo.` };
}

export async function deleteHabit(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const trashed = await moveToTrash("habit", id, user.id);
  if (trashed) {
    await logAudit({ userId: user.id, action: "delete", entityType: "habit", entityId: id, diff: { title: trashed.label, trash: true } });
  }
  refresh();
  return { ok: true, message: `En la papelera durante ${TRASH_DAYS} días, con todos sus días marcados.` };
}
