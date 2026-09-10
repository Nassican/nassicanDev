import { locales, type Locale } from "@nassican/shared";

export type DiscoveryEntry = {
  path: string;
  locale: Locale;
  title?: string;
  description?: string;
  updated?: string;
};

type Page = {
  route: string;
  kind: "custom" | "system";
  translations: { locale: Locale; title: string; seoDescription: string | null; noindex: boolean; updatedAt: Date }[];
};
type Content = { slug: string; date: string; updated?: string; content: Record<Locale, { seo: { noindex: boolean } }> };

/** Publication filtering happens in the readers; discovery filters indexability. */
export function buildDiscoveryEntries(pages: Page[], posts: Content[], projects: Content[]): DiscoveryEntry[] {
  const entries: DiscoveryEntry[] = [];
  const add = (path: string, locale: Locale, noindex = false, updated?: string) => {
    const page = pages.find((p) => p.route === path);
    const translation = page?.translations.find((t) => t.locale === locale);
    if (noindex || translation?.noindex || (page?.kind === "custom" && !translation)) return;
    entries.push({ path, locale, title: translation?.title, description: translation?.seoDescription ?? undefined, updated });
  };
  for (const locale of locales) {
    for (const path of ["/", "/blog", "/projects", "/certificates"]) add(path, locale);
    for (const post of posts) add(`/blog/${post.slug}`, locale, post.content[locale].seo.noindex, post.updated ?? post.date);
    for (const project of projects) add(`/projects/${project.slug}`, locale, project.content[locale].seo.noindex, project.updated);
    for (const page of pages.filter((p) => p.kind === "custom")) {
      if (entries.some((e) => e.path === page.route && e.locale === locale)) continue;
      const t = page.translations.find((t) => t.locale === locale);
      add(page.route, locale, t?.noindex, t?.updatedAt.toISOString());
    }
  }
  return entries;
}
