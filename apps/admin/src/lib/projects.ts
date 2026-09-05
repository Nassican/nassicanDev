import "server-only";

import { db } from "@nassican/db";
import { locales, type ContentBlock, type Locale } from "@nassican/shared";
import type {
  ProjectDraft,
  ProjectTranslationDraft,
} from "@/lib/project-draft";

export * from "@/lib/project-draft";

const include = {
  translations: true,
  coverMedia: true,
  technologies: { include: { technology: true }, orderBy: { position: "asc" } },
} as const;

type Row = {
  id: string;
  slug: string;
  title: string;
  yearLabel: string;
  date: Date;
  status: ProjectDraft["status"];
  comingSoon: boolean;
  featured: boolean;
  demoUrl: string | null;
  repoUrl: string | null;
  coverMedia: { url: string } | null;
  translations: {
    locale: Locale;
    tagline: string;
    summary: string | null;
    role: string | null;
    highlights: unknown;
    body: unknown;
  }[];
  technologies: { technology: { key: string } }[];
};

function emptyTranslation(locale: Locale): ProjectTranslationDraft {
  return { locale, tagline: "", summary: "", role: "", highlights: [], body: [] };
}

function toDraft(row: Row): ProjectDraft {
  const byLocale = new Map(row.translations.map((t) => [t.locale, t]));

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    yearLabel: row.yearLabel,
    date: row.date.toISOString().slice(0, 10),
    status: row.status,
    comingSoon: row.comingSoon,
    featured: row.featured,
    demoUrl: row.demoUrl ?? "",
    repoUrl: row.repoUrl ?? "",
    coverUrl: row.coverMedia?.url ?? null,
    stack: row.technologies.map((t) => t.technology.key),
    translations: locales.map((locale) => {
      const t = byLocale.get(locale);
      if (!t) return emptyTranslation(locale);
      return {
        locale,
        tagline: t.tagline,
        summary: t.summary ?? "",
        role: t.role ?? "",
        highlights: (t.highlights as string[] | null) ?? [],
        body: (t.body as ContentBlock[] | null) ?? [],
      };
    }),
  };
}

export async function listProjects(): Promise<ProjectDraft[]> {
  const rows = await db.project.findMany({
    include,
    orderBy: [{ position: "asc" }, { date: "desc" }],
  });
  return rows.map((row) => toDraft(row as unknown as Row));
}

export async function getProjectDraft(
  id: string,
): Promise<ProjectDraft | null> {
  const row = await db.project.findUnique({ where: { id }, include });
  return row ? toDraft(row as unknown as Row) : null;
}

/** The technology registry, for the stack picker. */
export async function listTechnologies(): Promise<
  { key: string; name: string; hex: string }[]
> {
  return db.technology.findMany({
    select: { key: true, name: true, hex: true },
    orderBy: { key: "asc" },
  });
}
