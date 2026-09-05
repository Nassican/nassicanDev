import { unstable_cache } from "next/cache";
import { db } from "@nassican/db";
import {
  CACHE_SECONDS,
  cacheTags,
  type ContentBlock,
  type Locale,
} from "@nassican/shared";

/**
 * Two different things share the `pages` table, told apart by `kind`:
 *
 *   - `system`: a route that already exists in `app/[locale]/`. Only its SEO
 *     is editable; the page itself is code.
 *   - `custom`: a page created in the panel, with a body, rendered by the
 *     catch-all route.
 *
 * Keeping them in one table is what lets the panel show a single list of "the
 * pages this site has", which is how someone thinks about it.
 */
export type PageSeoOverride = {
  title?: string;
  description?: string;
  keywords?: string[];
  noindex: boolean;
};

export type CustomPage = {
  route: string;
  title: string;
  body: ContentBlock[];
  seo: PageSeoOverride;
};

/**
 * SEO overrides for one route. Returns null when nothing is overridden, so a
 * page that was never touched in the panel costs nothing and behaves exactly
 * as it did before this module existed.
 */
export const getPageSeo = (route: string, locale: Locale) =>
  unstable_cache(
    async (): Promise<PageSeoOverride | null> => {
      const row = await db.pageTranslation.findFirst({
        where: { locale, page: { route, status: "published" } },
        select: {
          seoTitle: true,
          seoDescription: true,
          keywords: true,
          noindex: true,
        },
      });

      if (!row) return null;
      if (!row.seoTitle && !row.seoDescription && !row.noindex && !row.keywords) {
        return null;
      }

      return {
        title: row.seoTitle ?? undefined,
        description: row.seoDescription ?? undefined,
        keywords: (row.keywords as string[] | null) ?? undefined,
        noindex: row.noindex,
      };
    },
    ["page-seo", route, locale],
    { tags: [cacheTags.pages, cacheTags.page(route)], revalidate: CACHE_SECONDS },
  )();

/** A panel-authored page, or undefined when the route is not one. */
export const getCustomPage = (route: string, locale: Locale) =>
  unstable_cache(
    async (): Promise<CustomPage | null> => {
      const page = await db.page.findFirst({
        where: { route, kind: "custom", status: "published" },
        include: { translations: { where: { locale } } },
      });

      const t = page?.translations[0];
      if (!page || !t) return null;

      return {
        route: page.route,
        title: t.title,
        body: (t.body as ContentBlock[] | null) ?? [],
        seo: {
          title: t.seoTitle ?? undefined,
          description: t.seoDescription ?? undefined,
          keywords: (t.keywords as string[] | null) ?? undefined,
          noindex: t.noindex,
        },
      };
    },
    ["custom-page", route, locale],
    { tags: [cacheTags.pages, cacheTags.page(route)], revalidate: CACHE_SECONDS },
  )();

/** Routes of every published custom page, for static generation and sitemap. */
export const getCustomPageRoutes = unstable_cache(
  async (): Promise<string[]> => {
    const rows = await db.page.findMany({
      where: { kind: "custom", status: "published" },
      select: { route: true },
      orderBy: { position: "asc" },
    });
    return rows.map((r) => r.route);
  },
  ["custom-page-routes"],
  { tags: [cacheTags.pages], revalidate: CACHE_SECONDS },
);
