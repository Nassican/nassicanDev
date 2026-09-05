"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, prismaJson } from "@nassican/db";
import { cacheTags, locales, type ContentBlock, type Locale } from "@nassican/shared";
import { requireUser } from "@/lib/session";
import { revalidatePublicSite } from "@/lib/revalidate";
import { syncMediaUsage } from "@/lib/media-usage";
import {
  incompleteLocales,
  normaliseRoute,
  type PageDraft,
} from "@/lib/page-draft";

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

function tagsFor(route: string): string[] {
  return [cacheTags.pages, cacheTags.page(route)];
}

export async function createPage(): Promise<never> {
  await requireUser();

  const page = await db.page.create({
    data: {
      kind: "custom",
      route: `/borrador-${Date.now().toString(36)}`,
      status: "draft",
    },
  });

  for (const locale of locales) {
    await db.pageTranslation.create({
      data: { pageId: page.id, locale, title: "" },
    });
  }

  revalidatePath("/contenido/paginas");
  redirect(`/contenido/paginas/${page.id}`);
}

export async function savePage(draft: PageDraft): Promise<ActionResult> {
  await requireUser();

  const route =
    draft.kind === "system" ? draft.route : normaliseRoute(draft.route);

  if (draft.kind === "custom") {
    if (route === "/") {
      return { ok: false, message: "La raíz ya la sirve la portada." };
    }

    const clash = await db.page.findFirst({
      where: { route, NOT: { id: draft.id } },
      select: { kind: true },
    });
    if (clash) {
      return {
        ok: false,
        message:
          clash.kind === "system"
            ? `"${route}" es una ruta del sitio, no puede duplicarse.`
            : `Ya existe otra página en "${route}".`,
      };
    }
  }

  await db.page.update({
    where: { id: draft.id },
    data: {
      route,
      sitemapPriority: draft.sitemapPriority,
      sitemapChangefreq: draft.sitemapChangefreq.trim() || null,
    },
  });

  for (const t of draft.translations) {
    const data = {
      title: t.title.trim(),
      // A system page has no body of its own: its markup lives in code.
      body:
        draft.kind === "system"
          ? undefined
          : prismaJson.body(t.body as ContentBlock[]),
      seoTitle: t.seoTitle.trim() || null,
      seoDescription: t.seoDescription.trim() || null,
      keywords: prismaJson.strings(t.keywords.map((k) => k.trim()).filter(Boolean)),
      noindex: t.noindex,
    };

    await db.pageTranslation.upsert({
      where: { pageId_locale: { pageId: draft.id, locale: t.locale as Locale } },
      update: data,
      create: { pageId: draft.id, locale: t.locale as Locale, ...data },
    });
  }

  if (draft.kind === "custom") {
    await syncMediaUsage({
      entityType: "page",
      entityId: draft.id,
      bodies: draft.translations.map((t) => ({ locale: t.locale, body: t.body })),
    });
  }

  revalidatePath("/contenido/paginas");
  revalidatePath(`/contenido/paginas/${draft.id}`);

  if (draft.status === "published") await revalidatePublicSite(tagsFor(route));

  return { ok: true, message: "Guardado." };
}

export async function publishPage(draft: PageDraft): Promise<ActionResult> {
  await requireUser();

  const saved = await savePage(draft);
  if (!saved.ok) return saved;

  const missing = incompleteLocales(draft, locales);
  if (missing.length > 0) {
    return {
      ok: false,
      message: `Faltan título o contenido en: ${missing.join(", ")}. Una página no se publica a medias.`,
    };
  }

  const route =
    draft.kind === "system" ? draft.route : normaliseRoute(draft.route);

  await db.page.update({
    where: { id: draft.id },
    data: { status: "published" },
  });

  const result = await revalidatePublicSite(tagsFor(route));
  revalidatePath("/contenido/paginas");

  return result.ok
    ? { ok: true, message: "Publicada y sitio actualizado." }
    : {
        ok: true,
        message: `Publicada, pero no se pudo avisar al sitio (${result.reason}).`,
      };
}

export async function unpublishPage(id: string): Promise<ActionResult> {
  await requireUser();

  const page = await db.page.findUnique({
    where: { id },
    select: { kind: true, route: true },
  });

  if (page?.kind === "system") {
    return {
      ok: false,
      message: "Una ruta del sitio no se puede despublicar desde aquí; usa «no indexar».",
    };
  }

  await db.page.update({ where: { id }, data: { status: "draft" } });
  if (page) await revalidatePublicSite(tagsFor(page.route));

  revalidatePath("/contenido/paginas");
  revalidatePath(`/contenido/paginas/${id}`);

  return { ok: true, message: "Retirada del sitio público." };
}

export async function deletePage(id: string): Promise<ActionResult> {
  await requireUser();

  const page = await db.page.findUnique({
    where: { id },
    select: { kind: true, route: true },
  });

  if (!page) return { ok: false, message: "La página ya no existe." };
  if (page.kind === "system") {
    return {
      ok: false,
      message: "Una ruta del sitio existe en el código; borrarla aquí no la quitaría.",
    };
  }

  await db.page.delete({ where: { id } });
  await db.mediaUsage.deleteMany({ where: { entityType: "page", entityId: id } });
  await revalidatePublicSite(tagsFor(page.route));

  revalidatePath("/contenido/paginas");
  return { ok: true, message: "Página eliminada." };
}
