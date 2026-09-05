import "server-only";

import { db } from "@nassican/db";
import { locales, type ContentBlock, type Locale } from "@nassican/shared";
import type { PostDraft, PostTranslationDraft } from "@/lib/post-draft";

export * from "@/lib/post-draft";

function emptyTranslation(locale: Locale): PostTranslationDraft {
  return { locale, title: "", description: "", body: [] };
}

type Row = Awaited<ReturnType<typeof db.post.findMany>>[number] & {
  translations: {
    locale: Locale;
    title: string;
    description: string;
    body: unknown;
  }[];
  tags: { tag: { label: string } }[];
  coverMediaId: string | null;
  coverMedia: { url: string } | null;
};

function toDraft(row: Row): PostDraft {
  const byLocale = new Map(row.translations.map((t) => [t.locale, t]));

  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    featured: row.featured,
    coverMediaId: row.coverMediaId,
    coverUrl: row.coverMedia?.url ?? null,
    readingMinutes: row.readingMinutes,
    tags: row.tags.map((t) => t.tag.label),
    translations: locales.map((locale) => {
      const t = byLocale.get(locale);
      if (!t) return emptyTranslation(locale);
      return {
        locale,
        title: t.title,
        description: t.description,
        body: (t.body ?? []) as ContentBlock[],
      };
    }),
  };
}

const include = {
  translations: true,
  coverMedia: true,
  tags: { include: { tag: true }, orderBy: { position: "asc" } },
} as const;

export async function listPosts(): Promise<PostDraft[]> {
  const rows = await db.post.findMany({
    include,
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });
  return rows.map((row) => toDraft(row as Row));
}

export async function getPostDraft(id: string): Promise<PostDraft | null> {
  const row = await db.post.findUnique({ where: { id }, include });
  return row ? toDraft(row as Row) : null;
}
