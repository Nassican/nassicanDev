"use server";

import { revalidatePath } from "next/cache";
import { db, prismaJson } from "@nassican/db";
import { cacheTags, locales } from "@nassican/shared";
import { requireUser } from "@/lib/session";
import { revalidatePublicSite } from "@/lib/revalidate";
import { listSearchConsoleSites, syncSearchConsole } from "@/lib/search-console";
import {
  normaliseDestination,
  normaliseSource,
  redirectProblem,
  type RedirectDraft,
  type SeoSettingsDraft,
} from "@/lib/seo-draft";

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function saveSeoSettings(
  draft: SeoSettingsDraft,
): Promise<ActionResult> {
  await requireUser();

  const fields = {
    // `siteUrl` is not editable here: the public site reads the origin from its
    // own environment, so a value stored here would be misleading.
    siteUrl: process.env.PUBLIC_SITE_URL ?? "https://www.nassican.com",
    titleTemplate: draft.titleTemplate.trim() || null,
    googleSiteVerification: draft.googleSiteVerification.trim() || null,
    ga4MeasurementId: draft.ga4MeasurementId.trim() || null,
    ga4PropertyId: draft.ga4PropertyId.trim() || null,
    gscSiteUrl: draft.gscSiteUrl.trim() || null,
    robotsExtra: draft.robotsExtra.trim() || null,
    defaultOgImageId: draft.defaultOgMediaId,
  };

  await db.seoSettings.upsert({
    where: { id: 1 },
    update: fields,
    create: { id: 1, ...fields },
  });

  for (const locale of locales) {
    const t = draft.perLocale[locale];
    const data = {
      defaultTitle: t.defaultTitle.trim(),
      defaultDescription: t.defaultDescription.trim(),
      keywords: prismaJson.strings(t.keywords.map((k) => k.trim()).filter(Boolean)),
    };

    await db.seoSettingsTranslation.upsert({
      where: { settingsId_locale: { settingsId: 1, locale } },
      update: data,
      create: { settingsId: 1, locale, ...data },
    });
  }

  revalidatePath("/seo");
  const result = await revalidatePublicSite([cacheTags.seoSettings]);

  return result.ok
    ? { ok: true, message: "Ajustes guardados. Sitio actualizado." }
    : {
        ok: true,
        message: `Guardados, pero no se pudo avisar al sitio (${result.reason}).`,
      };
}

/**
 * Redirects are saved as a set: rows missing from the payload are deleted.
 * `hits` and `lastHitAt` are never written from here - they belong to the
 * public site, which is what actually counts them.
 */
export async function saveRedirects(
  items: RedirectDraft[],
): Promise<ActionResult> {
  await requireUser();

  const keep = items.filter((r) => r.source.trim() && r.destination.trim());

  for (const item of keep) {
    const problem = redirectProblem(item);
    if (problem) return { ok: false, message: problem };
  }

  const sources = keep.map((r) => normaliseSource(r.source));
  const duplicate = sources.find((s, i) => sources.indexOf(s) !== i);
  if (duplicate) {
    return { ok: false, message: `"${duplicate}" está repetida.` };
  }

  // A redirect whose source is a page that exists would never fire, because the
  // catch-all is only reached when nothing else matched. Say so rather than
  // storing a rule that silently does nothing.
  const shadowed = await db.page.findMany({
    where: { route: { in: sources }, status: "published" },
    select: { route: true },
  });
  if (shadowed.length > 0) {
    return {
      ok: false,
      message: `Estas direcciones ya son páginas del sitio, la redirección nunca se aplicaría: ${shadowed
        .map((p) => p.route)
        .join(", ")}.`,
    };
  }

  await db.redirect.deleteMany({
    where: { id: { notIn: keep.map((r) => r.id).filter((id): id is string => !!id) } },
  });

  for (const item of keep) {
    const data = {
      source: normaliseSource(item.source),
      destination: normaliseDestination(item.destination),
      statusCode: item.statusCode === 302 || item.statusCode === 307 ? 307 : 308,
      isEnabled: item.isEnabled,
    };

    if (item.id) {
      await db.redirect.update({ where: { id: item.id }, data });
    } else {
      await db.redirect.create({ data });
    }
  }

  revalidatePath("/seo");
  const result = await revalidatePublicSite([cacheTags.redirects]);

  return result.ok
    ? { ok: true, message: `${keep.length} redirecciones guardadas.` }
    : {
        ok: true,
        message: `Guardadas, pero no se pudo avisar al sitio (${result.reason}).`,
      };
}

export type DetectedSite = { siteUrl: string; permission: string };

export type DetectResult =
  | { ok: true; sites: DetectedSite[] }
  | { ok: false; message: string };

/** Lists the Search Console properties this Google account can read. */
export async function detectSearchConsoleSites(): Promise<DetectResult> {
  await requireUser();

  const result = await listSearchConsoleSites();
  return result.ok
    ? { ok: true, sites: result.sites }
    : { ok: false, message: result.reason };
}

export async function runSearchConsoleSync(days: number): Promise<ActionResult> {
  await requireUser();

  const result = await syncSearchConsole(days);
  revalidatePath("/seo");

  return result.ok
    ? {
        ok: true,
        message:
          result.rows === 0
            ? `Sin datos entre ${result.from} y ${result.to}. Search Console tarda dos o tres días en publicar.`
            : `${result.rows} filas traídas (${result.from} → ${result.to}).`,
      }
    : { ok: false, message: result.reason };
}
