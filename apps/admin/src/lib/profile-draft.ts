import type { Locale } from "@nassican/shared";

/**
 * Shapes for the profile module, free of database imports so the client
 * editors can use them.
 *
 * Every list is edited and saved whole rather than row by row: these are short,
 * hand-curated lists, and replacing the set is simpler to reason about than a
 * per-row create/update/delete dance.
 */
export type LocalizedText = Record<Locale, string>;

export type SocialDraft = { label: string; href: string };

export type CvDraft = {
  lang: string;
  href: string;
  label: LocalizedText;
};

export type ProfileDraft = {
  name: string;
  email: string;
  location: { city: string; region: string; country: string };
  headline: LocalizedText;
  socials: SocialDraft[];
  cvs: CvDraft[];
};

export type ExperienceDraft = {
  id: string | null;
  org: string;
  start: string;
  end: string;
  stack: string[];
  title: LocalizedText;
  period: LocalizedText;
  description: LocalizedText;
};

export type EducationDraft = {
  id: string | null;
  org: string;
  start: string;
  end: string;
  status: "completed" | "in-progress";
  link: string;
  degree: LocalizedText;
  period: LocalizedText;
  description: LocalizedText;
};

export type CertificateDraft = {
  id: string | null;
  provider: string;
  dateLabel: string;
  url: string;
  title: LocalizedText;
  category: LocalizedText;
  /**
   * The diploma image, linked by id. The bytes live in the media library;
   * replacing or removing it here changes only the link, and an image left
   * unused afterwards goes to the trash rather than lingering.
   */
  fileMediaId: string | null;
  /** For the thumbnail; never written. */
  imageUrl: string | null;
  /**
   * The image's alt text, edited here and written to the media library on
   * save — in both languages, because the site shows it in both.
   */
  alt: LocalizedText;
};

/**
 * A first alt text for a diploma just uploaded, from what the form already
 * knows. A suggestion to edit, not a final text: it names the course and the
 * provider, which is what every diploma shows, and leaves the rest to whoever
 * can see the picture.
 */
export function suggestDiplomaAlt(item: Pick<CertificateDraft, "provider" | "title">): LocalizedText {
  const provider = item.provider.trim();
  const es = item.title.es?.trim() || "el curso";
  const en = item.title.en?.trim() || item.title.es?.trim() || "the course";
  return {
    es: `${provider ? `Diploma de ${provider}` : "Diploma"} por aprobar «${es}».`,
    en: `${provider ? `${provider} diploma` : "Diploma"} for passing “${en}”.`,
  };
}

/** Certificates whose image lacks alt text in some language, by Spanish title. */
export function diplomasMissingAlt(items: CertificateDraft[], locales: readonly Locale[]): string[] {
  return items
    .filter((i) => i.fileMediaId && locales.some((l) => !i.alt[l]?.trim()))
    .map((i) => i.title.es?.trim() || i.url);
}

export function emptyLocalized(locales: readonly Locale[]): LocalizedText {
  return Object.fromEntries(locales.map((l) => [l, ""])) as LocalizedText;
}

/** A row counts as translated when every locale has text. */
export function missingIn(
  locales: readonly Locale[],
  ...fields: LocalizedText[]
): Locale[] {
  return locales.filter((l) => fields.some((f) => !f[l]?.trim()));
}
