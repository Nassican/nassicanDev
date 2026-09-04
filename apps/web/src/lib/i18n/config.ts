/**
 * Locale routing for the public site.
 *
 * The registry itself - `locales`, `Locale`, `Localized<T>` - lives in
 * `@nassican/shared` so the admin and the database layer agree with this app on
 * what a language is. It is re-exported here because every component in this
 * app already imports it from this path, and because the routing helpers below
 * are the only part of it the public site cares about.
 */
export {
  locales,
  defaultLocale,
  localeNames,
  isLocale,
  type Locale,
  type Localized,
} from "@nassican/shared";

import { locales, defaultLocale, type Locale } from "@nassican/shared";

/** Value used for `<html lang>` and OpenGraph `locale`. */
export const htmlLang: Record<Locale, string> = {
  es: "es",
  en: "en",
};

export const openGraphLocale: Record<Locale, string> = {
  es: "es_CO",
  en: "en_US",
};

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
