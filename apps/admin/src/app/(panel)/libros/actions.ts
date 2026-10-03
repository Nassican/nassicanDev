"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { bookProblems, type BookDraft } from "@/lib/book-draft";
import { createBook, removeBook, setStatus, updateBook } from "@/lib/books";
import { requireUser } from "@/lib/session";

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

/**
 * The rules run here as well as in the form: a server action is a public
 * endpoint, and the check that counts is this one.
 */
export async function saveBook(draft: BookDraft): Promise<ActionResult> {
  const user = await requireUser();

  const problems = bookProblems(draft);
  if (problems.length > 0) return { ok: false, message: problems.join(" ") };

  const isNew = !draft.id;
  const id = isNew ? await createBook(draft) : (await updateBook(draft), draft.id);

  await logAudit({
    userId: user.id,
    action: isNew ? "create" : "update",
    entityType: "book",
    entityId: id,
    diff: { title: draft.title.trim(), status: draft.status },
  });

  revalidatePath("/libros");

  return {
    ok: true,
    message: isNew
      ? `«${draft.title.trim()}» añadido a la biblioteca.`
      : `«${draft.title.trim()}» guardado.`,
  };
}

export async function deleteBook(id: string, title: string): Promise<ActionResult> {
  const user = await requireUser();

  await removeBook(id);
  await logAudit({
    userId: user.id,
    action: "delete",
    entityType: "book",
    entityId: id,
    diff: { title },
  });

  revalidatePath("/libros");
  return { ok: true, message: `«${title}» eliminado.` };
}

/** Status from the list, which is where it changes most. */
export async function setBookStatus(
  id: string,
  status: BookDraft["status"],
): Promise<ActionResult> {
  const user = await requireUser();

  const title = await setStatus(id, status);

  await logAudit({
    userId: user.id,
    action: "update",
    entityType: "book",
    entityId: id,
    diff: { status },
  });

  revalidatePath("/libros");
  return { ok: true, message: `«${title}» actualizado.` };
}
