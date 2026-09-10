import { buildRobots, defaultCrawlSettings, isIndexableDeployment } from "@nassican/shared";
import { getSeoSettings } from "@/lib/data/seo-settings";
import { siteUrl } from "@/lib/seo";

export async function GET() {
  const indexable = isIndexableDeployment(process.env);
  const settings = indexable ? await getSeoSettings() : null;
  return new Response(buildRobots(siteUrl, settings ?? defaultCrawlSettings, indexable, settings?.robotsExtra ?? ""), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
