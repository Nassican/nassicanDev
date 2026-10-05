"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { FocusConflict, deleteBlock, finishBlock, focusNow, setReturnNote, startBlock, type FocusNow } from "@/lib/focus";
import { MAX_RETURN_NOTE, focusProblems, formatDuration, workedMinutes } from "@/lib/focus-draft";
import { requireUser } from "@/lib/session";
import { closeTask } from "@/lib/tasks";

/**
 * Every result carries the clock as it now stands, so the page and the header
 * chip move together without asking the database again.
 */
export type FocusResult = ({ ok: true; message: string } | { ok: false; message: string }) & { now?: FocusNow };

function refresh() {
  revalidatePath("/enfoque");
  revalidatePath("/bitacora");
  revalidatePath("/");
}

/*
 * Blocks are not audited. They reach the journal from their own table, and an
 * audit row for each would put every block in it twice — the same reason the
 * journal's own notes are not audited.
 */

export async function loadFocus(): Promise<FocusNow> {
  await requireUser();
  return focusNow();
}

export async function startFocus(fields: { label: string; taskId: string | null; format: string }): Promise<FocusResult> {
  await requireUser();
  const problems = focusProblems(fields);
  if (problems.length > 0) return { ok: false, message: problems.join(" ") };

  try {
    const block = await startBlock(fields);
    refresh();
    return { ok: true, message: `Bloque de ${block.plannedMinutes} min: «${block.label}».`, now: await focusNow() };
  } catch (error) {
    if (error instanceof FocusConflict) return { ok: false, message: error.message, now: await focusNow() };
    throw error;
  }
}

export async function finishFocus(id: string, returnNote: string, taskDone: boolean): Promise<FocusResult> {
  const user = await requireUser();
  if (returnNote.trim().length > MAX_RETURN_NOTE) {
    return { ok: false, message: `La nota pasa de ${MAX_RETURN_NOTE} caracteres.` };
  }

  const { block, taskId } = await finishBlock(id, returnNote);

  let done = "";
  if (taskDone && taskId) {
    // The same close as Pendientes, audited the same way, so the journal says
    // «Completaste…» whichever screen it was ticked from.
    const { title } = await closeTask(taskId, "done");
    await logAudit({ userId: user.id, action: "update", entityType: "task", entityId: taskId, diff: { title, status: "done" } });
    revalidatePath("/pendientes");
    done = ` «${title}» marcado como hecho.`;
  }

  refresh();
  return {
    ok: true,
    message: `${formatDuration(workedMinutes(block))} de foco guardados.${done}`,
    now: await focusNow(),
  };
}

export async function saveReturnNote(id: string, returnNote: string): Promise<FocusResult> {
  await requireUser();
  if (returnNote.trim().length > MAX_RETURN_NOTE) {
    return { ok: false, message: `La nota pasa de ${MAX_RETURN_NOTE} caracteres.` };
  }
  await setReturnNote(id, returnNote);
  refresh();
  return { ok: true, message: "Nota guardada." };
}

/** Discards a running block, or deletes a closed one from the record. */
export async function discardFocus(id: string): Promise<FocusResult> {
  await requireUser();
  const removed = await deleteBlock(id);
  refresh();
  return {
    ok: true,
    message: removed ? `Bloque «${removed.label}» descartado.` : "Ese bloque ya no existía.",
    now: await focusNow(),
  };
}
