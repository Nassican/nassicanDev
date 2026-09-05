"use server";

import { revalidatePath } from "next/cache";
import { db } from "@nassican/db";
import { cacheTags, configTags, locales, type SiteSettings } from "@nassican/shared";
import { requireUser } from "@/lib/session";
import { revalidatePublicSite } from "@/lib/revalidate";
import {
  danglingSectionLinks,
  navItemProblem,
  normaliseTarget,
  sectionLabels,
  settingsProblem,
  type NavDraft,
  type SectionDraft,
} from "@/lib/site-config-draft";

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

/** Saved, then the site is told - and told even if the telling fails. */
async function done(tags: string[], what: string): Promise<ActionResult> {
  revalidatePath("/configuracion");
  const result = await revalidatePublicSite(tags);

  return result.ok
    ? { ok: true, message: `${what} Sitio actualizado.` }
    : {
        ok: true,
        message: `${what} Pero no se pudo avisar al sitio (${result.reason}); tardará hasta cinco minutos.`,
      };
}

export async function saveSettings(
  settings: SiteSettings,
): Promise<ActionResult> {
  await requireUser();

  const problem = settingsProblem(settings);
  if (problem) return { ok: false, message: problem };

  const fields = {
    defaultTheme: settings.defaultTheme,
    timezone: settings.timezone.trim(),
    maintenanceMode: settings.maintenanceMode,
    brandLine: settings.brandLine.trim(),
    copyrightName: settings.copyrightName.trim(),
    latestPostsCount: settings.latestPostsCount,
    showSectionNavigator: settings.showSectionNavigator,
  };

  await db.siteSettings.upsert({
    where: { id: 1 },
    update: fields,
    create: { id: 1, ...fields },
  });

  return done(
    [cacheTags.siteSettings],
    settings.maintenanceMode
      ? "Ajustes guardados. El sitio queda en mantenimiento."
      : "Ajustes guardados.",
  );
}

/**
 * The whole menu is written as a set: what is not in the payload is deleted.
 *
 * The lists are short and edited as a whole, so replacing them is simpler to
 * reason about than a per-row protocol - the same call the profile module
 * makes. Ids are reused where they exist so that nothing that references an
 * item breaks, and translations follow their item by cascade.
 */
export async function saveNavigation(
  nav: NavDraft,
  sections: SectionDraft[],
): Promise<ActionResult> {
  await requireUser();

  const columns = nav.footer.map((c) => c.column);
  const all = [
    ...nav.header,
    ...(nav.cta ? [nav.cta] : []),
    ...columns,
    ...nav.footer.flatMap((c) => c.items),
  ];

  for (const item of all) {
    const problem = navItemProblem(item);
    if (problem) {
      const name = item.labels.es || item.labels.en || "un enlace";
      return { ok: false, message: `«${name}»: ${problem}` };
    }
  }

  const dangling = danglingSectionLinks(nav, sections);
  if (dangling.length > 0) {
    const [first] = dangling;
    return {
      ok: false,
      message:
        `«${sectionLabels[first.section]}» está oculta, pero ${first.labels.length === 1 ? "el enlace" : "los enlaces"} ` +
        `${first.labels.map((l) => `«${l}»`).join(", ")} ${first.labels.length === 1 ? "apunta" : "apuntan"} ahí. ` +
        "Quita el enlace o vuelve a mostrar la sección.",
    };
  }

  const keepIds = all.map((i) => i.id).filter((id) => !id.startsWith("new:"));
  await db.navigationItem.deleteMany({ where: { id: { notIn: keepIds } } });

  const write = async (
    item: (typeof all)[number],
    parentId: string | null,
    position: number,
  ): Promise<string> => {
    const target = normaliseTarget(item.kind, item.target);
    const isColumn = item.area === "footer" && parentId === null;

    const fields = {
      location: item.area,
      parentId,
      kind: item.kind,
      href: item.kind === "page" || isColumn ? null : target || null,
      pageId: item.kind === "page" && !isColumn ? target || null : null,
      position,
      isVisible: item.isVisible,
    } as const;

    const row = item.id.startsWith("new:")
      ? await db.navigationItem.create({ data: fields })
      : await db.navigationItem.update({ where: { id: item.id }, data: fields });

    for (const locale of locales) {
      const label = item.labels[locale].trim();
      await db.navigationItemTranslation.upsert({
        where: { itemId_locale: { itemId: row.id, locale } },
        update: { label },
        create: { itemId: row.id, locale, label },
      });
    }

    return row.id;
  };

  for (const [position, item] of nav.header.entries()) {
    await write(item, null, position);
  }
  if (nav.cta) await write(nav.cta, null, 0);

  for (const [position, group] of nav.footer.entries()) {
    const columnId = await write(group.column, null, position);
    for (const [childPosition, child] of group.items.entries()) {
      await write(child, columnId, childPosition);
    }
  }

  for (const [position, section] of sections.entries()) {
    await db.homeSection.upsert({
      where: { key: section.key },
      update: { position, isVisible: section.isVisible },
      create: { key: section.key, position, isVisible: section.isVisible },
    });
  }

  return done(configTags, "Navegación y secciones guardadas.");
}
