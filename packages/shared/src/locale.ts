/**
 * Locale registry, shared by both applications and by the database layer.
 *
 * This is the single source of truth for the language list on the TypeScript
 * side. Postgres has its own `Locale` enum; the two have to move together, so
 * `packages/db` asserts they match.
 */
export const locales = ["es", "en"] as const;

export type Locale = (typeof locales)[number];

/**
 * The default locale is served from the root of the public site (`/`, `/blog`),
 * not from `/es`. The routing that implements that lives in the web app.
 */
export const defaultLocale: Locale = "es";

/** Every translatable value in the content layer is shaped like this. */
export type Localized<T> = Record<Locale, T>;

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/** Name of each language written in that language, for pickers. */
export const localeNames: Record<Locale, string> = {
  es: "Español",
  en: "English",
};

/**
 * True when every locale has a value. The compile-time guarantee that
 * `Localized<T>` used to give is not expressible once content lives in rows,
 * so completeness becomes a check the admin runs before publishing.
 */
export function hasEveryLocale<T>(
  values: ReadonlyArray<{ locale: Locale } & T>,
): boolean {
  return locales.every((locale) => values.some((v) => v.locale === locale));
}

/** The locales still missing from a set of translations. */
export function missingLocales<T>(
  values: ReadonlyArray<{ locale: Locale } & T>,
): Locale[] {
  return locales.filter((locale) => !values.some((v) => v.locale === locale));
}
