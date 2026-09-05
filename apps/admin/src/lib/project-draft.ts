import {
  missingLocales,
  type ContentBlock,
  type Locale,
} from "@nassican/shared";

/**
 * The project editor's data shape and the pure rules over it. No database
 * imports: `ProjectEditor` is a client component.
 */
export type ProjectTranslationDraft = {
  locale: Locale;
  tagline: string;
  summary: string;
  role: string;
  highlights: string[];
  body: ContentBlock[];
};

export type ProjectDraft = {
  id: string;
  slug: string;
  title: string;
  yearLabel: string;
  date: string;
  status: "draft" | "scheduled" | "published" | "archived";
  comingSoon: boolean;
  featured: boolean;
  demoUrl: string;
  repoUrl: string;
  coverMediaId: string | null;
  coverUrl: string | null;
  stack: string[];
  translations: ProjectTranslationDraft[];
};

/**
 * Only the tagline is required, exactly as when projects lived in code: a
 * project is listed with `comingSoon` before its case study exists, and the
 * detail page says so rather than showing filler.
 */
export function isLocaleComplete(
  t: ProjectTranslationDraft | undefined,
): boolean {
  return Boolean(t && t.tagline.trim());
}

export function incompleteLocales(project: ProjectDraft): Locale[] {
  return missingLocales(project.translations.filter(isLocaleComplete));
}

/** True once the case study itself is written, in every language. */
export function hasCaseStudy(project: ProjectDraft): boolean {
  return project.translations.every((t) => t.body.length > 0);
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
