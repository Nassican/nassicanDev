import "server-only";

import { db } from "@nassican/db";
import {
  calendarDate,
  locales,
  wordCount,
  type ContentBlock,
  type Locale,
} from "@nassican/shared";
import type { LinkReference } from "@/lib/link-check";
import { getTimezone } from "@/lib/site-config";

export * from "@/lib/link-check";

/** One thing that is missing a language, and where to go and write it. */
export type Gap = {
  kind: string;
  label: string;
  missing: Locale[];
  href: string;
};

export type ContentHealth = {
  posts: { published: number; draft: number };
  projects: { published: number; draft: number; withoutCaseStudy: number };
  pages: { system: number; custom: number };
  media: { count: number; withoutAlt: number; unused: number };
  words: number;
  credentials: { experience: number; education: number; certificates: number };
};

export type BrokenLink = {
  url: string;
  status: number | null;
  error: string | null;
  checkedAt: string | null;
  references: LinkReference[];
};

export type StatsSummary = {
  health: ContentHealth;
  coverage: { complete: number; total: number; ratio: number; gaps: Gap[] };
  links: {
    total: number;
    broken: BrokenLink[];
    unverifiable: BrokenLink[];
    lastCheck: { at: string; status: string; error: string | null } | null;
  };
  history: { date: string; words: number; coverage: number; broken: number }[];
};

const empty = (value: string | null | undefined) => !value?.trim();

/**
 * Everything the site is made of, and what is missing from it.
 *
 * Translation coverage counts *entities*, not fields: an article half-written
 * in English is one gap, not four. And every gap carries a link, because a
 * percentage nobody can act on is decoration.
 */
export async function getStats(): Promise<StatsSummary> {
  const [
    posts,
    projects,
    pages,
    media,
    certificates,
    experience,
    education,
    links,
    history,
    lastCheck,
    mediaUsages,
  ] = await Promise.all([
      db.post.findMany({ include: { translations: true } }),
      db.project.findMany({ include: { translations: true } }),
      db.page.findMany({ include: { translations: true } }),
      db.media.findMany({ select: { id: true, translations: true } }),
      db.certificate.findMany({ include: { translations: true } }),
      db.experience.findMany({ include: { translations: true } }),
      db.education.findMany({ include: { translations: true } }),
      db.outboundLink.findMany({ orderBy: { url: "asc" } }),
      db.contentStatsDaily.findMany({ orderBy: { date: "asc" }, take: 90 }),
      db.syncRun.findFirst({ where: { source: "link_check" }, orderBy: { startedAt: "desc" } }),
      db.mediaUsage.findMany({ select: { mediaId: true } }),
    ]);

  // The covers come off the rows already fetched above. Asking for them again
  // was two more round trips for columns that were already in hand - and at
  // this distance a round trip is the whole cost of a query.
  const usedMediaIds = new Set<string>();
  for (const row of mediaUsages) usedMediaIds.add(row.mediaId);
  for (const row of [...projects, ...posts]) {
    if (row.coverMediaId) usedMediaIds.add(row.coverMediaId);
  }

  const gaps: Gap[] = [];
  const track = (
    kind: string,
    label: string,
    href: string,
    missing: Locale[],
  ): boolean => {
    if (missing.length === 0) return true;
    gaps.push({ kind, label, missing, href });
    return false;
  };

  let complete = 0;
  let total = 0;
  let words = 0;

  for (const post of posts) {
    total += 1;
    const missing = locales.filter((l) => {
      const t = post.translations.find((x) => x.locale === l);
      return !t || empty(t.title) || empty(t.description) ||
        ((t.body as ContentBlock[] | null) ?? []).length === 0;
    });
    if (track("Artículo", post.translations.find((t) => t.title)?.title ?? post.slug,
      `/contenido/blogs/${post.id}`, missing)) complete += 1;

    for (const t of post.translations) {
      words += wordCount(((t.body as ContentBlock[] | null) ?? []));
    }
  }

  for (const project of projects) {
    total += 1;
    // Only the tagline is required, exactly as the publishing rule says.
    const missing = locales.filter((l) => {
      const t = project.translations.find((x) => x.locale === l);
      return !t || empty(t.tagline);
    });
    if (track("Proyecto", project.title, `/contenido/proyectos/${project.id}`, missing)) {
      complete += 1;
    }

    for (const t of project.translations) {
      words += wordCount(((t.body as ContentBlock[] | null) ?? []));
    }
  }

  for (const page of pages.filter((p) => p.kind === "custom")) {
    total += 1;
    const missing = locales.filter((l) => {
      const t = page.translations.find((x) => x.locale === l);
      return !t || empty(t.title) ||
        ((t.body as ContentBlock[] | null) ?? []).length === 0;
    });
    if (track("Página", page.translations.find((t) => t.title)?.title ?? page.route,
      `/contenido/paginas/${page.id}`, missing)) complete += 1;

    for (const t of page.translations) {
      words += wordCount(((t.body as ContentBlock[] | null) ?? []));
    }
  }

  for (const certificate of certificates) {
    total += 1;
    const missing = locales.filter((l) => {
      const t = certificate.translations.find((x) => x.locale === l);
      return !t || empty(t.title) || empty(t.category);
    });
    if (track("Certificado",
      `${certificate.provider} · ${certificate.translations[0]?.title ?? ""}`.trim(),
      "/perfil", missing)) complete += 1;
  }

  for (const item of experience) {
    total += 1;
    const missing = locales.filter((l) => {
      const t = item.translations.find((x) => x.locale === l);
      return !t || empty(t.title) || empty(t.periodLabel) || empty(t.description);
    });
    if (track("Experiencia", item.org, "/perfil", missing)) complete += 1;
  }

  for (const item of education) {
    total += 1;
    const missing = locales.filter((l) => {
      const t = item.translations.find((x) => x.locale === l);
      return !t || empty(t.degree) || empty(t.periodLabel);
    });
    if (track("Formación", item.institution, "/perfil", missing)) complete += 1;
  }

  // Alt text is visible text, so an image missing it is a translation gap too.
  for (const item of media) {
    total += 1;
    const missing = locales.filter((l) => {
      const t = item.translations.find((x) => x.locale === l);
      return !t || empty(t.alt);
    });
    if (track("Imagen", item.id.slice(0, 8), "/contenido/multimedia", missing)) {
      complete += 1;
    }
  }

  const withoutAlt = media.filter((m) =>
    locales.some((l) => empty(m.translations.find((t) => t.locale === l)?.alt)),
  ).length;

  return {
    health: {
      posts: {
        published: posts.filter((p) => p.status === "published").length,
        draft: posts.filter((p) => p.status !== "published").length,
      },
      projects: {
        published: projects.filter((p) => p.status === "published").length,
        draft: projects.filter((p) => p.status !== "published").length,
        withoutCaseStudy: projects.filter((p) =>
          p.translations.some(
            (t) => ((t.body as ContentBlock[] | null) ?? []).length === 0,
          ),
        ).length,
      },
      pages: {
        system: pages.filter((p) => p.kind === "system").length,
        custom: pages.filter((p) => p.kind === "custom").length,
      },
      media: {
        count: media.length,
        withoutAlt,
        unused: media.filter((m) => !usedMediaIds.has(m.id)).length,
      },
      words,
      credentials: {
        experience: experience.length,
        education: education.length,
        certificates: certificates.length,
      },
    },
    coverage: {
      complete,
      total,
      ratio: total > 0 ? complete / total : 1,
      gaps: gaps.sort((a, b) => a.kind.localeCompare(b.kind)),
    },
    links: {
      total: links.length,
      broken: links
        .filter((l) => l.ok === false)
        .map((l) => ({
          url: l.url,
          status: l.status,
          error: l.error,
          checkedAt: l.checkedAt?.toISOString() ?? null,
          references:
            ((l.references as { items?: LinkReference[] } | null)?.items ?? []),
        })),
      unverifiable: links
        .filter((l) => l.ok === null && l.checkedAt !== null)
        .map((l) => ({
          url: l.url,
          status: l.status,
          error: l.error,
          checkedAt: l.checkedAt?.toISOString() ?? null,
          references:
            ((l.references as { items?: LinkReference[] } | null)?.items ?? []),
        })),
      lastCheck: lastCheck
        ? {
            at: (lastCheck.finishedAt ?? lastCheck.startedAt).toISOString(),
            status: lastCheck.status,
            error: lastCheck.error,
          }
        : null,
    },
    history: history.map((h) => ({
      date: h.date.toISOString().slice(0, 10),
      words: h.totalWords,
      coverage: h.translationCoverage,
      broken: h.brokenLinks,
    })),
  };
}

/**
 * Writes today's figures into the daily table.
 *
 * One row per day, replaced if it already exists: the point is a trend, and a
 * day recorded twice would be a spike that never happened.
 *
 * Which day that is comes from the configured timezone, not from UTC. Bucketing
 * an evening in Bogotá under the following UTC day put two runs of the same
 * evening on different rows and left the real day empty.
 */
export async function snapshotStats(): Promise<{ date: string }> {
  const [stats, timezone] = await Promise.all([getStats(), getTimezone()]);
  const day = calendarDate(timezone);
  const date = new Date(`${day}T00:00:00.000Z`);

  const media = await db.media.aggregate({ _sum: { sizeBytes: true } });

  const data = {
    publishedPosts: stats.health.posts.published,
    draftPosts: stats.health.posts.draft,
    publishedProjects: stats.health.projects.published,
    mediaCount: stats.health.media.count,
    mediaBytes: media._sum.sizeBytes ?? BigInt(0),
    totalWords: stats.health.words,
    translationCoverage: stats.coverage.ratio,
    brokenLinks: stats.links.broken.length,
  };

  await db.contentStatsDaily.upsert({
    where: { date },
    update: data,
    create: { date, ...data },
  });

  return { date: day };
}
