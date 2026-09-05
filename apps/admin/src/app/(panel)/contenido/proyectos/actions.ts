"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, prismaJson } from "@nassican/db";
import { cacheTags, type ContentBlock, type Locale } from "@nassican/shared";
import { requireUser } from "@/lib/session";
import { revalidatePublicSite } from "@/lib/revalidate";
import { syncMediaUsage } from "@/lib/media-usage";
import {
  incompleteLocales,
  slugify,
  type ProjectDraft,
} from "@/lib/project-draft";

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

function tagsFor(slug: string): string[] {
  return [cacheTags.projects, cacheTags.project(slug)];
}

export async function createProject(): Promise<never> {
  await requireUser();

  const stamp = Date.now().toString(36);
  const project = await db.project.create({
    data: {
      slug: `borrador-${stamp}`,
      title: "Proyecto nuevo",
      yearLabel: String(new Date().getFullYear()),
      date: new Date(),
      status: "draft",
    },
  });

  revalidatePath("/contenido/proyectos");
  redirect(`/contenido/proyectos/${project.id}`);
}

export async function saveProject(
  draft: ProjectDraft,
): Promise<ActionResult> {
  await requireUser();

  const slug = slugify(draft.slug) || `borrador-${Date.now().toString(36)}`;

  const clash = await db.project.findFirst({
    where: { slug, NOT: { id: draft.id } },
    select: { id: true },
  });
  if (clash) {
    return { ok: false, message: `Ya existe otro proyecto con el slug "${slug}".` };
  }

  if (!draft.title.trim()) {
    return { ok: false, message: "El nombre del proyecto no puede quedar vacío." };
  }

  await db.project.update({
    where: { id: draft.id },
    data: {
      slug,
      title: draft.title.trim(),
      yearLabel: draft.yearLabel.trim(),
      date: new Date(draft.date),
      comingSoon: draft.comingSoon,
      featured: draft.featured,
      demoUrl: draft.demoUrl.trim() || null,
      repoUrl: draft.repoUrl.trim() || null,
      coverMediaId: draft.coverMediaId,
    },
  });

  for (const t of draft.translations) {
    const data = {
      tagline: t.tagline.trim(),
      summary: t.summary.trim() || null,
      role: t.role.trim() || null,
      highlights: prismaJson.strings(
        t.highlights.map((h) => h.trim()).filter(Boolean),
      ),
      body: prismaJson.body(t.body as ContentBlock[]),
    };

    await db.projectTranslation.upsert({
      where: {
        projectId_locale: { projectId: draft.id, locale: t.locale as Locale },
      },
      update: data,
      create: { projectId: draft.id, locale: t.locale as Locale, ...data },
    });
  }

  await syncMediaUsage({
    entityType: "project",
    entityId: draft.id,
    coverMediaId: draft.coverMediaId,
    bodies: draft.translations.map((t) => ({ locale: t.locale, body: t.body })),
  });

  // Stack names are foreign keys now, not strings: an unknown one is dropped
  // rather than silently stored, which is what used to break the icons.
  const technologies = await db.technology.findMany({
    where: { key: { in: draft.stack } },
    select: { id: true, key: true },
  });
  const unknown = draft.stack.filter(
    (key) => !technologies.some((t) => t.key === key),
  );

  await db.projectTechnology.deleteMany({ where: { projectId: draft.id } });
  await db.projectTechnology.createMany({
    data: draft.stack
      .map((key, position) => {
        const tech = technologies.find((t) => t.key === key);
        return tech
          ? { projectId: draft.id, technologyId: tech.id, position }
          : null;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null),
  });

  revalidatePath("/contenido/proyectos");
  revalidatePath(`/contenido/proyectos/${draft.id}`);

  if (draft.status === "published") await revalidatePublicSite(tagsFor(slug));

  return unknown.length > 0
    ? {
        ok: true,
        message: `Guardado. Sin tecnología registrada: ${unknown.join(", ")}.`,
      }
    : { ok: true, message: "Guardado." };
}

export async function publishProject(
  draft: ProjectDraft,
): Promise<ActionResult> {
  await requireUser();

  const saved = await saveProject(draft);
  if (!saved.ok) return saved;

  const missing = incompleteLocales(draft);
  if (missing.length > 0) {
    return {
      ok: false,
      message: `Falta la descripción de una línea en: ${missing.join(", ")}. Es lo mínimo para aparecer en el portafolio.`,
    };
  }

  const slug = slugify(draft.slug);
  await db.project.update({
    where: { id: draft.id },
    data: { status: "published" },
  });

  const result = await revalidatePublicSite(tagsFor(slug));
  revalidatePath("/contenido/proyectos");
  revalidatePath(`/contenido/proyectos/${draft.id}`);

  return result.ok
    ? { ok: true, message: "Publicado y sitio actualizado." }
    : {
        ok: true,
        message: `Publicado, pero no se pudo avisar al sitio (${result.reason}). Aparecerá en el siguiente despliegue.`,
      };
}

export async function unpublishProject(id: string): Promise<ActionResult> {
  await requireUser();

  const project = await db.project.update({
    where: { id },
    data: { status: "draft" },
    select: { slug: true },
  });

  await revalidatePublicSite(tagsFor(project.slug));
  revalidatePath("/contenido/proyectos");
  revalidatePath(`/contenido/proyectos/${id}`);

  return { ok: true, message: "Retirado del portafolio público." };
}

export async function deleteProject(id: string): Promise<never> {
  await requireUser();

  const project = await db.project.delete({
    where: { id },
    select: { slug: true },
  });

  await revalidatePublicSite(tagsFor(project.slug));
  revalidatePath("/contenido/proyectos");
  redirect("/contenido/proyectos");
}
