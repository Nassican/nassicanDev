import { unstable_cache } from "next/cache";
import { db } from "@nassican/db";
import { cacheTags, locales, type Locale, type Localized } from "@nassican/shared";

export type CvFile = {
  /** ISO 639-1 code, used for hrefLang and the schema's inLanguage. */
  lang: string;
  label: Localized<string>;
  href: string;
};

export type SocialLink = {
  label: string;
  href: string;
};

export type Profile = {
  name: string;
  title: Localized<string>;
  email: string;
  location: { city: string; region: string; country: string };
  socials: SocialLink[];
  /** Downloadable CV, one file per language. */
  cv: CvFile[];
};

/**
 * The profile comes from the database, edited in the panel.
 *
 * The shape is unchanged from when it was a module, so every component that
 * reads `profile.name` or `profile.socials` reads the same thing - what
 * changed is that it now has to be awaited.
 */
async function readProfile(): Promise<Profile> {
  const row = await db.profile.findUnique({
    where: { id: 1 },
    include: {
      translations: true,
      cvs: { include: { translations: true }, orderBy: { position: "asc" } },
    },
  });

  if (!row) {
    // Failing loudly beats rendering a portfolio with nobody's name on it.
    throw new Error(
      "No hay fila de perfil en la base de datos. Ejecuta: npm run profile:import",
    );
  }

  const localized = <T,>(pick: (locale: Locale) => T): Localized<T> =>
    Object.fromEntries(locales.map((l) => [l, pick(l)])) as Localized<T>;

  return {
    name: row.fullName,
    title: localized(
      (l) => row.translations.find((t) => t.locale === l)?.headline ?? "",
    ),
    email: row.email,
    location: (row.location ?? {}) as Profile["location"],
    socials: ((row.socials as { items?: SocialLink[] } | null)?.items ?? []),
    cv: row.cvs.map((cv) => ({
      lang: cv.lang,
      href: cv.href,
      label: localized(
        (l) => cv.translations.find((t) => t.locale === l)?.label ?? "",
      ),
    })),
  };
}

export const getProfile = unstable_cache(readProfile, ["profile"], {
  tags: [cacheTags.profile],
});
