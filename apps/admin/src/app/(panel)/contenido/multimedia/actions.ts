"use server";

import { revalidatePath } from "next/cache";
import { db } from "@nassican/db";
import { cacheTags, locales, type Locale } from "@nassican/shared";
import { requireUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { describeUsage } from "@/lib/media-usage";
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
