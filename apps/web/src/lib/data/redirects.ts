import { unstable_cache } from "next/cache";
import { db } from "@nassican/db";
import { CACHE_SECONDS, cacheTags } from "@nassican/shared";

export type SiteRedirect = {
  id: string;
  destination: string;
  statusCode: number;
};

/**
 * Redirects are resolved where a URL would otherwise 404, not in the proxy.
 *
 * The proxy runs on the edge and cannot reach Prisma, and consulting a table on
 * every single request to pay for the rare old URL would be the wrong trade.
 * A redirect only ever matters for a path that no longer exists, and that path
 * already ends up in the catch-all - so that is where it is answered.
 */
export const findRedirect = (source: string) =>
  unstable_cache(
    async (): Promise<SiteRedirect | null> => {
      const row = await db.redirect.findFirst({
        where: { source, isEnabled: true },
        select: { id: true, destination: true, statusCode: true },
      });
      return row;
    },
    ["redirect", source],
    { tags: [cacheTags.redirects], revalidate: CACHE_SECONDS },
  )();

/**
 * Counts a redirect as followed. Deliberately fire-and-forget: the visitor is
 * already on their way, and a slow write must never hold up the response.
 * `hits` is what later shows which redirects nobody follows any more.
 */
export function recordRedirectHit(id: string): void {
  void db.redirect
    .update({
      where: { id },
      data: { hits: { increment: 1 }, lastHitAt: new Date() },
    })
    .catch(() => undefined);
}
