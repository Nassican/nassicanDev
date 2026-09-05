"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, prismaJson } from "@nassican/db";
import { postTags, type ContentBlock, type Locale } from "@nassican/shared";
import { requireUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { notifyPublicSite } from "@/lib/revalidate";
import { syncMediaUsage } from "@/lib/media-usage";
import {
  estimateReadingMinutes,
  incompleteLocales,
  slugify,
  type PostDraft,
  type PostTranslationDraft,
} from "@/lib/post-draft";

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

/**
 * Tags are technology names, so one row per label shared across posts. The
 * slug is derived rather than typed: two posts tagged "Next.js" must land on
 * the same tag, not on two.
 */
async function syncTags(postId: string, labels: string[]) {
  const unique = [...new Set(labels.map((l) => l.trim()).filter(Boolean))];

  const tags = await Promise.all(
    unique.map((label) =>
      db.tag.upsert({
        where: { slug: slugify(label) },
        update: { label },
        create: { slug: slugify(label), label },
      }),
    ),
  );

  await db.postTag.deleteMany({ where: { postId } });
  await db.postTag.createMany({
    data: tags.map((tag, position) => ({ postId, tagId: tag.id, position })),
  });
}

async function writeTranslations(
  postId: string,
  translations: PostTranslationDraft[],
) {
  for (const t of translations) {
    const data = {
      title: t.title.trim(),
      description: t.description.trim(),
      body: prismaJson.body(t.body as ContentBlock[]),
    };

    await db.postTranslation.upsert({
      where: { postId_locale: { postId, locale: t.locale as Locale } },
      update: data,
      create: { postId, locale: t.locale as Locale, ...data },
    });
  }
}

export async function createPost(): Promise<never> {
  const user = await requireUser();

  const post = await db.post.create({
    data: {
      slug: `borrador-${Date.now().toString(36)}`,
      status: "draft",
      authorId: user.id,
    },
  });

  revalidatePath("/contenido/blogs");
  redirect(`/contenido/blogs/${post.id}`);
}

export async function savePost(draft: PostDraft): Promise<ActionResult> {
  await requireUser();

  const slug = slugify(draft.slug) || `borrador-${Date.now().toString(36)}`;

  const clash = await db.post.findFirst({
    where: { slug, NOT: { id: draft.id } },
    select: { id: true },
  });
  if (clash) {
    return { ok: false, message: `Ya existe otro artículo con el slug "${slug}".` };
  }

  await db.post.update({
    where: { id: draft.id },
    data: {
      slug,
      featured: draft.featured,
      coverMediaId: draft.coverMediaId,
      readingMinutes: estimateReadingMinutes(draft.translations),
      publishedAt: draft.publishedAt ? new Date(draft.publishedAt) : null,
    },
  });

  await writeTranslations(draft.id, draft.translations);
  await syncTags(draft.id, draft.tags);
  await syncMediaUsage({
    entityType: "post",
    entityId: draft.id,
    coverMediaId: draft.coverMediaId,
    bodies: draft.translations.map((t) => ({ locale: t.locale, body: t.body })),
  });

  revalidatePath(`/contenido/blogs/${draft.id}`);
  revalidatePath("/contenido/blogs");

  // A published post that is edited has to reach the site again.
  if (draft.status === "published") notifyPublicSite(postTags(slug));

  return { ok: true, message: "Guardado." };
}

export async function publishPost(draft: PostDraft): Promise<ActionResult> {
  const actor = await requireUser();

  const saved = await savePost(draft);
  if (!saved.ok) return saved;

  const missing = incompleteLocales(draft);
  if (missing.length > 0) {
    return {
      ok: false,
      message: `Faltan título, descripción o cuerpo en: ${missing.join(", ")}. Un artículo no se publica a medias.`,
    };
  }

  const slug = slugify(draft.slug);
  await db.post.update({
    where: { id: draft.id },
    data: {
      status: "published",
      publishedAt: draft.publishedAt ? new Date(draft.publishedAt) : new Date(),
    },
  });

  notifyPublicSite(postTags(slug));
  await logAudit({
    userId: actor.id,
    action: "publish",
    entityType: "post",
    entityId: draft.id,
    diff: { label: draft.translations[0]?.title || slug, slug },
  });
  revalidatePath("/contenido/blogs");
  revalidatePath(`/contenido/blogs/${draft.id}`);

  return { ok: true, message: "Publicado." };
}

export async function unpublishPost(id: string): Promise<ActionResult> {
  const actor = await requireUser();

  const post = await db.post.update({
    where: { id },
    data: { status: "draft" },
    select: { slug: true },
  });

  notifyPublicSite(postTags(post.slug));
  await logAudit({
    userId: actor.id,
    action: "unpublish",
    entityType: "post",
    entityId: id,
    diff: { label: post.slug },
  });
  revalidatePath("/contenido/blogs");
  revalidatePath(`/contenido/blogs/${id}`);

  return { ok: true, message: "Retirado del sitio público." };
}

export async function deletePost(id: string): Promise<never> {
  const actor = await requireUser();

  // Translations, tags and revisions cascade from the schema.
  const post = await db.post.delete({ where: { id }, select: { slug: true } });

  notifyPublicSite(postTags(post.slug));
  await logAudit({
    userId: actor.id,
    action: "delete",
    entityType: "post",
    entityId: id,
    diff: { label: post.slug },
  });
  revalidatePath("/contenido/blogs");
  redirect("/contenido/blogs");
}
