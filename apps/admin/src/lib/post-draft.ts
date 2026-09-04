import {
  missingLocales,
  readingMinutes,
  type ContentBlock,
  type Locale,
} from "@nassican/shared";

/**
 * The editor's data shape and the pure rules over it.
 *
 * Deliberately free of database imports: `PostEditor` is a client component
 * and needs `isLocaleComplete` to draw the per-language indicator. Keeping the
 * queries in `posts.ts` is what stops Prisma from being bundled for the
 * browser.
 */
export type PostTranslationDraft = {
  locale: Locale;
  title: string;
  description: string;
  body: ContentBlock[];
};

export type PostStatus = "draft" | "scheduled" | "published" | "archived";

export type PostDraft = {
  id: string;
  slug: string;
  status: PostStatus;
  publishedAt: string | null;
  featured: boolean;
  readingMinutes: number | null;
  tags: string[];
  translations: PostTranslationDraft[];
};

/**
 * A locale counts as written when it has a title, a description and at least
 * one block. This is what gates publishing - the compile-time guarantee that
 * `Localized<T>` used to give cannot survive in rows, so it becomes a check at
 * the moment it matters.
 */
export function isLocaleComplete(t: PostTranslationDraft | undefined): boolean {
  return Boolean(
    t && t.title.trim() && t.description.trim() && t.body.length > 0,
  );
}

/** The locales that would block publishing, in registry order. */
export function incompleteLocales(post: PostDraft): Locale[] {
  const written = post.translations.filter(isLocaleComplete);
  return missingLocales(written);
}

/** Reading time comes from the default locale; it is an estimate, not a fact. */
export function estimateReadingMinutes(
  translations: PostTranslationDraft[],
): number | null {
  const source = translations.find((t) => t.locale === "es") ?? translations[0];
  return source && source.body.length > 0 ? readingMinutes(source.body) : null;
}

/** URL-safe segment, accents stripped so Spanish titles give clean slugs. */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
