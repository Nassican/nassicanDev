import "server-only";

import { db } from "@nassican/db";
import { locales, type Locale } from "@nassican/shared";
import {
  emptyLocalized,
  type CertificateDraft,
  type EducationDraft,
  type ExperienceDraft,
  type LocalizedText,
  type ProfileDraft,
  type SocialDraft,
} from "@/lib/profile-draft";

export * from "@/lib/profile-draft";

function pick(
  rows: { locale: Locale }[],
  read: (row: never) => string | null | undefined,
): LocalizedText {
  const out = emptyLocalized(locales);
  for (const locale of locales) {
    const row = rows.find((r) => r.locale === locale);
    out[locale] = row ? (read(row as never) ?? "") : "";
  }
  return out;
}

export async function getProfileDraft(): Promise<ProfileDraft> {
  const row = await db.profile.findUnique({
    where: { id: 1 },
    include: {
      translations: true,
      cvs: { include: { translations: true }, orderBy: { position: "asc" } },
    },
  });

  if (!row) {
    return {
      name: "",
      email: "",
      location: { city: "", region: "", country: "" },
      headline: emptyLocalized(locales),
      socials: [],
      cvs: [],
    };
  }

  return {
    name: row.fullName,
    email: row.email,
    location: (row.location ?? { city: "", region: "", country: "" }) as ProfileDraft["location"],
    headline: pick(row.translations, (t: { headline: string }) => t.headline),
    socials: ((row.socials as { items?: SocialDraft[] } | null)?.items ?? []),
    cvs: row.cvs.map((cv) => ({
      lang: cv.lang,
      href: cv.href,
      label: pick(cv.translations, (t: { label: string }) => t.label),
    })),
  };
}

export async function listExperience(): Promise<ExperienceDraft[]> {
  const rows = await db.experience.findMany({
    include: {
      translations: true,
      technologies: { include: { technology: true }, orderBy: { position: "asc" } },
    },
    orderBy: { position: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    org: row.org,
    start: row.startDate,
    end: row.endDate ?? "",
    stack: row.technologies.map((t) => t.technology.key),
    title: pick(row.translations, (t: { title: string }) => t.title),
    period: pick(row.translations, (t: { periodLabel: string }) => t.periodLabel),
    description: pick(row.translations, (t: { description: string }) => t.description),
  }));
}

export async function listEducation(): Promise<EducationDraft[]> {
  const rows = await db.education.findMany({
    include: { translations: true },
    orderBy: { position: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    org: row.institution,
    start: row.startDate,
    end: row.endDate ?? "",
    status: row.status === "completed" ? "completed" : "in-progress",
    link: row.link ?? "",
    degree: pick(row.translations, (t: { degree: string }) => t.degree),
    period: pick(row.translations, (t: { periodLabel: string }) => t.periodLabel),
    description: pick(row.translations, (t: { description: string | null }) => t.description),
  }));
}

export async function listCertificates(): Promise<CertificateDraft[]> {
  const rows = await db.certificate.findMany({
    include: {
      translations: true,
      file: { select: { url: true, translations: { select: { locale: true, alt: true } } } },
    },
    orderBy: { position: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    dateLabel: row.dateLabel ?? "",
    url: row.credentialUrl,
    title: pick(row.translations, (t: { title: string }) => t.title),
    category: pick(row.translations, (t: { category: string }) => t.category),
    fileMediaId: row.fileMediaId,
    imageUrl: row.file?.url ?? null,
    alt: pick(row.file?.translations ?? [], (t: { alt: string }) => t.alt),
  }));
}

/**
 * Writes the certificate list, touching only what changed.
 *
 * The editor sends the whole list, and this used to write all of it: an update
 * and two upserts per certificate. That was fine for three and became 111 writes
 * for the 37 Platzi diplomas — and a batched transaction did not save it, because
 * the Neon adapter still sends each statement on its own round trip: measured at
 * 9.4 s from Bogotá. What does save it is not writing what is already there. The
 * current rows are read once and compared, so saving an untouched list is one
 * read, and editing one certificate is one read and a couple of writes.
 *
 * The diploma is a link (`fileMediaId`) plus the alt text of the image it points
 * at, written to the media library. Returns the images this save let go of —
 * replaced, removed, or on a certificate that was deleted — so the caller can
 * decide what to do with the ones nothing else uses.
 */
export async function writeCertificates(items: CertificateDraft[]): Promise<{ writes: number; released: string[] }> {
  const keep = items.filter((i) => i.provider.trim() && i.url.trim());
  const linked = [...new Set(keep.flatMap((i) => (i.fileMediaId ? [i.fileMediaId] : [])))];

  const [current, alts] = await Promise.all([
    db.certificate.findMany({ include: { translations: true } }),
    linked.length > 0
      ? db.mediaTranslation.findMany({ where: { mediaId: { in: linked } }, select: { mediaId: true, locale: true, alt: true } })
      : [],
  ]);
  const byId = new Map(current.map((c) => [c.id, c]));

  const translations = (item: CertificateDraft) =>
    locales.map((locale) => ({
      locale,
      title: item.title[locale]?.trim() ?? "",
      category: item.category[locale]?.trim() ?? "",
    }));

  const kept = new Set(keep.flatMap((i) => (i.id ? [i.id] : [])));
  const removed = current.filter((c) => !kept.has(c.id));

  const writes = keep.flatMap((item, position) => {
    const fields = {
      provider: item.provider.trim(),
      dateLabel: item.dateLabel.trim() || null,
      credentialUrl: item.url.trim(),
      position,
      fileMediaId: item.fileMediaId,
    };

    const existing = item.id ? byId.get(item.id) : undefined;
    if (!existing) {
      return [db.certificate.create({ data: { ...fields, translations: { create: translations(item) } } })];
    }

    const id = existing.id;
    const changed =
      existing.provider !== fields.provider ||
      existing.dateLabel !== fields.dateLabel ||
      existing.credentialUrl !== fields.credentialUrl ||
      existing.position !== fields.position ||
      existing.fileMediaId !== fields.fileMediaId;

    return [
      ...(changed ? [db.certificate.update({ where: { id }, data: fields })] : []),
      ...translations(item)
        .filter(({ locale, title, category }) => {
          const saved = existing.translations.find((t) => t.locale === locale);
          return !saved || saved.title !== title || saved.category !== category;
        })
        .map(({ locale, ...data }) =>
          db.certificateTranslation.upsert({
            where: { certificateId_locale: { certificateId: id, locale } },
            update: data,
            create: { certificateId: id, locale, ...data },
          }),
        ),
    ];
  });

  // The image's alt text, for every linked image whose text changed. Keyed by
  // image: two certificates can share one, and the last one written wins.
  const altWrites = keep.flatMap((item) => {
    const mediaId = item.fileMediaId;
    if (!mediaId) return [];
    return locales
      .filter((locale) => {
        const text = item.alt[locale]?.trim() ?? "";
        const saved = alts.find((a) => a.mediaId === mediaId && a.locale === locale)?.alt ?? "";
        return text !== "" && text !== saved;
      })
      .map((locale) => {
        const alt = item.alt[locale].trim();
        return db.mediaTranslation.upsert({
          where: { mediaId_locale: { mediaId, locale } },
          update: { alt },
          create: { mediaId, locale, alt },
        });
      });
  });

  const all = [
    ...(removed.length > 0 ? [db.certificate.deleteMany({ where: { id: { in: removed.map((c) => c.id) } } })] : []),
    ...writes,
    ...altWrites,
  ];
  if (all.length > 0) await db.$transaction(all);

  const stillLinked = new Set(linked);
  const released = [
    ...new Set(
      current.flatMap((c) => (c.fileMediaId && !stillLinked.has(c.fileMediaId) ? [c.fileMediaId] : [])),
    ),
  ];
  return { writes: all.length, released };
}
