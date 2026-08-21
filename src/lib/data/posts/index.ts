import type { Post } from "./types";
import { post as example } from "./_example";

/**
 * Registry of articles. One folder per post, one file per language inside it,
 * so this file only ever grows by two lines when a post is added and no single
 * file collects every article.
 *
 *   posts/
 *     <slug>/
 *       index.ts   metadata + wiring
 *       es.ts      Spanish title, description and body
 *       en.ts      English title, description and body
 *
 * To publish: copy `_example`, rename the folder to the slug, translate both
 * files, register it below and remove `draft`.
 */
export const posts: Post[] = [example];

/** Published posts, newest first. Drafts never leave the repository. */
export const publishedPosts = posts
  .filter((p) => !p.draft)
  .sort((a, b) => b.date.localeCompare(a.date));

export function getPost(slug: string): Post | undefined {
  return publishedPosts.find((p) => p.slug === slug);
}

export type { Post, PostMeta, PostTranslation } from "./types";
