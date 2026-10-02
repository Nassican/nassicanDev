import { headers } from "next/headers";
import {
  buildRobots,
  defaultCrawlSettings,
  isCanonicalHost,
  isIndexableDeployment,
} from "@nassican/shared";
import { getSeoSettings } from "@/lib/data/seo-settings";
import { siteUrl } from "@/lib/seo";

/**
 * Reads the request host, so this route cannot be cached across hostnames —
 * which is the point: the same deployment must answer differently at
 * `www.nassican.com` and at a `*.vercel.app` URL.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const headerList = await headers();
  // `x-forwarded-host` is what the proxy saw the visitor ask for; `host` is the
  // fallback for a direct request.
  const requestHost =
    headerList.get("x-forwarded-host") ?? headerList.get("host");

  const indexable =
    isIndexableDeployment(process.env) && isCanonicalHost(requestHost, siteUrl);
  const settings = indexable ? await getSeoSettings() : null;
  return new Response(buildRobots(siteUrl, settings ?? defaultCrawlSettings, indexable, settings?.robotsExtra ?? ""), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
