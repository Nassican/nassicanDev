"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { noteProblems, type NoteDraft } from "@/lib/note-draft";
import { noteToDraft, saveNote, setPinned } from "@/lib/notes";
import { requireUser } from "@/lib/session";
import { TRASH_DAYS, moveToTrash } from "@/lib/trash";

export type ActionResult = { ok: true; message: string; id?: string; href?: string } | { ok: false; message: string };

/*
 * Saving a note is audited only when it is created. A note is edited dozens of
 * times while it is written, and the journal would fill with «editaste la
 * nota» — the same reason its own notes are not audited at all.
 */

export async function saveNoteAction(draft: NoteDraft): Promise<ActionResult> {
  const user = await requireUser();
  const problems = noteProblems(draft);
  if (problems.length > 0) return { ok: false, message: problems.join(" ") };

  const { id, created } = await saveNote(draft);
  if (created) {
    await logAudit({ userId: user.id, action: "create", entityType: "note", entityId: id, diff: { title: draft.title.trim() } });
  }
  revalidatePath("/notas");
  return { ok: true, message: created ? "Nota creada." : "Nota guardada.", id };
}

export async function pinNote(id: string, pinned: boolean): Promise<ActionResult> {
  await requireUser();
  const title = await setPinned(id, pinned);
  revalidatePath("/notas");
  return { ok: true, message: pinned ? `«${title}» fijada arriba.` : `«${title}» ya no está fijada.` };
}

export async function deleteNote(id: string, title: string): Promise<ActionResult> {
  const user = await requireUser();
  await moveToTrash("note", id, user.id);
  await logAudit({ userId: user.id, action: "delete", entityType: "note", entityId: id, diff: { title, trash: true } });
  revalidatePath("/notas");
  return { ok: true, message: `«${title}» está en la papelera durante ${TRASH_DAYS} días.` };
}

export async function noteToArticle(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const { postId, title, losses, existed } = await noteToDraft(id, user.id);
  if (!existed) {
    await logAudit({
      userId: user.id,
      action: "create",
      entityType: "post",
      entityId: postId,
      // The journal says «Empezaste a escribir» for drafts born from an idea;
      // a note is the same moment.
      diff: { title, fromIdea: true, fromNote: id },
    });
  }
  revalidatePath("/notas");
  revalidatePath("/contenido/blogs");
  revalidatePath("/contenido/calendario");
  const lost = losses.length > 0 ? ` Se simplificaron ${losses.length} cosas: ${losses.slice(0, 2).join("; ")}${losses.length > 2 ? "…" : ""}.` : "";
  return {
    ok: true,
    message: existed ? "Esta nota ya tiene su borrador." : `Borrador «${title}» creado en Blogs.${lost}`,
    href: `/contenido/blogs/${postId}`,
  };
}
