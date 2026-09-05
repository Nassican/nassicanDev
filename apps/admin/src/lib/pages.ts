import "server-only";

import { db } from "@nassican/db";
import { locales, type ContentBlock, type Locale } from "@nassican/shared";
import type { PageDraft, PageTranslationDraft } from "@/lib/page-draft";

export * from "@/lib/page-draft";

/**
 * The routes that exist as code under `app/[locale]/`. They are seeded on first
 * visit rather than by a migration, so adding a route to the site means adding
 * it here and nothing else - and the panel never shows a page that does not
 * exist.
 */
export const systemRoutes: { route: string; label: string }[] = [
  { route: "/", label: "Portada" },
  { route: "/projects", label: "Proyectos" },
  { route: "/blog", label: "Blog" },
  { route: "/certificates", label: "Certificados" },
];

function emptyTranslation(locale: Locale): PageTranslationDraft {
  return {
    locale,
    title: "",
    body: [],
    seoTitle: "",
    seoDescription: "",
    keywords: [],
    noindex: false,
  };
}

type Row = {
  id: string;
  kind: "system" | "custom";
  route: string;
  status: PageDraft["status"];
  sitemapPriority: number | null;
  sitemapChangefreq: string | null;
  translations: {
    locale: Locale;
    title: string;
    body: unknown;
    seoTitle: string | null;
    seoDescription: string | null;
    keywords: unknown;
    noindex: boolean;
  }[];
};

function toDraft(row: Row): PageDraft {
  return {
    id: row.id,
    kind: row.kind,
    route: row.route,
    status: row.status,
    sitemapPriority: row.sitemapPriority,
    sitemapChangefreq: row.sitemapChangefreq ?? "",
    translations: locales.map((locale) => {
      const t = row.translations.find((x) => x.locale === locale);
      if (!t) return emptyTranslation(locale);
      return {
        locale,
        title: t.title,
        body: (t.body as ContentBlock[] | null) ?? [],
        seoTitle: t.seoTitle ?? "",
        seoDescription: t.seoDescription ?? "",
        keywords: (t.keywords as string[] | null) ?? [],
        noindex: t.noindex,
      };
    }),
  };
}

/** Creates any system page that does not exist yet, then lists everything. */
export async function listPages(): Promise<PageDraft[]> {
  const existing = await db.page.findMany({ select: { route: true } });
  const known = new Set(existing.map((p) => p.route));

  const missing = systemRoutes.filter((r) => !known.has(r.route));
  if (missing.length > 0) {
    for (const [index, { route, label }] of missing.entries()) {
      const page = await db.page.create({
        data: {
          kind: "system",
          route,
          status: "published",
          position: index,
        },
      });
      for (const locale of locales) {
        await db.pageTranslation.create({
          data: { pageId: page.id, locale, title: label },
        });
      }
    }
  }

  const rows = await db.page.findMany({
    include: { translations: true },
    orderBy: [{ kind: "asc" }, { position: "asc" }, { route: "asc" }],
  });

  return rows.map((row) => toDraft(row as unknown as Row));
}

export async function getPageDraft(id: string): Promise<PageDraft | null> {
  const row = await db.page.findUnique({
    where: { id },
    include: { translations: true },
  });
  return row ? toDraft(row as unknown as Row) : null;
}
