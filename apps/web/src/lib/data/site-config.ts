import { unstable_cache } from "next/cache";
import { db } from "@nassican/db";
import {
  CACHE_SECONDS,
  cacheTags,
  defaultSiteSettings,
  emptyNavTree,
  homeSectionKeys,
  isHomeSectionKey,
  locales,
  type HomeSectionKey,
  type HomeSectionOrder,
  type Locale,
  type NavKind,
  type NavLink,
  type NavTree,
  type SiteSettings,
} from "@nassican/shared";

/**
 * Site-wide settings.
 *
 * Falls back to the shipped defaults rather than throwing when the row is
 * missing: this is read on every render of every page, and a site that refuses
 * to serve because nobody has opened the panel yet would be a worse answer
 * than the one it had before the module existed.
 */
async function readSiteSettings(): Promise<SiteSettings> {
  const row = await db.siteSettings.findUnique({ where: { id: 1 } });
  if (!row) return defaultSiteSettings;

  return {
    defaultTheme: row.defaultTheme === "light" ? "light" : "dark",
    timezone: row.timezone,
    maintenanceMode: row.maintenanceMode,
    brandLine: row.brandLine,
    copyrightName: row.copyrightName,
    latestPostsCount: row.latestPostsCount,
    showSectionNavigator: row.showSectionNavigator,
  };
}

export const getSiteSettings = unstable_cache(readSiteSettings, ["site-settings"], {
  tags: [cacheTags.siteSettings],
  revalidate: CACHE_SECONDS,
});

/**
 * The homepage section order.
 *
 * A key the database does not know about is appended rather than dropped, so
 * adding a section to the code puts it on the page before anyone opens the
 * panel. A key the database knows and the code does not is ignored the same
 * way - the components are the ones that exist.
 */
async function readHomeSections(): Promise<HomeSectionOrder[]> {
  const rows = await db.homeSection.findMany({ orderBy: { position: "asc" } });
  const known = new Map(rows.filter((r) => isHomeSectionKey(r.key)).map((r) => [r.key, r]));

  return homeSectionKeys.map((key, index) => {
    const row = known.get(key);
    return {
      key: key as HomeSectionKey,
      position: row?.position ?? 1000 + index,
      isVisible: row?.isVisible ?? true,
    };
  }).sort((a, b) => a.position - b.position);
}

export const getHomeSections = unstable_cache(readHomeSections, ["home-sections"], {
  tags: [cacheTags.homeSections],
  revalidate: CACHE_SECONDS,
});

const navKind = (kind: string): NavKind =>
  kind === "route" || kind === "external" || kind === "page" ? kind : "section";

/**
 * The menu for one language.
 *
 * An item with no label in this language is skipped rather than rendered
 * blank; the panel refuses to save one, so seeing it here means a row was
 * written some other way.
 */
async function readNavigation(locale: Locale): Promise<NavTree> {
  const rows = await db.navigationItem.findMany({
    where: { isVisible: true },
    orderBy: { position: "asc" },
    include: {
      translations: { where: { locale } },
      page: { select: { route: true } },
    },
  });

  const link = (row: (typeof rows)[number]): NavLink | null => {
    const label = row.translations[0]?.label?.trim();
    if (!label) return null;

    const kind = navKind(row.kind);
    const target = kind === "page" ? (row.page?.route ?? "") : (row.href ?? "");
    if (!target) return null;

    return {
      id: row.id,
      kind,
      target,
      label,
      ariaLabel: row.translations[0]?.ariaLabel?.trim() || null,
    };
  };

  const header: NavLink[] = [];
  let cta: NavLink | null = null;
  const footer: NavTree["footer"] = [];

  for (const row of rows) {
    if (row.parentId) continue;

    if (row.location === "header") {
      const item = link(row);
      if (item) header.push(item);
      continue;
    }

    if (row.location === "header_cta") {
      // First one wins: the header has room for one call to action, and
      // silently stacking two would be worse than ignoring the extra.
      cta ??= link(row);
      continue;
    }

    const label = row.translations[0]?.label?.trim();
    if (!label) continue;

    const items = rows
      .filter((child) => child.parentId === row.id)
      .map(link)
      .filter((item): item is NavLink => item !== null);

    if (items.length > 0) footer.push({ id: row.id, label, items });
  }

  return { header, cta, footer };
}

/**
 * One cache entry per language, because the labels are resolved before the
 * tree is stored - the alternative is caching every label in every language
 * and throwing most of them away on each render.
 */
const navigationByLocale = Object.fromEntries(
  locales.map((locale) => [
    locale,
    unstable_cache(() => readNavigation(locale), ["navigation", locale], {
      tags: [cacheTags.navigation],
      revalidate: CACHE_SECONDS,
    }),
  ]),
) as Record<Locale, () => Promise<NavTree>>;

export async function getNavigation(locale: Locale): Promise<NavTree> {
  return (await navigationByLocale[locale]?.()) ?? emptyNavTree;
}
