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

/** Every tag affected by a change to one post. */
export function postTags(slug: string): string[] {
  return [cacheTags.posts, cacheTags.post(slug)];
}
