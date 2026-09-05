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
    include: { translations: true },
    orderBy: { position: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    dateLabel: row.dateLabel ?? "",
    url: row.credentialUrl,
    title: pick(row.translations, (t: { title: string }) => t.title),
    category: pick(row.translations, (t: { category: string }) => t.category),
  }));
}
