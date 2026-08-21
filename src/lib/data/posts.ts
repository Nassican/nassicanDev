import type { Localized } from "@/lib/i18n/config";
import type { ContentBlock } from "./content";

/** Per-language copy for one article. */
export type PostTranslation = {
  title: string;
  /** Meta description and card excerpt. Keep it under ~160 characters. */
  description: string;
  body: ContentBlock[];
};

export type Post = {
  /** URL segment: `/blog/<slug>` and `/en/blog/<slug>`. */
  slug: string;
  /** ISO date, used for `datePublished` and the sitemap. */
  date: string;
  /** ISO date of the last meaningful edit. */
  updated?: string;
  /** Free-form topics; when a tag matches a key in `skills.ts` it gets an icon. */
  tags: string[];
  /** Excluded from listings, feeds and the sitemap while true. */
  draft?: boolean;
  content: Localized<PostTranslation>;
};

/**
 * No articles published yet: `/blog` renders its "coming soon" state while
 * this list is empty. Adding an entry here publishes it everywhere at once —
 * listing, homepage teaser, sitemap, llms.txt and JSON-LD.
 *
 * Every entry needs `content.es` and `content.en` filled in; see CLAUDE.md.
 */
export const posts: Post[] = [];

/** Published posts, newest first. Drafts never leave the repository. */
export const publishedPosts = posts
  .filter((p) => !p.draft)
  .sort((a, b) => b.date.localeCompare(a.date));

export function getPost(slug: string): Post | undefined {
  return publishedPosts.find((p) => p.slug === slug);
}
