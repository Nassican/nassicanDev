"use server";

import { revalidatePath } from "next/cache";
import { db } from "@nassican/db";
import { calendarDate } from "@nassican/shared";
import { parseQuick, type QuickKind } from "@/lib/quick-edit";
import { getTimezone } from "@/lib/site-config";
import { logAudit } from "@/lib/audit";
import { TRASH_DAYS, moveToTrash } from "@/lib/trash";
import { gameProblems, type GameDraft } from "@/lib/game-draft";
import {
  createGame,
  createStore,
  removeStore,
  setStatus,
  updateGame,
} from "@/lib/games";
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

  await moveToTrash("game", id, user.id);
  await logAudit({
    userId: user.id,
    action: "delete",
    entityType: "game",
    entityId: id,
    diff: { title, trash: true },
  });

  revalidatePath("/juegos");
  return { ok: true, message: `«${title}» está en la papelera durante ${TRASH_DAYS} días.` };
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

/**
 * Shops are rows, so adding one is a form and not a deploy.
 *
 * The launcher stays an enum on purpose: that is a closed set you do not invent.
 * A shop is the opposite — Eneba, Humble, Instant Gaming and whatever appears
 * next — and making a new purchase wait for a migration ends with the field left
 * empty, which is how a field dies.
 */
export async function addStore(name: string): Promise<ActionResult> {
  const user = await requireUser();

  const result = await createStore(name);
  if (!result.ok) return { ok: false, message: result.reason };

  await logAudit({
    userId: user.id,
    action: "create",
    entityType: "game-store",
    entityId: result.id,
    diff: { name: name.trim() },
  });

  revalidatePath("/juegos");
  return { ok: true, message: `«${name.trim()}» añadida.` };
}

export async function deleteStore(id: string): Promise<ActionResult> {
  const user = await requireUser();

  const { name, orphaned } = await removeStore(id);
  if (!name) return { ok: false, message: "Esa tienda ya no existe." };

  await logAudit({
    userId: user.id,
    action: "delete",
    entityType: "game-store",
    entityId: id,
    diff: { name, orphaned },
  });

  revalidatePath("/juegos");
  return {
    ok: true,
    message:
      orphaned > 0
        ? `«${name}» eliminada. ${orphaned} ${orphaned === 1 ? "juego quedó" : "juegos quedaron"} sin tienda.`
        : `«${name}» eliminada.`,
  };
}

/** The fields a row can edit, and how each is read. Anything else is refused. */
const quickGameFields = {
  price: "money",
  hours: "decimal",
  purchasedAt: "date",
  finishedAt: "date",
} as const satisfies Record<string, QuickKind>;

export type QuickGameField = keyof typeof quickGameFields;

/**
 * One field from the list row. «today» for the end date is resolved here,
 * against the configured timezone, because the browser's day may not be
 * Bogotá's — the same rule capture follows in Pendientes.
 */
export async function quickEditGame(id: string, field: QuickGameField, raw: string): Promise<ActionResult> {
  const user = await requireUser();
  const kind = quickGameFields[field];
  if (!kind) return { ok: false, message: "Ese campo no se edita desde la lista." };

  const text = field === "finishedAt" && raw === "today" ? calendarDate(await getTimezone()) : raw;
  const parsed = parseQuick(kind, text);
  if (!parsed.ok) return parsed;

  const game = await db.game.update({ where: { id }, data: { [field]: parsed.value }, select: { title: true } });
  await logAudit({ userId: user.id, action: "update", entityType: "game", entityId: id, diff: { title: game.title, [field]: parsed.value } });
  revalidatePath("/juegos");
  return { ok: true, message: `«${game.title}» guardado.` };
}
