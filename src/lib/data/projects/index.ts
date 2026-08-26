import type { ProjectItem } from "./types";
import { project as strategix } from "./strategix";
import { project as cursovisor } from "./cursovisor";

/**
 * Registry of projects. One folder per project, one file per language inside
 * it, so this file only ever grows by two lines when a project is added and no
 * single file collects every case study.
 *
 *   projects/
 *     <slug>/
 *       index.ts   metadata + wiring
 *       es.ts      Spanish tagline, summary, highlights and case study
 *       en.ts      English tagline, summary, highlights and case study
 *
 * To add one: copy an existing folder, rename it to the slug, translate both
 * files and register it below. Leave `comingSoon: true` in `index.ts` until the
 * real case study is written - never invent one.
 */
export const projects: ProjectItem[] = [strategix, cursovisor];

/** Newest first, which is the order both the grid and the sitemap use. */
export const projectsByDate = [...projects].sort((a, b) =>
  b.date.localeCompare(a.date),
);

export const featuredProjects = projectsByDate.filter(
  (p) => p.featured !== false,
);

export function getProject(slug: string): ProjectItem | undefined {
  return projects.find((p) => p.slug === slug);
}

export type { ProjectItem, ProjectMeta, ProjectTranslation } from "./types";
