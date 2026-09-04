import type { Localized } from "@/lib/i18n/config";
import type { ContentBlock } from "../content";

/**
 * One language of one article. Each post keeps these in their own file
 * (`es.ts`, `en.ts`) so editing a translation touches only that language.
 */
export type PostTranslation = {
  title: string;
  /** Meta description and card excerpt. Keep it under ~160 characters. */
  description: string;
  body: ContentBlock[];
};

/** Everything about a post that is the same in every language. */
export type PostMeta = {
  /** URL segment: `/blog/<slug>` and `/en/blog/<slug>`. Matches the folder name. */
  slug: string;
  /** ISO date, used for `datePublished` and the sitemap. */
  date: string;
  /** ISO date of the last meaningful edit. */
  updated?: string;
  /** Free-form topics; when a tag matches a key in `skills.ts` it gets an icon. */
  tags: string[];
  /** Excluded from listings, feeds, the sitemap and static generation while true. */
  draft?: boolean;
};

export type Post = PostMeta & {
  /**
   * `Localized` makes every language required, so a post cannot ship with a
   * missing translation - the build fails instead.
   */
  content: Localized<PostTranslation>;
};
