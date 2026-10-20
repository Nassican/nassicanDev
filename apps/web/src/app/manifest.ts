import type { MetadataRoute } from "next";
import { siteName } from "@/lib/seo";
import { getProfile } from "@/lib/data/profile";
import { getDictionary } from "@/lib/i18n";
import { defaultLocale, htmlLang } from "@/lib/i18n/config";

/**
 * A web app manifest is a single document at the root, so it describes the
 * site in the default language. The `lang` field tells the browser which one.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const profile = await getProfile();
  const t = getDictionary(defaultLocale);

  return {
    name: `${profile.name} - ${t.nav.portfolio}`,
    short_name: siteName,
    description: t.meta.description,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0a0a0a",
    lang: htmlLang[defaultLocale],
    /*
     * Sized copies and not the 1080 px original. Chrome fetches a manifest icon
     * on the first visit, and the original was 355 KB downloading alongside the
     * page on a phone — the heaviest request the home page made.
     */
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
