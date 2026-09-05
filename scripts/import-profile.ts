/**
 * Moves the profile and the credentials - experience, education, certificates -
 * from `apps/web/src/lib/data/` into the database.
 *
 *   npm run profile:import           # writes
 *   npm run profile:import -- --dry  # reports what it would write
 *
 * Idempotent: every row is keyed by something stable in the source data (the
 * organisation plus its start date, the certificate's credential URL), so
 * running it twice updates rather than duplicates.
 *
 * Depends on `npm run content:import` having run first: experience entries
 * reference technologies by foreign key.
 */
import { db } from "@nassican/db";
import { prismaJson } from "@nassican/db";
import { profile } from "../apps/web/src/lib/data/profile";
import { experience } from "../apps/web/src/lib/data/experience";
import { education } from "../apps/web/src/lib/data/education";
import { certificates } from "../apps/web/src/lib/data/certificates";

const dryRun = process.argv.includes("--dry");
const locales = ["es", "en"] as const;

function say(action: string, detail: string) {
  console.log(`${dryRun ? "[simulacro] " : ""}${action.padEnd(16)} ${detail}`);
}

async function importProfile() {
  say("perfil", profile.name);
  if (dryRun) return;

  const fields = {
    fullName: profile.name,
    email: profile.email,
    location: prismaJson.record(profile.location),
    socials: prismaJson.record({ items: profile.socials }),
  };

  await db.profile.upsert({
    where: { id: 1 },
    update: fields,
    create: { id: 1, ...fields },
  });

  for (const locale of locales) {
    await db.profileTranslation.upsert({
      where: { profileId_locale: { profileId: 1, locale } },
      update: { headline: profile.title[locale] },
      create: { profileId: 1, locale, headline: profile.title[locale] },
    });
  }

  for (const [position, cv] of profile.cv.entries()) {
    say("cv", `${cv.lang} → ${cv.href}`);
    const row = await db.profileCv.upsert({
      where: { profileId_lang: { profileId: 1, lang: cv.lang } },
      update: { href: cv.href, position },
      create: { profileId: 1, lang: cv.lang, href: cv.href, position },
    });

    for (const locale of locales) {
      await db.profileCvTranslation.upsert({
        where: { cvId_locale: { cvId: row.id, locale } },
        update: { label: cv.label[locale] },
        create: { cvId: row.id, locale, label: cv.label[locale] },
      });
    }
  }
}

async function importExperience() {
  const technologies = await db.technology.findMany({
    select: { id: true, key: true },
  });
  const byKey = new Map(technologies.map((t) => [t.key, t.id]));

  for (const [position, item] of experience.entries()) {
    say("experiencia", `${item.org} (${item.start})`);

    for (const name of item.stack) {
      if (!byKey.has(name)) {
        console.warn(`  aviso: "${name}" no existe en technologies`);
      }
    }

    if (dryRun) continue;

    // `org` alone is not unique - two stints at the same place are possible -
    // so the start date is part of the key.
    const existing = await db.experience.findFirst({
      where: { org: item.org, startDate: item.start },
      select: { id: true },
    });

    const fields = {
      org: item.org,
      startDate: item.start,
      endDate: item.end ?? null,
      position,
    };

    const row = existing
      ? await db.experience.update({ where: { id: existing.id }, data: fields })
      : await db.experience.create({ data: fields });

    for (const locale of locales) {
      const data = {
        title: item.title[locale],
        periodLabel: item.period[locale],
        description: item.desc[locale],
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
        .map((name, index) => {
          const technologyId = byKey.get(name);
          return technologyId
            ? { experienceId: row.id, technologyId, position: index }
            : null;
        })
        .filter((r): r is NonNullable<typeof r> => r !== null),
    });
  }
}

async function importEducation() {
  for (const [position, item] of education.entries()) {
    say("formación", `${item.org} (${item.start})`);
    if (dryRun) continue;

    const existing = await db.education.findFirst({
      where: { institution: item.org, startDate: item.start },
      select: { id: true },
    });

    const fields = {
      institution: item.org,
      startDate: item.start,
      endDate: item.end ?? null,
      status: item.status === "completed" ? ("completed" as const) : ("in_progress" as const),
      link: item.link ?? null,
      position,
    };

    const row = existing
      ? await db.education.update({ where: { id: existing.id }, data: fields })
      : await db.education.create({ data: fields });

    for (const locale of locales) {
      const data = {
        degree: item.title[locale],
        periodLabel: item.period[locale],
        description: item.desc[locale],
      };
      await db.educationTranslation.upsert({
        where: { educationId_locale: { educationId: row.id, locale } },
        update: data,
        create: { educationId: row.id, locale, ...data },
      });
    }
  }
}

async function importCertificates() {
  for (const [position, item] of certificates.entries()) {
    say("certificado", `${item.provider} · ${item.title.es}`);
    if (dryRun) continue;

    // The credential URL is the natural key: it is what identifies the diploma.
    const existing = await db.certificate.findFirst({
      where: { credentialUrl: item.url },
      select: { id: true },
    });

    const fields = {
      provider: item.provider,
      dateLabel: item.date ?? null,
      credentialUrl: item.url,
      position,
    };

    const row = existing
      ? await db.certificate.update({ where: { id: existing.id }, data: fields })
      : await db.certificate.create({ data: fields });

    for (const locale of locales) {
      const data = {
        title: item.title[locale],
        category: item.category[locale],
      };
      await db.certificateTranslation.upsert({
        where: { certificateId_locale: { certificateId: row.id, locale } },
        update: data,
        create: { certificateId: row.id, locale, ...data },
      });
    }
  }
}

async function main() {
  if (dryRun) console.log("Simulacro: no se escribe nada.\n");

  await importProfile();
  await importExperience();
  await importEducation();
  await importCertificates();

  if (!dryRun) {
    const [exp, edu, certs, cvs] = await Promise.all([
      db.experience.count(),
      db.education.count(),
      db.certificate.count(),
      db.profileCv.count(),
    ]);
    console.log(
      `\nEn la base: ${exp} experiencias · ${edu} formaciones · ${certs} certificados · ${cvs} CVs`,
    );
  }

  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
