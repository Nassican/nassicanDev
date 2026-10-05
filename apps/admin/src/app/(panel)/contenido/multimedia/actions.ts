"use server";

import { revalidatePath } from "next/cache";
import { db } from "@nassican/db";
import { cacheTags, locales, type Locale } from "@nassican/shared";
import { requireUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { describeUsage, describeUsageMany } from "@/lib/media-usage";
import { TRASH_DAYS, moveToTrash } from "@/lib/trash";
import { notifyPublicSite } from "@/lib/revalidate";
import type { MediaText } from "@/lib/media-library";

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

/**
 * Alt text is visible text, so `CLAUDE.md` requires it in both languages. This
 * is the *default* for the library and for covers; an image placed inside a
 * body carries its own alt on the block, because the same picture needs
 * different wording in different contexts.
 */
export async function saveMediaText(
  mediaId: string,
  text: MediaText,
): Promise<ActionResult> {
  await requireUser();

  for (const locale of locales as readonly Locale[]) {
    const alt = text[locale]?.alt.trim() ?? "";
    const caption = text[locale]?.caption.trim() || null;

    if (!alt) {
      await db.mediaTranslation
        .delete({ where: { mediaId_locale: { mediaId, locale } } })
        .catch(() => undefined);
      continue;
    }

    await db.mediaTranslation.upsert({
      where: { mediaId_locale: { mediaId, locale } },
      update: { alt, caption },
      create: { mediaId, locale, alt, caption },
    });
  }

  revalidatePath("/contenido/multimedia");

  const missing = locales.filter((l) => !text[l]?.alt.trim());
  return missing.length > 0
    ? {
        ok: true,
        message: `Guardado, pero falta el texto alternativo en: ${missing.join(", ")}.`,
      }
    : { ok: true, message: "Guardado." };
}

/**
 * Deletion is refused while anything still points at the image. The usage
 * table exists precisely so this is an informed decision rather than a
 * hopeful one.
 */
export async function deleteMedia(mediaId: string): Promise<ActionResult> {
  const actor = await requireUser();

  /*
   * One answer to «is it used?», the same one the library shows. This used to
   * keep its own list of foreign keys, and that copy is how a certificate image,
   * the profile avatar and the default social image were all deletable: the keys
   * are ON DELETE SET NULL, so they would have gone quiet rather than break.
   */
  const usages = await describeUsage(mediaId);
  if (usages.length > 0) {
    const where = [...new Set(usages.map((u) => u.label))].slice(0, 3).join(", ");
    return {
      ok: false,
      message: `No se puede borrar: se usa en ${usages.length} ${usages.length === 1 ? "sitio" : "sitios"} (${where}). Quítala de ahí primero.`,
    };
  }

  // The bytes go with it. They exist nowhere else, which is why an image is
  // the deletion the trash matters most for.
  const trashed = await moveToTrash("media", mediaId, actor.id);
  if (!trashed) return { ok: false, message: "La imagen ya no existe." };

  revalidatePath("/contenido/multimedia");
  notifyPublicSite([cacheTags.posts, cacheTags.projects]);
  await logAudit({
    userId: actor.id,
    action: "delete",
    entityType: "media",
    entityId: mediaId,
    diff: { label: trashed.label, trash: true },
  });

  return { ok: true, message: `Movida a la papelera. Se puede restaurar durante ${TRASH_DAYS} días.` };
}

/*
 * Organising is not audited: a folder says where an image is filed, not what
 * the site shows, and the journal would fill with «editaste una imagen» lines
 * for an afternoon of tidying.
 */

const MAX_FOLDER_NAME = 60;

async function folderNameProblem(name: string, except?: string): Promise<string | null> {
  const clean = name.trim();
  if (!clean) return "La carpeta necesita un nombre.";
  if (clean.length > MAX_FOLDER_NAME) return `El nombre pasa de ${MAX_FOLDER_NAME} caracteres.`;
  // Two folders with one name are two places to look for the same thing.
  const twin = await db.mediaFolder.findFirst({
    where: { name: { equals: clean, mode: "insensitive" }, ...(except ? { id: { not: except } } : {}) },
    select: { id: true },
  });
  return twin ? `Ya hay una carpeta «${clean}».` : null;
}

export async function createFolder(name: string): Promise<ActionResult & { id?: string }> {
  await requireUser();
  const problem = await folderNameProblem(name);
  if (problem) return { ok: false, message: problem };
  const folder = await db.mediaFolder.create({ data: { name: name.trim() }, select: { id: true } });
  revalidatePath("/contenido/multimedia");
  return { ok: true, message: `Carpeta «${name.trim()}» creada.`, id: folder.id };
}

export async function renameFolder(id: string, name: string): Promise<ActionResult> {
  await requireUser();
  const problem = await folderNameProblem(name, id);
  if (problem) return { ok: false, message: problem };
  await db.mediaFolder.update({ where: { id }, data: { name: name.trim() } });
  revalidatePath("/contenido/multimedia");
  return { ok: true, message: "Carpeta renombrada." };
}

/** The images stay: the key is SET NULL, so they move to «Sin carpeta». */
export async function deleteFolder(id: string): Promise<ActionResult> {
  await requireUser();
  const folder = await db.mediaFolder.findUnique({
    where: { id },
    select: { name: true, _count: { select: { media: true } } },
  });
  if (!folder) return { ok: false, message: "Esa carpeta ya no existe." };
  await db.mediaFolder.delete({ where: { id } });
  revalidatePath("/contenido/multimedia");
  const count = folder._count.media;
  return {
    ok: true,
    message:
      count > 0
        ? `Carpeta «${folder.name}» borrada. ${count === 1 ? "Su imagen pasó" : `Sus ${count} imágenes pasaron`} a «Sin carpeta».`
        : `Carpeta «${folder.name}» borrada.`,
  };
}

export async function moveMedia(ids: string[], folderId: string | null): Promise<ActionResult> {
  await requireUser();
  if (ids.length === 0) return { ok: false, message: "No hay imágenes seleccionadas." };
  const folder = folderId
    ? await db.mediaFolder.findUnique({ where: { id: folderId }, select: { name: true } })
    : null;
  if (folderId && !folder) return { ok: false, message: "Esa carpeta ya no existe." };

  const { count } = await db.media.updateMany({ where: { id: { in: ids } }, data: { folderId } });
  revalidatePath("/contenido/multimedia");
  const what = count === 1 ? "Imagen movida" : `${count} imágenes movidas`;
  return { ok: true, message: folder ? `${what} a «${folder.name}».` : `${what} a «Sin carpeta».` };
}

/**
 * Many images to the trash at once. Each one still asks the same question as a
 * single delete, and the used ones are left where they are and counted: a bulk
 * action that silently skipped some would look like it had done them all.
 */
export async function trashMedia(ids: string[]): Promise<ActionResult> {
  const actor = await requireUser();
  if (ids.length === 0) return { ok: false, message: "No hay imágenes seleccionadas." };

  const usage = await describeUsageMany(ids);
  let trashed = 0;
  let used = 0;
  for (const id of ids) {
    if ((usage.get(id) ?? []).length > 0) {
      used++;
      continue;
    }
    const done = await moveToTrash("media", id, actor.id);
    if (!done) continue;
    trashed++;
    await logAudit({
      userId: actor.id,
      action: "delete",
      entityType: "media",
      entityId: id,
      diff: { label: done.label, trash: true },
    });
  }

  revalidatePath("/contenido/multimedia");
  if (trashed > 0) notifyPublicSite([cacheTags.posts, cacheTags.projects]);

  const moved = trashed === 1 ? "1 imagen en la papelera" : `${trashed} imágenes en la papelera`;
  const kept = used > 0 ? ` · ${used} en uso, no se tocaron` : "";
  return trashed === 0
    ? { ok: false, message: `Ninguna se movió: ${used === 1 ? "la seleccionada está en uso" : "todas están en uso"}.` }
    : { ok: true, message: `${moved} durante ${TRASH_DAYS} días${kept}.` };
}
