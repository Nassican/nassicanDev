import "server-only";

import { db } from "@nassican/db";
import { getStats } from "@/lib/stats";

/**
 * One thing worth doing, with somewhere to go and do it.
 *
 * The dashboard is a to-do list before it is a scoreboard: a number you cannot
 * act on is decoration, and the old version of this page did not even manage a
 * true number - it still announced that the database was empty long after the
 * content had moved into it.
 */
export type Pending = {
  id: string;
  tone: "urgent" | "warn" | "info";
  title: string;
  detail: string;
  href: string;
  action: string;
};

export type Recent = {
  id: string;
  action: string;
  entityType: string;
  label: string | null;
  user: string | null;
  at: string;
};

export type Traffic = {
  source: "vercel" | "ga4" | null;
  days: number;
  pageviews: number;
  visitors: number;
};

export type Dashboard = {
  counts: {
    posts: { published: number; draft: number };
    projects: { published: number; draft: number };
    words: number;
    media: number;
  };
  coverage: { ratio: number; complete: number; total: number };
  pending: Pending[];
  recent: Recent[];
  traffic: Traffic;
};

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

export async function getDashboard(): Promise<Dashboard> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 7);

  const [stats, settings, audit, warnings, vercel, ga4] = await Promise.all([
    getStats(),
    db.siteSettings.findUnique({ where: { id: 1 }, select: { maintenanceMode: true } }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: { select: { name: true, email: true } } },
    }),
    db.systemEvent.findMany({
      where: { level: { in: ["warn", "error"] }, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.vercelAnalyticsDaily.findMany({
      where: { dimension: "total", date: { gte: since } },
    }),
    db.analyticsDailyTotals.findMany({ where: { date: { gte: since } } }),
  ]);

  const pending: Pending[] = [];

  // Maintenance first and loudest: while it is on, nothing else on this page
  // matters, because nobody can see any of it.
  if (settings?.maintenanceMode) {
    pending.push({
      id: "maintenance",
      tone: "urgent",
      title: "El sitio está en mantenimiento",
      detail: "nassican.com muestra solo el aviso y no se indexa.",
      href: "/configuracion",
      action: "Desactivar",
    });
  }

  if (stats.links.broken.length > 0) {
    pending.push({
      id: "links",
      tone: "urgent",
      title: plural(stats.links.broken.length, "enlace roto", "enlaces rotos"),
      detail: stats.links.broken
        .slice(0, 2)
        .map((l) => l.url.replace(/^https?:\/\//, ""))
        .join(", "),
      href: "/estadisticas",
      action: "Revisar",
    });
  }

  if (stats.coverage.gaps.length > 0) {
    pending.push({
      id: "coverage",
      tone: "warn",
      title: plural(
        stats.coverage.gaps.length,
        "elemento sin traducir",
        "elementos sin traducir",
      ),
      detail: stats.coverage.gaps
        .slice(0, 2)
        .map((g) => `${g.label} (falta ${g.missing.join(", ")})`)
        .join(" · "),
      href: "/estadisticas",
      action: "Ver cuáles",
    });
  }

  const drafts = stats.health.posts.draft + stats.health.projects.draft;
  if (drafts > 0) {
    pending.push({
      id: "drafts",
      tone: "info",
      title: plural(drafts, "borrador sin publicar", "borradores sin publicar"),
      detail: `${plural(stats.health.posts.draft, "artículo", "artículos")} y ${plural(stats.health.projects.draft, "proyecto", "proyectos")}.`,
      href: "/contenido/blogs",
      action: "Abrir",
    });
  }

  if (stats.health.media.withoutAlt > 0) {
    pending.push({
      id: "alt",
      tone: "warn",
      title: plural(
        stats.health.media.withoutAlt,
        "imagen sin texto alternativo",
        "imágenes sin texto alternativo",
      ),
      detail: "Es accesibilidad, no cosmética: sin alt la imagen no existe para quien no la ve.",
      href: "/contenido/multimedia",
      action: "Describir",
    });
  }

  if (warnings.length > 0) {
    pending.push({
      id: "events",
      tone: "warn",
      title: plural(warnings.length, "aviso del sistema", "avisos del sistema"),
      detail: warnings[0].message.slice(0, 90),
      href: "/sistema",
      action: "Ver",
    });
  }

  // Vercel wins when both are synced: it counts without cookies, so it is the
  // number that is not missing whoever blocks the tag.
  const traffic: Traffic =
    vercel.length > 0
      ? {
          source: "vercel",
          days: vercel.length,
          pageviews: vercel.reduce((n, r) => n + r.pageviews, 0),
          // Visitors are unique per day and do not add up; the busiest day is
          // the honest headline.
          visitors: vercel.reduce((n, r) => Math.max(n, r.visitors), 0),
        }
      : ga4.length > 0
        ? {
            source: "ga4",
            days: ga4.length,
            pageviews: ga4.reduce((n, r) => n + r.pageViews, 0),
            visitors: ga4.reduce((n, r) => Math.max(n, r.users), 0),
          }
        : { source: null, days: 0, pageviews: 0, visitors: 0 };

  return {
    counts: {
      posts: stats.health.posts,
      projects: {
        published: stats.health.projects.published,
        draft: stats.health.projects.draft,
      },
      words: stats.health.words,
      media: stats.health.media.count,
    },
    coverage: {
      ratio: stats.coverage.ratio,
      complete: stats.coverage.complete,
      total: stats.coverage.total,
    },
    pending,
    recent: audit.map((row) => ({
      id: row.id.toString(),
      action: row.action,
      entityType: row.entityType,
      label:
        row.diff && typeof (row.diff as Record<string, unknown>).label === "string"
          ? ((row.diff as Record<string, unknown>).label as string)
          : null,
      user: row.user?.name ?? row.user?.email ?? null,
      at: row.createdAt.toISOString(),
    })),
    traffic,
  };
}
