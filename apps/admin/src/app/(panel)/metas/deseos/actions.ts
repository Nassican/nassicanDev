"use server";

import { revalidatePath } from "next/cache";
import { calendarDate } from "@nassican/shared";
import { logAudit } from "@/lib/audit";
import { blankToNull, isFullDay, parseNumber } from "@/lib/draft-fields";
import { requireUser } from "@/lib/session";
import { getTimezone } from "@/lib/site-config";
import { TRASH_DAYS, moveToTrash } from "@/lib/trash";
import { readSaving, wishProblems, type WishDraft } from "@/lib/wish-draft";
import {
  addSaving,
  deleteSaving,
  markBought,
  moveSavings,
  saveWish,
  setWishStatus,
  wishWithSaved,
} from "@/lib/wishes";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

function refresh() {
  revalidatePath("/metas/deseos");
  revalidatePath("/personal");
  revalidatePath("/bitacora");
}

const money = (amount: number, currency: string) =>
  amount.toLocaleString("es-CO", { style: "currency", currency, maximumFractionDigits: 2 });

export async function saveWishAction(draft: WishDraft): Promise<ActionResult> {
  const user = await requireUser();
  const problems = wishProblems(draft);
  if (problems.length > 0) return { ok: false, message: problems.join(" ") };

  const { id, created } = await saveWish(draft);
  await logAudit({
    userId: user.id,
    action: created ? "create" : "update",
    entityType: "wish",
    entityId: id,
    diff: { title: draft.title.trim() },
  });
  refresh();
  return { ok: true, message: created ? `«${draft.title.trim()}» está en la lista.` : `«${draft.title.trim()}» guardado.` };
}

/** Money set aside for a wish. A leading minus takes it back out. */
export async function saveMoney(
  itemId: string,
  entry: { amount: string; at: string; note: string },
): Promise<ActionResult> {
  const user = await requireUser();
  const at = entry.at.trim() || calendarDate(await getTimezone());
  if (!isFullDay(at)) return { ok: false, message: "El ahorro necesita un día concreto." };

  const wish = await wishWithSaved(itemId);
  const read = readSaving(entry.amount, wish.saved);
  if (!read.ok) return read;

  await addSaving(itemId, { at, amount: read.amount, note: blankToNull(entry.note) });
  await logAudit({
    userId: user.id,
    action: "update",
    entityType: "wish",
    entityId: itemId,
    diff: { title: wish.title, saved: read.amount, currency: wish.currency },
  });
  refresh();
  const total = money(wish.saved + read.amount, wish.currency);
  return {
    ok: true,
    message:
      read.amount > 0
        ? `${money(read.amount, wish.currency)} apartados para «${wish.title}». Llevas ${total}.`
        : `${money(-read.amount, wish.currency)} retirados de «${wish.title}». Quedan ${total}.`,
  };
}

export async function removeSaving(savingId: string): Promise<ActionResult> {
  await requireUser();
  const removed = await deleteSaving(savingId);
  refresh();
  return { ok: true, message: removed ? "Movimiento borrado del ahorro." : "Ya no estaba." };
}

export async function moveSavingsAction(fromId: string, toId: string): Promise<ActionResult> {
  const user = await requireUser();
  const outcome = await moveSavings(fromId, toId, calendarDate(await getTimezone()));
  if (!outcome.ok) return outcome;
  await logAudit({
    userId: user.id,
    action: "update",
    entityType: "wish",
    entityId: toId,
    diff: { title: outcome.to, saved: outcome.amount, currency: outcome.currency, from: outcome.from },
  });
  refresh();
  return { ok: true, message: `${money(outcome.amount, outcome.currency)} pasaron de «${outcome.from}» a «${outcome.to}».` };
}

/** «today» is resolved here, in the configured timezone. */
export async function buyWish(id: string, purchase: { at: string; paid: string }): Promise<ActionResult> {
  const user = await requireUser();
  const at = purchase.at.trim() || calendarDate(await getTimezone());
  if (!isFullDay(at)) return { ok: false, message: "La compra necesita un día concreto." };
  const paid = parseNumber(purchase.paid);
  if (purchase.paid.trim() && (paid === null || paid < 0)) {
    return { ok: false, message: "Lo que pagaste tiene que ser un número positivo." };
  }

  const title = await markBought(id, at, paid);
  await logAudit({
    userId: user.id,
    action: "update",
    entityType: "wish",
    entityId: id,
    diff: { title, status: "bought", boughtAt: at },
  });
  refresh();
  return { ok: true, message: `«${title}» comprado. Uno menos en la lista.` };
}

export async function changeWishStatus(id: string, status: "wanted" | "dropped"): Promise<ActionResult> {
  const user = await requireUser();
  const title = await setWishStatus(id, status);
  await logAudit({ userId: user.id, action: "update", entityType: "wish", entityId: id, diff: { title, status } });
  refresh();
  return {
    ok: true,
    message: status === "dropped" ? `«${title}» descartado. Lo ahorrado sigue ahí hasta que lo muevas.` : `«${title}» vuelve a la lista.`,
  };
}

export async function deleteWish(id: string, title: string): Promise<ActionResult> {
  const user = await requireUser();
  await moveToTrash("wish", id, user.id);
  await logAudit({ userId: user.id, action: "delete", entityType: "wish", entityId: id, diff: { title, trash: true } });
  refresh();
  return { ok: true, message: `«${title}» está en la papelera durante ${TRASH_DAYS} días, con lo que tenía ahorrado.` };
}
