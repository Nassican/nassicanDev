"use server";

import { revalidatePath } from "next/cache";
import { db } from "@nassican/db";
import { logAudit } from "@/lib/audit";
import { isFullDay, isPartialDate, splitDateTime } from "@/lib/draft-fields";
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

/** An empty note removes the row rather than storing a blank one. */
export async function saveWeekNote(week: string, summary: string): Promise<ActionResult> {
  await requireUser();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return { ok: false, message: "Esa semana no existe." };
  if (summary.length > 8000) return { ok: false, message: "La nota de la semana es demasiado larga." };

  if (summary.trim()) {
    await db.journalWeek.upsert({
      where: { week },
      create: { week, summary: summary.trim() },
      update: { summary: summary.trim() },
    });
  } else {
    await db.journalWeek.deleteMany({ where: { week } });
  }

  revalidatePath("/bitacora");
  return { ok: true, message: "Nota de la semana guardada." };
}
