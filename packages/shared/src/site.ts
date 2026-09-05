import type { Locale } from "./locale";

/**
 * The homepage sections, in the order they shipped.
 *
 * The list lives here because both applications need it and neither owns it:
 * the site maps a key to a component, the panel offers the same keys to
 * reorder. A key that exists in one and not the other is a section that
 * silently disappears, so there is exactly one list.
 */
export const homeSectionKeys = [
  "hero",
  "about",
  "skills",
  "experience",
  "education",
  "projects",
  "blog",
  "contact",
] as const;

export type HomeSectionKey = (typeof homeSectionKeys)[number];

export function isHomeSectionKey(value: string): value is HomeSectionKey {
  return (homeSectionKeys as readonly string[]).includes(value);
}

/**
 * Sections a link can point at. `hero` is missing on purpose: it renders no
 * `id`, so `#hero` would scroll nowhere.
 */
export const anchoredSectionKeys = homeSectionKeys.filter(
  (key): key is Exclude<HomeSectionKey, "hero"> => key !== "hero",
);

export type HomeSectionOrder = {
  key: HomeSectionKey;
  position: number;
  isVisible: boolean;
};

/** Where a navigation link points. Mirrors the `LinkKind` enum in Postgres. */
export type NavKind = "section" | "route" | "external" | "page";

export type NavLink = {
  id: string;
  kind: NavKind;
  /**
   * A section key, an unprefixed site path, or an absolute URL, depending on
   * `kind`. It is never a finished href: the locale prefix and, for a section,
   * whether the visitor is already on the homepage both decide that at render
   * time.
   */
  target: string;
  label: string;
  ariaLabel: string | null;
};

export type NavColumn = { id: string; label: string; items: NavLink[] };

/**
 * The whole menu, already resolved for one language.
 *
 * The call to action is its own field rather than the last header link: it is
 * a different control with different styling, and "the last one is special" is
 * the kind of rule that breaks the first time someone reorders the menu.
 */
export type NavTree = {
  header: NavLink[];
  cta: NavLink | null;
  footer: NavColumn[];
};

export const emptyNavTree: NavTree = { header: [], cta: null, footer: [] };

/** Site-wide settings the public site reads on every render. */
export type SiteSettings = {
  defaultTheme: "dark" | "light";
  timezone: string;
  maintenanceMode: boolean;
  brandLine: string;
  copyrightName: string;
  latestPostsCount: number;
  showSectionNavigator: boolean;
};

export const defaultSiteSettings: SiteSettings = {
  defaultTheme: "dark",
  timezone: "America/Bogota",
  maintenanceMode: false,
  brandLine: "Nassican Group",
  copyrightName: "Nassican",
  latestPostsCount: 2,
  showSectionNavigator: true,
};

/**
 * Today's date in a timezone, as `YYYY-MM-DD`.
 *
 * Bucketing by UTC files an evening in Bogotá under tomorrow, which turns a
 * daily snapshot into a chart with a hole and a double. `en-CA` is the shortest
 * route to ISO order out of `Intl`.
 */
export function calendarDate(timezone: string, at: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(at);
  } catch {
    // An unknown zone must not stop a snapshot from being taken.
    return at.toISOString().slice(0, 10);
  }
}

export type { Locale };
