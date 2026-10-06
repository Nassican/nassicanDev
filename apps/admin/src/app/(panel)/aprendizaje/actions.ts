"use server";

import { revalidatePath } from "next/cache";
import { db, type CourseStatus } from "@nassican/db";
import { cacheTags, calendarDate, locales } from "@nassican/shared";
import { logAudit } from "@/lib/audit";
import { certificateProblems, courseProblems, type CertificateFromCourse, type CourseDraft } from "@/lib/course-draft";
import { createCourse, publishCertificate, setCourseStatus, updateCourse } from "@/lib/courses";
import { parseQuick, type QuickKind } from "@/lib/quick-edit";
import { notifyPublicSite } from "@/lib/revalidate";
import { requireUser } from "@/lib/session";
import { getTimezone } from "@/lib/site-config";
import { TRASH_DAYS, moveToTrash } from "@/lib/trash";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

function refresh() {
  revalidatePath("/aprendizaje");
  revalidatePath("/bitacora");
}

export async function saveCourse(draft: CourseDraft): Promise<ActionResult> {
  const user = await requireUser();
  const problems = courseProblems(draft);
  if (problems.length > 0) return { ok: false, message: problems.join(" ") };

  const isNew = !draft.id;
  const id = isNew ? await createCourse(draft) : (await updateCourse(draft), draft.id);
  await logAudit({
    userId: user.id,
    action: isNew ? "create" : "update",
    entityType: "course",
    entityId: id,
    diff: { title: draft.title.trim(), status: draft.status },
  });
  refresh();
  return { ok: true, message: isNew ? `«${draft.title.trim()}» añadido.` : `«${draft.title.trim()}» guardado.` };
}

export async function deleteCourse(id: string, title: string): Promise<ActionResult> {
  const user = await requireUser();
  await moveToTrash("course", id, user.id);
  await logAudit({ userId: user.id, action: "delete", entityType: "course", entityId: id, diff: { title, trash: true } });
  refresh();
  return { ok: true, message: `«${title}» está en la papelera durante ${TRASH_DAYS} días.` };
}

export async function changeCourseStatus(id: string, status: CourseStatus): Promise<ActionResult> {
  const user = await requireUser();
  const { title } = await setCourseStatus(id, status);
  await logAudit({ userId: user.id, action: "update", entityType: "course", entityId: id, diff: { title, status } });
  refresh();
  return { ok: true, message: `«${title}» actualizado.` };
}

const quickCourseFields = {
  progress: "integer",
  hoursSpent: "decimal",
  targetDate: "date",
  finishedAt: "date",
} as const satisfies Record<string, QuickKind>;

export type QuickCourseField = keyof typeof quickCourseFields;

/** One field from the row; «today» is resolved in the configured timezone. */
export async function quickEditCourse(id: string, field: QuickCourseField, raw: string): Promise<ActionResult> {
  const user = await requireUser();
  const kind = quickCourseFields[field];
  if (!kind) return { ok: false, message: "Ese campo no se edita desde la lista." };

  const text = field === "finishedAt" && raw === "today" ? calendarDate(await getTimezone()) : raw;
  const parsed = parseQuick(kind, text);
  if (!parsed.ok) return parsed;
  if (field === "progress" && typeof parsed.value === "number" && parsed.value > 100) {
    return { ok: false, message: "El progreso va de 0 a 100." };
  }

  const course = await db.course.update({
    where: { id },
    // Progress is never null: blank means «not started», which is 0.
    data: { [field]: field === "progress" ? (parsed.value ?? 0) : parsed.value },
    select: { title: true },
  });
  await logAudit({
    userId: user.id,
    action: "update",
    entityType: "course",
    entityId: id,
    diff: { title: course.title, [field]: parsed.value },
  });
  refresh();
  return { ok: true, message: `«${course.title}» guardado.` };
}

/**
 * A finished course, on the public site. Bilingual or refused — the repository's
 * first rule — and the cache tag is told so /certificates shows it without a
 * deploy.
 */
export async function publishCourseCertificate(
  courseId: string,
  provider: string,
  draft: CertificateFromCourse,
): Promise<ActionResult> {
  const user = await requireUser();
  const problems = certificateProblems(draft, locales);
  if (!provider.trim()) problems.unshift("Falta el proveedor (Platzi, Udemy…).");
  if (problems.length > 0) return { ok: false, message: problems.join(" ") };

  const outcome = await publishCertificate(courseId, provider, draft);
  if ("error" in outcome) return { ok: false, message: outcome.error };

  await logAudit({
    userId: user.id,
    action: "publish",
    entityType: "certificate",
    entityId: outcome.certificateId,
    diff: { title: draft.title.es.trim(), fromCourse: courseId },
  });
  refresh();
  revalidatePath("/perfil");
  notifyPublicSite([cacheTags.certificates]);
  return { ok: true, message: `«${draft.title.es.trim()}» ya está en Certificados y en el sitio. Su diploma se sube desde Perfil.` };
}
