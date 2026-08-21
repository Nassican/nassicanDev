import type { Post } from "../types";
import { es } from "./es";
import { en } from "./en";

/**
 * Template, not an article. Kept as a draft so it never reaches the site but
 * still goes through the type checker: copy this folder, rename it to the new
 * slug, and flip `draft` off when the translations are ready.
 */
export const post: Post = {
  slug: "_example",
  date: "2026-01-01",
  tags: ["Next.js", "TypeScript"],
  draft: true,
  content: { es, en },
};
