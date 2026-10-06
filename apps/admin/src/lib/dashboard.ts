import "server-only";

import { db } from "@nassican/db";
import { getStats } from "@/lib/stats";
import { budgetWarnings } from "@/lib/budget";
import { pageSpeedDrops } from "@/lib/pagespeed";
import {
  sinceLabel,
  sourceLabels,
  syncProblems,
  type SyncProblem,
} from "@/lib/sync-health";

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

const BACKUP_REMINDER_DAYS = 30;

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/**
 * Names the sources rather than counting them. «2 sincronizaciones fallaron» is
 * not something anyone can act on; «Analítica: 403 de Google» is.
 */
function describe(problems: SyncProblem[]): string {
  return problems
    .slice(0, 2)
    .map((problem) => {
      const name = sourceLabels[problem.source];
      if (problem.kind === "stale") {
        return `${name}: última vez ${sinceLabel(problem.at)}`;
      }
      if (problem.kind === "abandoned") {
        return `${name}: quedó a medias ${sinceLabel(problem.at)}`;
      }
      return `${name}: ${problem.error?.slice(0, 70) ?? "sin detalle"}`;
    })
    .join(" · ");
}

export async function getDashboard(): Promise<Dashboard> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 7);

  const [stats, settings, audit, warnings, vercel, ga4, runs, lastBackup, speedDrops, budget] = await Promise.all([
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
    db.syncRun.findMany({
      where: { startedAt: { gte: since } },
      orderBy: { startedAt: "desc" },
      select: {
        source: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        error: true,
      },
    }),
    db.auditLog.findFirst({
      where: { entityType: "backup", action: "export" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    pageSpeedDrops(),
    budgetWarnings(),
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

  /*
   * Before the content warnings on purpose: when a sync has stopped, the traffic
   * figures further down this page are stale and there is no way to tell from
   * looking at them. Knowing the data is old changes how you read everything.
   */
  const problems = syncProblems(runs);
  const stalled = problems.filter((p) => p.kind !== "failed");

  if (stalled.length > 0) {
    pending.push({
      id: "sync-stalled",
      // Urgent, and this is the one that earns it: while the cron is not
      // running, the daily content snapshot is lost for good every day it does
      // not happen. Everything else here can be caught up later.
      tone: "urgent",
      // One problem names what happened to it; several can only be counted.
      // «Dejó de sincronizarse» and «quedó a medias» are different events —
      // one never started, the other was killed mid-run — and the title saying
      // the first while the detail said the second was simply wrong.
      title:
        stalled.length === 1
          ? stalled[0].kind === "abandoned"
            ? `La sincronización de ${sourceLabels[stalled[0].source]} quedó a medias`
            : `${sourceLabels[stalled[0].source]} dejó de sincronizarse`
          : `${stalled.length} sincronizaciones detenidas`,
      detail: describe(stalled),
      href: "/sistema",
      action: "Revisar",
    });
  }

  const failed = problems.filter((p) => p.kind === "failed");
  if (failed.length > 0) {
    pending.push({
      id: "sync-failed",
      tone: "warn",
      title:
        failed.length === 1
          ? `${sourceLabels[failed[0].source]} falló al sincronizar`
          : `${failed.length} sincronizaciones fallaron`,
      detail: describe(failed),
      href: "/sistema",
      action: "Ver el error",
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

  // A drop the operator caused is best caught the day after, while the change
  // that caused it is still the last thing they remember shipping.
  if (speedDrops.length > 0) {
    const [first] = speedDrops;
    pending.push({
      id: "pagespeed",
      tone: "warn",
      title:
        speedDrops.length === 1
          ? `El rendimiento móvil de ${first.label} bajó a ${first.current}`
          : `El rendimiento móvil bajó en ${speedDrops.length} páginas`,
      detail: speedDrops
        .map((d) => (d.previous === null ? `${d.label}: ${d.current}` : `${d.label}: ${d.previous} → ${d.current}`))
        .join(" · "),
      href: "/rendimiento",
      action: "Ver",
    });
  }

  // Money is personal, but this is the page opened first every day, and a
  // warning that waits for Presupuesto to be opened arrives after the money.
  if (budget.length > 0) {
    const exceeded = budget.filter((l) => l.pace === "exceeded");
    const [first] = budget;
    pending.push({
      id: "budget",
      tone: exceeded.length > 0 ? "urgent" : "warn",
      title:
        budget.length === 1
          ? first.pace === "exceeded"
            ? `Te pasaste del presupuesto de ${first.name}`
            : `${first.name} va camino de pasarse del presupuesto`
          : `${budget.length} límites del presupuesto en riesgo`,
      detail: budget
        .slice(0, 3)
        .map((l) => `${l.name}: ${Math.round(l.ratio * 100)} % con el mes al ${Math.round(l.elapsed * 100)} %`)
        .join(" · "),
      href: "/presupuesto",
      action: "Ver",
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

  /*
   * Nothing can download a backup for you — there is nowhere outside Neon for
   * the cron to put one — so the reminder is the whole mechanism. A month is
   * about how much editing anyone is willing to redo by hand.
   */
  const backupDays = lastBackup
    ? Math.floor((Date.now() - lastBackup.createdAt.getTime()) / 86_400_000)
    : null;
  if (backupDays === null || backupDays >= BACKUP_REMINDER_DAYS) {
    pending.push({
      id: "backup",
      tone: "warn",
      title:
        backupDays === null
          ? "Nunca se ha descargado una copia de seguridad"
          : `La última copia de seguridad tiene ${backupDays} días`,
      detail: "Fuera de Neon no hay ninguna otra copia de los artículos, las imágenes ni las bibliotecas.",
      href: "/copias",
      action: "Descargar",
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
