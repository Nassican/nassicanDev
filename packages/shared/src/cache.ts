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
  pages: "pages",
  page: (route: string) => `page:${route}`,
  seoSettings: "seo-settings",
  redirects: "redirects",
  siteSettings: "site-settings",
  navigation: "navigation",
  homeSections: "home-sections",
  skills: "skills",
} as const;

/**
 * Everything a change in the Configuración module can affect.
 *
 * Sent together because they are read together: the layout renders the menu,
 * the footer and the theme script from one page load, so invalidating one and
 * not the others would leave the site briefly disagreeing with itself.
 */
export const configTags: string[] = ["site-settings", "navigation", "home-sections"];

/**
 * Backstop lifetime for every cached read of content, in seconds.
 *
 * Publishing invalidates the tag and the change appears at once; this is what
 * happens when that call does not get through - a wrong PUBLIC_SITE_URL, the
 * site briefly down. Without it a failed invalidation leaves the site stale
 * indefinitely, because `.next/cache` survives even a redeploy.
 *
 * **One hour, and it was five minutes.** Five minutes was the wrong trade, and
 * the usage numbers said so: 38K ISR writes against 25K reads in thirty days,
 * pages regenerated more often than they were served. Crawlers do not run
 * JavaScript, so GA4 never saw the traffic that was causing it — and every
 * regeneration is a full render plus its queries, billed as Active CPU.
 *
 * The backstop does not need to be short, because it is not the path a change
 * takes: publishing invalidates the tag at once, and a notice that fails lands
 * in `system_events` and on the dashboard. One hour cuts regenerations twelve
 * times over. Twenty-four would save only a little more and leave a failed
 * notice — or maintenance mode switched off without the notice arriving — stale
 * for a whole day instead of an hour.
 */
export const CACHE_SECONDS = 3600;

/** Every tag affected by a change to one post. */
export function postTags(slug: string): string[] {
  return [cacheTags.posts, cacheTags.post(slug)];
}
