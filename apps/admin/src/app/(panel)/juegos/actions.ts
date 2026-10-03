"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { gameProblems, type GameDraft } from "@/lib/game-draft";
import { createGame, removeGame, setStatus, updateGame } from "@/lib/games";
import { requireUser } from "@/lib/session";

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

/**
 * The rules are checked here and not only in the form.
 *
 * The editor disables the save button and explains why, which is the kind half,
 * but a server action is a public endpoint — the check that counts is this one.
 * Same reason the user rules live in `user-draft.ts` and run twice.
 */
export async function saveGame(draft: GameDraft): Promise<ActionResult> {
  const user = await requireUser();

  const problems = gameProblems(draft);
  if (problems.length > 0) return { ok: false, message: problems.join(" ") };

  const isNew = !draft.id;
  const id = isNew ? await createGame(draft) : (await updateGame(draft), draft.id);

  await logAudit({
    userId: user.id,
    action: isNew ? "create" : "update",
    entityType: "game",
    entityId: id,
    diff: { title: draft.title.trim(), status: draft.status },
  });

  revalidatePath("/juegos");

  return {
    ok: true,
    message: isNew
      ? `«${draft.title.trim()}» añadido a la biblioteca.`
      : `«${draft.title.trim()}» guardado.`,
  };
}

export async function deleteGame(id: string, title: string): Promise<ActionResult> {
  const user = await requireUser();

  await removeGame(id);
  await logAudit({
    userId: user.id,
    action: "delete",
    entityType: "game",
    entityId: id,
    diff: { title },
  });

  revalidatePath("/juegos");
  return { ok: true, message: `«${title}» eliminado.` };
}

/**
 * Status is the field that changes most, and from the list rather than from the
 * form: marking three games as finished should not be three round trips through
 * an editor.
 */
export async function setGameStatus(
  id: string,
  status: GameDraft["status"],
): Promise<ActionResult> {
  const user = await requireUser();

  const title = await setStatus(id, status);

  await logAudit({
    userId: user.id,
    action: "update",
    entityType: "game",
    entityId: id,
    diff: { status },
  });

  revalidatePath("/juegos");
  return { ok: true, message: `«${title}» actualizado.` };
}
