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
};

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
