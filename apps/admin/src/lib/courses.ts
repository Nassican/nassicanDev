import "server-only";

import { db, type CourseStatus } from "@nassican/db";
import { calendarDate, locales } from "@nassican/shared";
import { blankToNull, parseNumber } from "@/lib/draft-fields";
import { storedProgress, type CertificateFromCourse, type CourseDraft } from "@/lib/course-draft";
import { getTimezone } from "@/lib/site-config";

export type CourseRow = {
  id: string;
  title: string;
  provider: string | null;
  url: string | null;
  status: CourseStatus;
  progress: number;
  hours: number | null;
  hoursSpent: number | null;
  price: number | null;
  startedAt: string | null;
  targetDate: string | null;
  finishedAt: string | null;
  note: string | null;
  certificateId: string | null;
  /** Its target date came and went while it was still open. */
  late: boolean;
};

export type CoursesSummary = {
  courses: CourseRow[];
  counts: Record<CourseStatus, number>;
  today: string;
  /** What the signed-up-and-never-opened pile cost: the figure the libraries exist for. */
  backlogSpend: number;
  /** Hours still ahead in what is open, from the advertised length and the progress. */
  hoursAhead: number;
  finishedThisYear: number;
  providers: string[];
};

/** A target «2026-11» is late only once November is over — the editorial calendar's rule. */
function isLate(targetDate: string | null, status: CourseStatus, today: string): boolean {
  if (!targetDate || status === "finished" || status === "dropped" || status === "wishlist") return false;
  const target = targetDate.slice(0, 10);
  return target.length === 10 ? target < today : target < today.slice(0, target.length);
}

export async function getCourses(): Promise<CoursesSummary> {
  const [rows, timezone] = await Promise.all([
    db.course.findMany({ orderBy: [{ updatedAt: "desc" }] }),
    getTimezone(),
  ]);
  const today = calendarDate(timezone);

  const courses: CourseRow[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    provider: r.provider,
    url: r.url,
    status: r.status,
    progress: r.progress,
    hours: r.hours,
    hoursSpent: r.hoursSpent,
    price: r.price === null ? null : Number(r.price),
    startedAt: r.startedAt,
    targetDate: r.targetDate,
    finishedAt: r.finishedAt,
    note: r.note,
    certificateId: r.certificateId,
    late: isLate(r.targetDate, r.status, today),
  }));

  const counts = { wishlist: 0, backlog: 0, in_progress: 0, finished: 0, dropped: 0 } satisfies Record<CourseStatus, number>;
  for (const c of courses) counts[c.status]++;

  return {
    courses,
    counts,
    today,
    backlogSpend: courses.filter((c) => c.status === "backlog").reduce((n, c) => n + (c.price ?? 0), 0),
    hoursAhead: Math.round(
      courses
        .filter((c) => c.status === "in_progress" || c.status === "backlog")
        .reduce((n, c) => n + (c.hours ?? 0) * (1 - c.progress / 100), 0),
    ),
    finishedThisYear: courses.filter((c) => c.status === "finished" && c.finishedAt?.startsWith(today.slice(0, 4))).length,
    providers: [...new Set(courses.flatMap((c) => (c.provider ? [c.provider] : [])))].sort((a, b) => a.localeCompare(b)),
  };
}

function toRow(draft: CourseDraft) {
  return {
    title: draft.title.trim(),
    provider: blankToNull(draft.provider),
    url: blankToNull(draft.url),
    status: draft.status,
    progress: storedProgress(draft),
    hours: parseNumber(draft.hours),
    hoursSpent: parseNumber(draft.hoursSpent),
    price: parseNumber(draft.price),
    startedAt: blankToNull(draft.startedAt),
    targetDate: blankToNull(draft.targetDate),
    finishedAt: blankToNull(draft.finishedAt),
    note: blankToNull(draft.note),
  };
}

export async function createCourse(draft: CourseDraft): Promise<string> {
  return (await db.course.create({ data: toRow(draft), select: { id: true } })).id;
}

export async function updateCourse(draft: CourseDraft): Promise<void> {
  await db.course.update({ where: { id: draft.id }, data: toRow(draft) });
}

/** Finishing sets progress to 100, for the same reason the form does. */
export async function setCourseStatus(id: string, status: CourseStatus): Promise<{ title: string; finishedAt: string | null }> {
  const course = await db.course.update({
    where: { id },
    data: { status, ...(status === "finished" ? { progress: 100 } : {}) },
    select: { title: true, finishedAt: true },
  });
  return course;
}

/**
 * Turns a finished course into a certificate on the public site, in both
 * languages, and links the two so it cannot be published twice.
 *
 * At the end of the list: the Platzi import keeps its order, and the newest
 * certificate is the one most worth seeing last-added in the editor.
 */
export async function publishCertificate(
  courseId: string,
  provider: string,
  draft: CertificateFromCourse,
): Promise<{ certificateId: string; title: string } | { error: string }> {
  return db.$transaction(async (tx) => {
    const course = await tx.course.findUniqueOrThrow({
      where: { id: courseId },
      select: { title: true, certificateId: true },
    });
    if (course.certificateId) return { error: "Este curso ya tiene su certificado." };

    const last = await tx.certificate.aggregate({ _max: { position: true } });
    const certificate = await tx.certificate.create({
      data: {
        provider: provider.trim(),
        dateLabel: blankToNull(draft.dateLabel),
        credentialUrl: draft.url.trim(),
        position: (last._max.position ?? -1) + 1,
        translations: {
          create: locales.map((locale) => ({
            locale,
            title: draft.title[locale].trim(),
            category: draft.category[locale].trim(),
          })),
        },
      },
      select: { id: true },
    });
    await tx.course.update({ where: { id: courseId }, data: { certificateId: certificate.id } });
    return { certificateId: certificate.id, title: course.title };
  });
}

/** Categories the certificates already use, in both languages, to suggest the pair. */
export async function certificateCategories(): Promise<{ es: string; en: string }[]> {
  const rows = await db.certificateTranslation.findMany({ select: { certificateId: true, locale: true, category: true } });
  const byCertificate = new Map<string, { es: string; en: string }>();
  for (const row of rows) {
    const pair = byCertificate.get(row.certificateId) ?? { es: "", en: "" };
    if (row.locale === "es" || row.locale === "en") pair[row.locale] = row.category;
    byCertificate.set(row.certificateId, pair);
  }
  const seen = new Map<string, { es: string; en: string }>();
  for (const pair of byCertificate.values()) if (pair.es && pair.en && !seen.has(pair.es)) seen.set(pair.es, pair);
  return [...seen.values()].sort((a, b) => a.es.localeCompare(b.es));
}
