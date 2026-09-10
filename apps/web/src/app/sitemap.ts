import type { MetadataRoute } from "next";
import { isIndexableDeployment } from "@nassican/shared";
import { getProfile } from "@/lib/data/profile";
import { getDiscoveryEntries } from "@/lib/data/discovery";
import { getSiteSettings } from "@/lib/data/site-config";
import { absoluteUrl, localeUrl, siteUrl } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isIndexableDeployment(process.env)) return [];
  if ((await getSiteSettings()).maintenanceMode) return [];
  const [entries, profile] = await Promise.all([getDiscoveryEntries(), getProfile()]);
  return [
    ...entries.map((entry) => {
      const languages: Record<string, string> = Object.fromEntries(entries
        .filter((other) => other.path === entry.path)
        .map((other) => [other.locale, localeUrl(other.locale, other.path)]));
      if (languages.es) languages["x-default"] = languages.es;
      return {
        url: localeUrl(entry.locale, entry.path),
        ...(entry.updated ? { lastModified: entry.updated } : {}),
        alternates: { languages },
      };
    }),
    ...profile.cv.filter((cv) => new URL(absoluteUrl(cv.href)).origin === new URL(siteUrl).origin)
      .map((cv) => ({ url: absoluteUrl(cv.href) })),
  ];
}
