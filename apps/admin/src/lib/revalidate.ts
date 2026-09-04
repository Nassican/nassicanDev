import "server-only";

/**
 * Tells the public site to drop the cache entries carrying these tags.
 *
 * The panel and the site are separate Vercel deployments, so `revalidateTag`
 * here would only clear this app's cache. The site exposes `/api/revalidate`
 * for exactly this, authenticated with a secret both sides share.
 *
 * A failure is reported, never thrown: content is already saved by the time
 * this runs, and a cache that clears a few minutes late is a smaller problem
 * than a publish action that appears to have failed.
 */
export async function revalidatePublicSite(
  tags: string[],
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const siteUrl = process.env.PUBLIC_SITE_URL;
  const secret = process.env.REVALIDATE_SECRET;

  if (!siteUrl || !secret) {
    return { ok: false, reason: "PUBLIC_SITE_URL o REVALIDATE_SECRET sin definir" };
  }

  try {
    const response = await fetch(new URL("/api/revalidate", siteUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ tags }),
      cache: "no-store",
    });

    if (!response.ok) {
      return { ok: false, reason: `el sitio respondió ${response.status}` };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "fallo de red" };
  }
}
