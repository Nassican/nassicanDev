import { unstable_cache } from "next/cache";
import { db } from "@nassican/db";
import {
  CACHE_SECONDS,
  cacheTags,
  locales,
  type Locale,
  type Localized,
} from "@nassican/shared";

export type SeoSettings = {
  /** `%s · Nassican`; the `%s` is the page's own title. */
  titleTemplate: string | null;
  googleSiteVerification: string | null;
  robotsExtra: string | null;
  defaultOgImageUrl: string | null;
  defaultTitle: Localized<string>;
  defaultDescription: Localized<string>;
  keywords: Localized<string[]>;
};

/**
 * Site-wide SEO, edited in the panel.
 *
 * `siteUrl` is deliberately **not** read from here: it is deployment
 * configuration rather than content. A preview deployment and production serve
 * the same rows, and a canonical pointing at the production domain from a
 * preview is exactly the duplicate-content problem `robots.ts` already guards
 * against. It stays in `NEXT_PUBLIC_SITE_URL`.
 */
async function readSeoSettings(): Promise<SeoSettings | null> {
  const row = await db.seoSettings.findUnique({
    where: { id: 1 },
    include: { translations: true, defaultOgImage: { select: { url: true } } },
  });

  if (!row) return null;

  const pick = <T,>(read: (locale: Locale) => T): Localized<T> =>
    Object.fromEntries(locales.map((l) => [l, read(l)])) as Localized<T>;

  const t = (locale: Locale) => row.translations.find((x) => x.locale === locale);

  return {
    titleTemplate: row.titleTemplate,
    googleSiteVerification: row.googleSiteVerification,
    robotsExtra: row.robotsExtra,
    defaultOgImageUrl: row.defaultOgImage?.url ?? null,
    defaultTitle: pick((l) => t(l)?.defaultTitle ?? ""),
    defaultDescription: pick((l) => t(l)?.defaultDescription ?? ""),
    keywords: pick((l) => ((t(l)?.keywords as string[] | null) ?? [])),
  };
}

export const getSeoSettings = unstable_cache(readSeoSettings, ["seo-settings"], {
  tags: [cacheTags.seoSettings],
  revalidate: CACHE_SECONDS,
});
