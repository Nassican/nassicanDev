import type { ContentBlock, Locale } from "@nassican/shared";

/**
 * Shapes for the Pages module, free of database imports so the client editor
 * can use them.
 */
export type PageTranslationDraft = {
  locale: Locale;
  title: string;
  body: ContentBlock[];
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
  noindex: boolean;
};

export type PageDraft = {
  id: string;
  kind: "system" | "custom";
  route: string;
  status: "draft" | "scheduled" | "published" | "archived";
  sitemapPriority: number | null;
  sitemapChangefreq: string;
  translations: PageTranslationDraft[];
};

/**
 * A `system` page is a route that already exists in code; only its SEO is
 * editable and it can never be unpublished from here. A `custom` page is
 * authored in the panel and needs a title and a body to be worth publishing.
 */
export function isSystem(page: PageDraft): boolean {
  return page.kind === "system";
}

export function incompleteLocales(
  page: PageDraft,
  locales: readonly Locale[],
): Locale[] {
  if (isSystem(page)) return [];
  return locales.filter((l) => {
    const t = page.translations.find((x) => x.locale === l);
    return !t?.title.trim() || t.body.length === 0;
  });
}

/** Routes are paths, not slugs: they start with a slash and have no locale. */
export function normaliseRoute(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9/-]/g, "")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");

  if (!cleaned || cleaned === "/") return "/";
  return cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
}
