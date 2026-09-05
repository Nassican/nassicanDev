/**
 * Cache tag names, shared so the admin invalidates exactly what the public site
 * tagged. The two run as separate deployments, so `revalidateTag` in the admin
 * cannot reach the site: the admin calls the site's revalidate endpoint with
 * these names instead.
 */
export const cacheTags = {
  posts: "posts",
  post: (slug: string) => `post:${slug}`,
  projects: "projects",
  project: (slug: string) => `project:${slug}`,
  profile: "profile",
  experience: "experience",
  education: "education",
  certificates: "certificates",
} as const;

/**
 * Backstop lifetime for every cached read of content, in seconds.
 *
 * Publishing invalidates the tag and the change appears at once; this is what
 * happens when that call does not get through - a wrong PUBLIC_SITE_URL, the
 * site briefly down. Without it a failed invalidation leaves the site stale
 * indefinitely, because `.next/cache` survives even a redeploy.
 *
 * Five minutes: short enough that nothing looks broken, long enough that the
 * pages stay effectively static.
 */
export const CACHE_SECONDS = 300;

/** Every tag affected by a change to one post. */
export function postTags(slug: string): string[] {
  return [cacheTags.posts, cacheTags.post(slug)];
}
