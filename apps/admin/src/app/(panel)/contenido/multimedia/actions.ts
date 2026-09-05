"use server";

import { revalidatePath } from "next/cache";
import { db } from "@nassican/db";
import { cacheTags, locales, type Locale } from "@nassican/shared";
import { requireUser } from "@/lib/session";
import { revalidatePublicSite } from "@/lib/revalidate";
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
  await requireUser();

  const usage = await db.mediaUsage.count({ where: { mediaId } });
  if (usage > 0) {
    return {
      ok: false,
      message: `No se puede borrar: la imagen se usa en ${usage} ${usage === 1 ? "sitio" : "sitios"}. Quítala de ahí primero.`,
    };
  }

  // Covers and OG images are foreign keys with ON DELETE SET NULL, so they
  // would go quiet rather than break. Check them too before removing anything.
  const [covers, ogPosts, ogProjects] = await Promise.all([
    db.post.count({ where: { coverMediaId: mediaId } }) ,
    db.postTranslation.count({ where: { ogImageId: mediaId } }),
    db.projectTranslation.count({ where: { ogImageId: mediaId } }),
  ]);
  const projectCovers = await db.project.count({ where: { coverMediaId: mediaId } });

  const referenced = covers + ogPosts + ogProjects + projectCovers;
  if (referenced > 0) {
    return {
      ok: false,
      message: `No se puede borrar: sigue asignada como portada o imagen social en ${referenced} ${referenced === 1 ? "elemento" : "elementos"}.`,
    };
  }

  // The blob cascades from the schema.
  await db.media.delete({ where: { id: mediaId } });

  revalidatePath("/contenido/multimedia");
  await revalidatePublicSite([cacheTags.posts, cacheTags.projects]);

  return { ok: true, message: "Imagen eliminada." };
}
