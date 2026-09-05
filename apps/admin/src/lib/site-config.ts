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
 * Creates whatever of the three the database does not have yet.
 *
 * Takes what was already read rather than counting rows itself: seeding is a
 * first-visit event, and three extra round trips on every render afterwards to
 * re-confirm it is the kind of cost that hides in plain sight. Only a
 * *completely* absent menu is seeded, so one that someone emptied on purpose
 * stays empty.
 *
 * Returns whether it wrote anything, which is what tells the caller to read
 * again.
 */
async function seedMissing(has: {
  settings: boolean;
  sections: boolean;
  items: boolean;
}): Promise<boolean> {
  if (has.settings && has.sections && has.items) return false;

  if (!has.settings) {
    await db.siteSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  }

  if (!has.sections) {
    await db.homeSection.createMany({
      data: homeSectionKeys.map((key, position) => ({ key, position })),
      skipDuplicates: true,
    });
  }

  if (has.items) return true;

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

  return true;
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
  const read = () =>
    Promise.all([
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

  let [row, items, sectionRows, pages] = await read();

  // Read first, seed only if something was missing. After the first visit this
  // costs nothing at all.
  const seeded = await seedMissing({
    settings: row !== null,
    sections: sectionRows.length > 0,
    items: items.length > 0,
  });
  if (seeded) [row, items, sectionRows, pages] = await read();

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
