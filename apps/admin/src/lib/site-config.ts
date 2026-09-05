import "server-only";

import { db } from "@nassican/db";
import {
  defaultSiteSettings,
  homeSectionKeys,
  isHomeSectionKey,
  locales,
  type HomeSectionKey,
  type Locale,
  type NavKind,
  type SiteSettings,
} from "@nassican/shared";
import type {
  ConfigDraft,
  NavArea,
  NavColumnDraft,
  NavDraft,
  NavItemDraft,
  SectionDraft,
} from "@/lib/site-config-draft";

export * from "@/lib/site-config-draft";

/**
 * The menu the site shipped with, in both languages.
 *
 * Seeded on first visit rather than by a migration, for the same reason the
 * system pages are: it keeps the starting point next to the code it mirrors,
 * and it means turning the menu into data changes nothing the day it happens.
 * These labels came out of `dictionaries/es.ts` and `en.ts`, which stop being
 * the source for the menu once the rows exist.
 */
const seed: {
  area: NavArea;
  kind: NavKind;
  target: string;
  es: string;
  en: string;
  children?: { kind: NavKind; target: string; es: string; en: string }[];
}[] = [
  { area: "header", kind: "section", target: "about", es: "Sobre mí", en: "About" },
  { area: "header", kind: "section", target: "skills", es: "Tecnologías", en: "Tech stack" },
  { area: "header", kind: "route", target: "/projects", es: "Proyectos", en: "Projects" },
  { area: "header", kind: "route", target: "/blog", es: "Blog", en: "Blog" },
  { area: "header_cta", kind: "section", target: "contact", es: "Contacto", en: "Contact" },
  {
    area: "footer",
    kind: "section",
    target: "",
    es: "Contenido",
    en: "Content",
    children: [
      { kind: "route", target: "/projects", es: "Proyectos", en: "Projects" },
      { kind: "route", target: "/blog", es: "Blog", en: "Blog" },
      { kind: "section", target: "skills", es: "Tecnologías", en: "Tech stack" },
    ],
  },
  {
    area: "footer",
    kind: "section",
    target: "",
    es: "Trayectoria",
    en: "Background",
    children: [
      { kind: "section", target: "experience", es: "Experiencia", en: "Experience" },
      { kind: "section", target: "education", es: "Educación", en: "Education" },
      { kind: "route", target: "/certificates", es: "Certificados", en: "Certificates" },
    ],
  },
  {
    area: "footer",
    kind: "section",
    target: "",
    es: "Más",
    en: "More",
    children: [
      { kind: "section", target: "about", es: "Sobre mí", en: "About" },
      { kind: "section", target: "contact", es: "Contacto", en: "Contact" },
    ],
  },
];

/**
 * Creates the rows the site needs the first time the module is opened.
 *
 * Safe to call on every render: it writes only what is missing. An empty menu
 * is what a fresh database has, not what an operator asked for, so seeding is
 * the correct reading of it - but a menu someone emptied on purpose stays
 * empty, because only a completely absent menu is seeded.
 */
export async function ensureConfig(): Promise<void> {
  await db.siteSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  const sections = await db.homeSection.count();
  if (sections === 0) {
    await db.homeSection.createMany({
      data: homeSectionKeys.map((key, position) => ({ key, position })),
      skipDuplicates: true,
    });
  }

  const items = await db.navigationItem.count();
  if (items > 0) return;

  for (const [position, entry] of seed.entries()) {
    const created = await db.navigationItem.create({
      data: {
        location: entry.area,
        kind: entry.children ? "section" : entry.kind,
        href: entry.target || null,
        position,
        translations: {
          create: locales.map((locale) => ({
            locale,
            label: locale === "en" ? entry.en : entry.es,
          })),
        },
      },
    });

    for (const [childPosition, child] of (entry.children ?? []).entries()) {
      await db.navigationItem.create({
        data: {
          location: "footer",
          parentId: created.id,
          kind: child.kind,
          href: child.target,
          position: childPosition,
          translations: {
            create: locales.map((locale) => ({
              locale,
              label: locale === "en" ? child.en : child.es,
            })),
          },
        },
      });
    }
  }
}

type ItemRow = {
  id: string;
  location: string;
  parentId: string | null;
  kind: string;
  href: string | null;
  pageId: string | null;
  position: number;
  isVisible: boolean;
  translations: { locale: Locale; label: string }[];
};

function toDraft(row: ItemRow): NavItemDraft {
  const kind = (["section", "route", "external", "page"] as const).includes(
    row.kind as NavKind,
  )
    ? (row.kind as NavKind)
    : "section";

  return {
    id: row.id,
    area: (row.location === "header" || row.location === "header_cta"
      ? row.location
      : "footer") as NavArea,
    parentId: row.parentId,
    kind,
    target: kind === "page" ? (row.pageId ?? "") : (row.href ?? ""),
    position: row.position,
    isVisible: row.isVisible,
    labels: Object.fromEntries(
      locales.map((locale) => [
        locale,
        row.translations.find((t) => t.locale === locale)?.label ?? "",
      ]),
    ) as Record<Locale, string>,
  };
}

export async function getConfigDraft(): Promise<ConfigDraft> {
  await ensureConfig();

  const [row, items, sectionRows, pages] = await Promise.all([
    db.siteSettings.findUnique({ where: { id: 1 } }),
    db.navigationItem.findMany({
      orderBy: { position: "asc" },
      include: { translations: true },
    }),
    db.homeSection.findMany({ orderBy: { position: "asc" } }),
    db.page.findMany({
      where: { kind: "custom" },
      include: { translations: true },
      orderBy: { route: "asc" },
    }),
  ]);

  const drafts = items.map(toDraft);

  const nav: NavDraft = {
    header: drafts.filter((i) => i.area === "header" && !i.parentId),
    cta: drafts.find((i) => i.area === "header_cta") ?? null,
    footer: drafts
      .filter((i) => i.area === "footer" && !i.parentId)
      .map<NavColumnDraft>((column) => ({
        column,
        items: drafts.filter((i) => i.parentId === column.id),
      })),
  };

  // A key the database does not know about is still a section that renders, so
  // it belongs in the list the panel shows.
  const known = new Map(
    sectionRows.filter((r) => isHomeSectionKey(r.key)).map((r) => [r.key, r]),
  );
  const sections: SectionDraft[] = homeSectionKeys
    .map((key, index) => ({
      key: key as HomeSectionKey,
      position: known.get(key)?.position ?? 1000 + index,
      isVisible: known.get(key)?.isVisible ?? true,
    }))
    .sort((a, b) => a.position - b.position);

  const settings: SiteSettings = row
    ? {
        defaultTheme: row.defaultTheme === "light" ? "light" : "dark",
        timezone: row.timezone,
        maintenanceMode: row.maintenanceMode,
        brandLine: row.brandLine,
        copyrightName: row.copyrightName,
        latestPostsCount: row.latestPostsCount,
        showSectionNavigator: row.showSectionNavigator,
      }
    : defaultSiteSettings;

  return {
    settings,
    nav,
    sections,
    pages: pages.map((page) => ({
      id: page.id,
      route: page.route,
      label: page.translations.find((t) => t.title)?.title ?? page.route,
    })),
  };
}

/** The timezone every daily rollup buckets by. */
export async function getTimezone(): Promise<string> {
  const row = await db.siteSettings.findUnique({
    where: { id: 1 },
    select: { timezone: true },
  });
  return row?.timezone ?? defaultSiteSettings.timezone;
}
