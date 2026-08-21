/**
 * Locale registry. Everything else in the app derives from this list, so
 * adding a language means adding it here, adding its dictionary, and letting
 * TypeScript point at every `Localized<T>` that is still missing a value.
 */
export const locales = ["es", "en"] as const;

export type Locale = (typeof locales)[number];

/**
 * The default locale is served from the root of the site (`/`, `/blog`), not
 * from `/es`. `proxy.ts` rewrites those paths onto the `[locale]` segment and
 * redirects `/es/*` back to the root so only one URL per page is indexable.
 */
export const defaultLocale: Locale = "es";

/** Value used for `<html lang>` and OpenGraph `locale`. */
export const htmlLang: Record<Locale, string> = {
  es: "es",
  en: "en",
};

export const openGraphLocale: Record<Locale, string> = {
  es: "es_CO",
  en: "en_US",
};

/** Name of each language written in that language, for the switcher. */
export const localeNames: Record<Locale, string> = {
  es: "Español",
  en: "English",
};

/** Every translatable value in the content layer is shaped like this. */
export type Localized<T> = Record<Locale, T>;

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/** `/en` for prefixed locales, `""` for the default one. */
export function localePrefix(locale: Locale): string {
  return locale === defaultLocale ? "" : `/${locale}`;
}

/**
 * Builds a locale-aware href from a canonical, unprefixed path.
 * `localePath("en", "/blog")` -> `/en/blog`; `localePath("es", "/")` -> `/`.
 */
export function localePath(locale: Locale, path = "/"): string {
  const normalized = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  return `${localePrefix(locale)}${normalized}` || "/";
}

/**
 * Strips the locale prefix from a pathname, giving back the canonical path.
 * Used by the language switcher to stay on the same page.
 *
 * The default locale is stripped too, even though its URLs never show the
 * prefix: on a fresh document load of a rewritten path, `usePathname()`
 * reports the internal `/es/...` form rather than the visible `/...` one.
 * Treating both as the same page is what keeps the switcher from building
 * `/en/es/blog`.
 */
export function stripLocale(pathname: string): string {
  for (const locale of locales) {
    if (pathname === `/${locale}`) return "/";
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1);
  }
  return pathname || "/";
}

/** Reads the locale a pathname belongs to, prefixed or not. */
export function localeFromPathname(pathname: string): Locale {
  for (const locale of locales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) return locale;
  }
  return defaultLocale;
}
