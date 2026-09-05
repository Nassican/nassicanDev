"use server";

import { revalidatePath } from "next/cache";
import { db, prismaJson } from "@nassican/db";
import { cacheTags, locales } from "@nassican/shared";
import { requireUser } from "@/lib/session";
import { revalidatePublicSite } from "@/lib/revalidate";
import type {
  CertificateDraft,
  EducationDraft,
  ExperienceDraft,
  ProfileDraft,
} from "@/lib/profile-draft";

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

/**
 * Every list is saved whole: rows absent from the payload are deleted. These
 * are short, hand-curated lists, and replacing the set avoids a per-row
 * create/update/delete protocol for no benefit.
 */
async function done(tag: string, what: string): Promise<ActionResult> {
  revalidatePath("/perfil");
  const result = await revalidatePublicSite([tag]);

  return result.ok
    ? { ok: true, message: `${what} guardado. Sitio actualizado.` }
    : {
        ok: true,
        message: `${what} guardado, pero no se pudo avisar al sitio (${result.reason}).`,
      };
}

export async function saveProfile(draft: ProfileDraft): Promise<ActionResult> {
  await requireUser();

  if (!draft.name.trim() || !draft.email.trim()) {
    return { ok: false, message: "El nombre y el correo no pueden quedar vacíos." };
  }

  const missing = locales.filter((l) => !draft.headline[l]?.trim());
  if (missing.length > 0) {
    return {
      ok: false,
      message: `Falta el titular profesional en: ${missing.join(", ")}.`,
    };
  }

  const fields = {
    fullName: draft.name.trim(),
    email: draft.email.trim(),
    location: prismaJson.record(draft.location),
    socials: prismaJson.record({
      items: draft.socials.filter((s) => s.label.trim() && s.href.trim()),
    }),
  };

  await db.profile.upsert({
    where: { id: 1 },
    update: fields,
    create: { id: 1, ...fields },
  });

  for (const locale of locales) {
    const headline = draft.headline[locale].trim();
    await db.profileTranslation.upsert({
      where: { profileId_locale: { profileId: 1, locale } },
      update: { headline },
      create: { profileId: 1, locale, headline },
    });
  }

  const keep = draft.cvs.filter((cv) => cv.lang.trim() && cv.href.trim());
  await db.profileCv.deleteMany({
    where: { profileId: 1, lang: { notIn: keep.map((cv) => cv.lang.trim()) } },
  });

  for (const [position, cv] of keep.entries()) {
    const row = await db.profileCv.upsert({
      where: { profileId_lang: { profileId: 1, lang: cv.lang.trim() } },
      update: { href: cv.href.trim(), position },
      create: { profileId: 1, lang: cv.lang.trim(), href: cv.href.trim(), position },
    });
    for (const locale of locales) {
      const label = cv.label[locale]?.trim() ?? "";
      await db.profileCvTranslation.upsert({
        where: { cvId_locale: { cvId: row.id, locale } },
        update: { label },
        create: { cvId: row.id, locale, label },
      });
    }
  }

  return done(cacheTags.profile, "Perfil");
}

export async function saveExperience(
  items: ExperienceDraft[],
): Promise<ActionResult> {
  await requireUser();

  const technologies = await db.technology.findMany({ select: { id: true, key: true } });
  const byKey = new Map(technologies.map((t) => [t.key, t.id]));

  const keep = items.filter((i) => i.org.trim() && i.start.trim());
  await db.experience.deleteMany({
    where: { id: { notIn: keep.map((i) => i.id).filter((id): id is string => !!id) } },
  });

  for (const [position, item] of keep.entries()) {
    const fields = {
      org: item.org.trim(),
      startDate: item.start.trim(),
      endDate: item.end.trim() || null,
      position,
    };

    const row = item.id
      ? await db.experience.update({ where: { id: item.id }, data: fields })
      : await db.experience.create({ data: fields });

    for (const locale of locales) {
      const data = {
        title: item.title[locale]?.trim() ?? "",
        periodLabel: item.period[locale]?.trim() ?? "",
        description: item.description[locale]?.trim() ?? "",
      };
      await db.experienceTranslation.upsert({
        where: { experienceId_locale: { experienceId: row.id, locale } },
        update: data,
        create: { experienceId: row.id, locale, ...data },
      });
    }

    await db.experienceTechnology.deleteMany({ where: { experienceId: row.id } });
    await db.experienceTechnology.createMany({
      data: item.stack
        .map((key, index) => {
          const technologyId = byKey.get(key);
          return technologyId
            ? { experienceId: row.id, technologyId, position: index }
            : null;
        })
        .filter((r): r is NonNullable<typeof r> => r !== null),
    });
  }

  return done(cacheTags.experience, "Experiencia");
}

export async function saveEducation(
  items: EducationDraft[],
): Promise<ActionResult> {
  await requireUser();

  const keep = items.filter((i) => i.org.trim() && i.start.trim());
  await db.education.deleteMany({
    where: { id: { notIn: keep.map((i) => i.id).filter((id): id is string => !!id) } },
  });

  for (const [position, item] of keep.entries()) {
    const fields = {
      institution: item.org.trim(),
      startDate: item.start.trim(),
      endDate: item.end.trim() || null,
      status: item.status === "completed" ? ("completed" as const) : ("in_progress" as const),
      link: item.link.trim() || null,
      position,
    };

    const row = item.id
      ? await db.education.update({ where: { id: item.id }, data: fields })
      : await db.education.create({ data: fields });

    for (const locale of locales) {
      const data = {
        degree: item.degree[locale]?.trim() ?? "",
        periodLabel: item.period[locale]?.trim() ?? "",
        description: item.description[locale]?.trim() ?? "",
      };
      await db.educationTranslation.upsert({
        where: { educationId_locale: { educationId: row.id, locale } },
        update: data,
        create: { educationId: row.id, locale, ...data },
      });
    }
  }

  return done(cacheTags.education, "Formación");
}

export async function saveCertificates(
  items: CertificateDraft[],
): Promise<ActionResult> {
  await requireUser();

  const keep = items.filter((i) => i.provider.trim() && i.url.trim());
  await db.certificate.deleteMany({
    where: { id: { notIn: keep.map((i) => i.id).filter((id): id is string => !!id) } },
  });

  for (const [position, item] of keep.entries()) {
    const fields = {
      provider: item.provider.trim(),
      dateLabel: item.dateLabel.trim() || null,
      credentialUrl: item.url.trim(),
      position,
    };

    const row = item.id
      ? await db.certificate.update({ where: { id: item.id }, data: fields })
      : await db.certificate.create({ data: fields });

    for (const locale of locales) {
      const data = {
        title: item.title[locale]?.trim() ?? "",
        category: item.category[locale]?.trim() ?? "",
      };
      await db.certificateTranslation.upsert({
        where: { certificateId_locale: { certificateId: row.id, locale } },
        update: data,
        create: { certificateId: row.id, locale, ...data },
      });
    }
  }

  return done(cacheTags.certificates, "Certificados");
}
