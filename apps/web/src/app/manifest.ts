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
    icons: [
      {
        src: "/brand/LogoNassican.png",
        sizes: "any",
        type: "image/png",
      },
    ],
  };
}
