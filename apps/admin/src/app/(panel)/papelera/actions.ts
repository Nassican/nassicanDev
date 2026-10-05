"use server";

import { revalidatePath } from "next/cache";
import { configTags } from "@nassican/shared";
import { logAudit } from "@/lib/audit";
import { notifyPublicSite } from "@/lib/revalidate";
import { requireUser } from "@/lib/session";
import { destroyTrashItem, restoreFromTrash, siteTagsFor } from "@/lib/trash";
import type { TrashKind } from "@nassican/db";

export type ActionResult =
  | { ok: true; message: string; notes: string[] }
  | { ok: false; message: string };

/** Where each kind lives in the panel, so its list shows the restored row. */
const listPaths: Record<TrashKind, string> = {
  post: "/contenido/blogs",
  project: "/contenido/proyectos",
  page: "/contenido/paginas",
  media: "/contenido/multimedia",
  game: "/juegos",
  book: "/libros",
  subscription: "/suscripciones",
  journal: "/bitacora",
  task: "/pendientes",
  goal: "/metas",
  habit: "/metas",
  idea: "/contenido/calendario",
};

export async function restoreItem(id: string): Promise<ActionResult> {
  const user = await requireUser();

  const outcome = await restoreFromTrash(id);
  if (!outcome.ok) return outcome;

  const tags = siteTagsFor(outcome.kind, outcome.root);
  // A page that comes back may be in the menu again: its menu entries were the
  // `SET NULL` keys the restore pointed back at it.
  if (outcome.kind === "page" && outcome.relinked > 0) tags.push(...configTags);
  if (tags.length > 0) notifyPublicSite(tags);

  await logAudit({
    userId: user.id,
    action: "restore",
    entityType: outcome.kind,
    entityId: outcome.entityId,
    diff: { label: outcome.label, notes: outcome.notes.length, relinked: outcome.relinked },
  });

  revalidatePath("/papelera");
  revalidatePath(listPaths[outcome.kind]);

  // Restoring is an undo, so a published article comes back published. Said
  // out loud because it reaches the public site the moment this returns.
  const live = outcome.root.status === "published";
  const relinked =
    outcome.relinked > 0
      ? ` ${outcome.relinked} ${outcome.relinked === 1 ? "referencia vuelve" : "referencias vuelven"} a apuntarle.`
      : "";

  return {
    ok: true,
    message: `«${outcome.label}» restaurado.${live ? " Vuelve a estar en el sitio." : ""}${relinked}`,
    notes: outcome.notes,
  };
}

export async function destroyItem(id: string): Promise<ActionResult> {
  const user = await requireUser();

  const item = await destroyTrashItem(id);
  if (!item) return { ok: false, message: "Ya no está en la papelera." };

  await logAudit({
    userId: user.id,
    action: "delete",
    entityType: "trash",
    entityId: id,
    diff: { label: item.label, kind: item.kind },
  });

  revalidatePath("/papelera");
  return { ok: true, message: `«${item.label}» se eliminó para siempre.`, notes: [] };
}
