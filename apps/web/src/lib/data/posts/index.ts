import { unstable_cache } from "next/cache";
import { db } from "@nassican/db";
import { cacheTags, locales, type Locale } from "@nassican/shared";
import type { Post, PostTranslation } from "./types";

/**
 * Articles now come from the database, written from app.nassican.com, instead
 * of from TypeScript modules in this folder.
 *
 * The `Post` shape is deliberately unchanged, so `PostCard`, `Prose` and the
 * SEO helpers did not have to move with it. What changed is where the data
 * comes from and when it is read: reads are tagged, and the admin invalidates
 * those tags through `/api/revalidate` when it publishes. The pages stay
 * statically generated between publications.
 */
const postWithContent = {
  translations: true,
  tags: { include: { tag: true }, orderBy: { position: "asc" } },
} as const;

type PostRow = {
  slug: string;
  publishedAt: Date | null;
  updatedAt: Date;
  translations: { locale: Locale; title: string; description: string; body: unknown }[];
  tags: { tag: { label: string } }[];
};

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * A published post is guaranteed to have every locale, because publishing
 * checks it. This still skips anything incomplete rather than rendering a
 * half-translated page - a row can always be edited straight in the database.
 */
function toPost(row: PostRow): Post | null {
  const content = {} as Record<Locale, PostTranslation>;

  for (const locale of locales) {
    const translation = row.translations.find((t) => t.locale === locale);
    if (!translation) return null;

    content[locale] = {
      title: translation.title,
      description: translation.description,
      body: translation.body as PostTranslation["body"],
    };
  }

  const published = row.publishedAt ?? row.updatedAt;

  return {
    slug: row.slug,
    date: isoDate(published),
    updated:
      row.updatedAt > published ? isoDate(row.updatedAt) : undefined,
    tags: row.tags.map((t) => t.tag.label),
    content,
  };
}

async function readPublishedPosts(): Promise<Post[]> {
  const rows = await db.post.findMany({
    where: { status: "published", publishedAt: { lte: new Date() } },
    include: postWithContent,
    orderBy: { publishedAt: "desc" },
  });

  return rows.map((row) => toPost(row as PostRow)).filter((p): p is Post => p !== null);
}

/** Published posts, newest first. Drafts and scheduled posts never appear. */
export const getPublishedPosts = unstable_cache(
  readPublishedPosts,
  ["published-posts"],
  { tags: [cacheTags.posts] },
);

export async function getPost(slug: string): Promise<Post | undefined> {
  const read = unstable_cache(
    async () => {
      const row = await db.post.findFirst({
        where: { slug, status: "published", publishedAt: { lte: new Date() } },
        include: postWithContent,
      });
      return row ? toPost(row as PostRow) : null;
    },
    ["post", slug],
    { tags: [cacheTags.posts, cacheTags.post(slug)] },
  );

  return (await read()) ?? undefined;
}

export type { Post, PostMeta, PostTranslation } from "./types";
