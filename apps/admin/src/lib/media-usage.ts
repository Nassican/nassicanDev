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
 * Where one image is used. One answer to «is it used?», shared by the library,
 * deleting, and the profile's diploma clean-up.
 */
export async function describeUsage(mediaId: string): Promise<MediaUsageSummary[]> {
  return (await describeUsageMany([mediaId])).get(mediaId) ?? [];
}

/**
 * Where each of many images is used, in a fixed number of queries.
 *
 * Reads two sources on purpose. `media_usages` covers references inside a body,
 * which are not foreign keys and can only be found by scanning. Covers and
 * social images *are* foreign keys, and reading them directly means the answer
 * is right even for rows the panel never saved - imported content, for one -
 * without needing a backfill to stay honest.
 *
 * Batched because the library used to call the one-image version once per
 * image: eight queries each, so forty images were three hundred round trips and
 * 3.4 s, growing with every upload. Now it is ten queries for any number.
 */
export async function describeUsageMany(ids: string[]): Promise<Map<string, MediaUsageSummary[]>> {
  const result = new Map<string, MediaUsageSummary[]>();
  if (ids.length === 0) return result;
  const among = { in: ids };

  const [tracked, postCovers, projectCovers, postOg, projectOg, certificates, profiles, seoDefaults] =
    await Promise.all([
      db.mediaUsage.findMany({
        where: { mediaId: among },
        select: { mediaId: true, entityType: true, entityId: true, field: true },
      }),
      db.post.findMany({ where: { coverMediaId: among }, select: { id: true, coverMediaId: true } }),
      db.project.findMany({ where: { coverMediaId: among }, select: { id: true, coverMediaId: true } }),
      db.postTranslation.findMany({ where: { ogImageId: among }, select: { postId: true, ogImageId: true } }),
      db.projectTranslation.findMany({
        where: { ogImageId: among },
        select: { projectId: true, ogImageId: true },
      }),
      // Three more foreign keys, found missing when 37 diplomas were linked: a
      // certificate's image, the profile avatar and the default social image.
      // Without them the library called a used image «unused» and let it go.
      db.certificate.findMany({
        where: { fileMediaId: among },
        select: { id: true, fileMediaId: true, translations: { where: { locale: "es" }, select: { title: true } } },
      }),
      db.profile.findMany({ where: { avatarMediaId: among }, select: { id: true, avatarMediaId: true } }),
      db.seoSettings.findMany({ where: { defaultOgImageId: among }, select: { id: true, defaultOgImageId: true } }),
    ]);

  type Ref = { mediaId: string; entityType: string; entityId: string; field: string };
  const refs: Ref[] = [
    ...tracked,
    ...postCovers.map((p) => ({ mediaId: p.coverMediaId!, entityType: "post", entityId: p.id, field: "cover" })),
    ...projectCovers.map((p) => ({ mediaId: p.coverMediaId!, entityType: "project", entityId: p.id, field: "cover" })),
    ...postOg.map((p) => ({ mediaId: p.ogImageId!, entityType: "post", entityId: p.postId, field: "og_image" })),
    ...projectOg.map((p) => ({ mediaId: p.ogImageId!, entityType: "project", entityId: p.projectId, field: "og_image" })),
    ...certificates.map((c) => ({ mediaId: c.fileMediaId!, entityType: "certificate", entityId: c.id, field: "file" })),
    ...profiles.map((p) => ({ mediaId: p.avatarMediaId!, entityType: "profile", entityId: String(p.id), field: "avatar" })),
    ...seoDefaults.map((s) => ({ mediaId: s.defaultOgImageId!, entityType: "seo", entityId: String(s.id), field: "og_image" })),
  ];

  // The same reference can appear in both sources once the panel has saved it.
  const seen = new Set<string>();
  const usages = refs.filter((u) => {
    const key = `${u.mediaId}|${u.entityType}|${u.entityId}|${u.field}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (usages.length === 0) return result;

  const idsOf = (type: string) => [...new Set(usages.filter((u) => u.entityType === type).map((u) => u.entityId))];
  const [posts, projects] = await Promise.all([
    idsOf("post").length
      ? db.post.findMany({
          where: { id: { in: idsOf("post") } },
          select: { id: true, slug: true, translations: { select: { title: true }, take: 1 } },
        })
      : [],
    idsOf("project").length
      ? db.project.findMany({ where: { id: { in: idsOf("project") } }, select: { id: true, title: true } })
      : [],
  ]);

  const fieldLabels: Record<string, string> = {
    cover: "portada",
    og_image: "imagen social",
    body: "cuerpo",
    file: "imagen",
    avatar: "avatar",
  };

  const describe = (ref: Ref): MediaUsageSummary => {
    const usage = { entityType: ref.entityType, entityId: ref.entityId, field: ref.field };
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
    if (usage.entityType === "certificate") {
      const certificate = certificates.find((c) => c.id === usage.entityId);
      return { ...usage, label: certificate?.translations[0]?.title ?? "certificado", href: "/perfil" };
    }
    if (usage.entityType === "profile") return { ...usage, label: "perfil", href: "/perfil" };
    if (usage.entityType === "seo") return { ...usage, label: "SEO global", href: "/seo" };
    return { ...usage, label: usage.entityType, href: null };
  };

  for (const usage of usages) {
    const summary = describe(usage);
    const list = result.get(usage.mediaId) ?? [];
    list.push({ ...summary, field: fieldLabels[summary.field] ?? summary.field });
    result.set(usage.mediaId, list);
  }
  return result;
}
