import "server-only";

import { db } from "@nassican/db";
import { extractMediaIds, type ContentBlock, type Locale } from "@nassican/shared";

/**
 * Keeps `media_usages` in step with what actually references an image.
 *
 * Recomputed on every save rather than maintained incrementally: the source of
 * truth is the entity itself, and rebuilding its rows is both simpler and
 * self-healing. Without this, "delete image" is a blind operation - the whole
 * point of the table is to answer *this image appears in 3 articles*.
 */
export async function syncMediaUsage({
  entityType,
  entityId,
  coverMediaId,
  ogImageIds,
  bodies,
}: {
  entityType: "post" | "project" | "page";
  entityId: string;
  coverMediaId?: string | null;
  ogImageIds?: { locale: Locale; mediaId: string | null }[];
  bodies?: { locale: Locale; body: ContentBlock[] }[];
}) {
  const rows: {
    mediaId: string;
    entityType: string;
    entityId: string;
    locale: Locale | null;
    field: string;
  }[] = [];

  if (coverMediaId) {
    rows.push({ mediaId: coverMediaId, entityType, entityId, locale: null, field: "cover" });
  }

  for (const { locale, mediaId } of ogImageIds ?? []) {
    if (mediaId) {
      rows.push({ mediaId, entityType, entityId, locale, field: "og_image" });
    }
  }

  for (const { locale, body } of bodies ?? []) {
    for (const mediaId of extractMediaIds(body)) {
      rows.push({ mediaId, entityType, entityId, locale, field: "body" });
    }
  }

  await db.mediaUsage.deleteMany({ where: { entityType, entityId } });
  if (rows.length > 0) {
    // A picture used twice in the same body is one usage of that body.
    await db.mediaUsage.createMany({ data: rows, skipDuplicates: true });
  }
}

export type MediaUsageSummary = {
  entityType: string;
  entityId: string;
  field: string;
  label: string;
  href: string | null;
};

/**
 * Where one image is used.
 *
 * Reads two sources on purpose. `media_usages` covers references inside a body,
 * which are not foreign keys and can only be found by scanning. Covers and
 * social images *are* foreign keys, and reading them directly means the answer
 * is right even for rows the panel never saved - imported content, for one -
 * without needing a backfill to stay honest.
 */
export async function describeUsage(
  mediaId: string,
): Promise<MediaUsageSummary[]> {
  const [tracked, postCovers, projectCovers, postOg, projectOg] =
    await Promise.all([
      db.mediaUsage.findMany({
        where: { mediaId },
        select: { entityType: true, entityId: true, field: true },
      }),
      db.post.findMany({ where: { coverMediaId: mediaId }, select: { id: true } }),
      db.project.findMany({ where: { coverMediaId: mediaId }, select: { id: true } }),
      db.postTranslation.findMany({
        where: { ogImageId: mediaId },
        select: { postId: true },
      }),
      db.projectTranslation.findMany({
        where: { ogImageId: mediaId },
        select: { projectId: true },
      }),
    ]);

  const fromKeys = [
    ...postCovers.map((p) => ({ entityType: "post", entityId: p.id, field: "cover" })),
    ...projectCovers.map((p) => ({ entityType: "project", entityId: p.id, field: "cover" })),
    ...postOg.map((p) => ({ entityType: "post", entityId: p.postId, field: "og_image" })),
    ...projectOg.map((p) => ({ entityType: "project", entityId: p.projectId, field: "og_image" })),
  ];

  // The same reference can appear in both sources once the panel has saved it.
  const usages = [...tracked, ...fromKeys].filter(
    (u, i, all) =>
      all.findIndex(
        (o) =>
          o.entityType === u.entityType &&
          o.entityId === u.entityId &&
          o.field === u.field,
      ) === i,
  );

  if (usages.length === 0) return [];

  const [posts, projects] = await Promise.all([
    db.post.findMany({
      where: { id: { in: usages.filter((u) => u.entityType === "post").map((u) => u.entityId) } },
      select: { id: true, slug: true, translations: { select: { title: true }, take: 1 } },
    }),
    db.project.findMany({
      where: { id: { in: usages.filter((u) => u.entityType === "project").map((u) => u.entityId) } },
      select: { id: true, title: true },
    }),
  ]);

  const fieldLabels: Record<string, string> = {
    cover: "portada",
    og_image: "imagen social",
    body: "cuerpo",
  };

  return usages.map((usage) => {
    if (usage.entityType === "post") {
      const post = posts.find((p) => p.id === usage.entityId);
      return {
        ...usage,
        label: post?.translations[0]?.title || post?.slug || "artículo",
        href: post ? `/contenido/blogs/${post.id}` : null,
      };
    }
    if (usage.entityType === "project") {
      const project = projects.find((p) => p.id === usage.entityId);
      return {
        ...usage,
        label: project?.title ?? "proyecto",
        href: project ? `/contenido/proyectos/${project.id}` : null,
      };
    }
    return { ...usage, label: usage.entityType, href: null };
  }).map((u) => ({ ...u, field: fieldLabels[u.field] ?? u.field }));
}
