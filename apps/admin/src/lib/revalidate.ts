import "server-only";

import { after } from "next/server";
import { db, prismaJson } from "@nassican/db";

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
 *
 * Callers want `notifyPublicSite` below; this is the part that does the work.
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
      /**
       * Never follow the redirect. `fetch` strips `Authorization` when a
       * redirect crosses origins, so pointing this at an apex domain that
       * redirects to `www` produces a 401 that looks like a wrong secret and
       * is anything but. Catching the redirect here turns a confusing failure
       * into a message that names the fix.
       */
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      const target = response.headers.get("location") ?? "otro dominio";
      return {
        ok: false,
        reason: `PUBLIC_SITE_URL redirige a ${target}; apúntalo ahí directamente`,
      };
    }

    if (response.status === 401) {
      return { ok: false, reason: "REVALIDATE_SECRET no coincide con el del sitio" };
    }

    if (!response.ok) {
      return { ok: false, reason: `el sitio respondió ${response.status}` };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "fallo de red" };
  }
}

/**
 * The same call, moved out of the way of the answer.
 *
 * Waiting for it cost every save between 150 ms and 1.5 s - the round trip to
 * Vercel, plus a cold function when the site had been quiet. None of that
 * changes what was saved, so `after()` runs it once the response is already on
 * its way.
 *
 * The failure is not lost, it moves: it lands in `system_events`, where the
 * Sistema module lists it. That is the right home for it anyway. A cache that
 * did not clear is a problem with the deployment, not with the thing the
 * operator just saved, and telling them about it inside a success message was
 * always slightly the wrong place.
 */
export function notifyPublicSite(tags: string[]): void {
  after(async () => {
    const result = await revalidatePublicSite(tags);
    if (result.ok) return;

    try {
      await db.systemEvent.create({
        data: {
          level: "warn",
          source: "revalidate",
          message: result.reason,
          context: prismaJson.record({ tags }),
        },
      });
    } catch {
      // Nowhere left to report to; the console is what the platform keeps.
      console.error("no se pudo avisar al sitio ni registrarlo:", result.reason);
    }
  });
}
