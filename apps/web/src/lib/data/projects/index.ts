import { unstable_cache } from "next/cache";
import { db } from "@nassican/db";
import { cacheTags, locales, type Locale } from "@nassican/shared";
import type { ProjectItem, ProjectTranslation } from "./types";

/**
 * Projects now come from the database, managed from app.nassican.com, instead
 * of from TypeScript modules in this folder.
 *
 * The `ProjectItem` shape is deliberately unchanged, so `ProjectCard`, the
 * case-study page and the SEO helpers did not move with it. Reads are tagged;
 * the admin invalidates those tags through `/api/revalidate` when it publishes.
 */
const include = {
  translations: true,
  coverMedia: true,
  technologies: { include: { technology: true }, orderBy: { position: "asc" } },
} as const;

type Row = {
  slug: string;
  title: string;
  yearLabel: string;
  date: Date;
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

/**
 * Only `tagline` is required, as it always was: a project can be listed with
 * `comingSoon` before its case study exists. A locale with no row at all is a
 * different matter, and skipping the project is safer than rendering a page
 * with an empty tagline.
 */
function toProject(row: Row): ProjectItem | null {
  const content = {} as Record<Locale, ProjectTranslation>;

  for (const locale of locales) {
    const t = row.translations.find((x) => x.locale === locale);
    if (!t) return null;

    content[locale] = {
      tagline: t.tagline,
      summary: t.summary ?? undefined,
      role: t.role ?? undefined,
      highlights: (t.highlights as string[] | null) ?? undefined,
      body: (t.body as ProjectTranslation["body"]) ?? undefined,
    };
  }

  return {
    slug: row.slug,
    title: row.title,
    year: row.yearLabel,
    date: row.date.toISOString().slice(0, 10),
    stack: row.technologies.map((t) => t.technology.key),
    demo: row.demoUrl ?? "",
    repo: row.repoUrl ?? undefined,
    image: row.coverMedia?.url,
    featured: row.featured,
    comingSoon: row.comingSoon,
    content,
  };
}

async function readProjects(): Promise<ProjectItem[]> {
  const rows = await db.project.findMany({
    where: { status: "published" },
    include,
    orderBy: { date: "desc" },
  });

  return rows
    .map((row) => toProject(row as unknown as Row))
    .filter((p): p is ProjectItem => p !== null);
}

/** Newest first, which is the order both the grid and the sitemap use. */
export const getProjectsByDate = unstable_cache(readProjects, ["projects"], {
  tags: [cacheTags.projects],
});

export async function getFeaturedProjects(): Promise<ProjectItem[]> {
  return (await getProjectsByDate()).filter((p) => p.featured !== false);
}

export async function getProject(
  slug: string,
): Promise<ProjectItem | undefined> {
  const read = unstable_cache(
    async () => {
      const row = await db.project.findFirst({
        where: { slug, status: "published" },
        include,
      });
      return row ? toProject(row as unknown as Row) : null;
    },
    ["project", slug],
    { tags: [cacheTags.projects, cacheTags.project(slug)] },
  );

  return (await read()) ?? undefined;
}

export type { ProjectItem, ProjectMeta, ProjectTranslation } from "./types";
