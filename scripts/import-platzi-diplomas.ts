/**
 * Gives each Platzi certificate its diploma image.
 *
 *   npm run certificates:diplomas -- <carpeta> --dry   informa sin escribir
 *   npm run certificates:diplomas -- <carpeta>         escribe
 *
 * Reads the same export as `certificates:platzi` (`data.courses[].diploma`),
 * downloads each `diploma_image`, and stores it through the panel's own
 * pipeline — `storeImage`: WebP at quality 82, a 16 px blur placeholder, and the
 * checksum as the URL, so a second run reuses the rows instead of duplicating
 * them. The images live in a «Certificados» folder of the media library.
 *
 * **The alt text says what the image shows**, read off a real diploma: Platzi
 * certifying the operator, by full name, for passing the course, on the date
 * printed on it. Not «diploma» alone — that is a label, and a screen reader user
 * deserves the same facts a sighted visitor reads. The English alt says the
 * diploma is in Spanish, because it is.
 *
 * The date is the approval date in Bogotá, which is the date the diploma prints:
 * the export stores it in UTC, and an evening approval is the next day there.
 *
 * Only certificates without an image are touched; `--force` redoes them all.
 */
import fs from "node:fs";
import path from "node:path";
import { db } from "@nassican/db";
import { cacheTags } from "@nassican/shared";
import { storeImage } from "../apps/admin/src/lib/media";
import { revalidatePublicSite } from "../apps/admin/src/lib/revalidate";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const force = args.includes("--force");
const folder = args.find((a) => !a.startsWith("--"));

const TIMEZONE = "America/Bogota";
const FOLDER_NAME = "Certificados";

type Course = { id: number; diploma?: { diploma_image?: string; approved_date?: string } | null };

const courseIdOf = (url: string) => Number(/\/curso\/(\d+)-/.exec(url)?.[1] ?? NaN);

const longDate = (iso: string, locale: "es-CO" | "en-US") =>
  new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: TIMEZONE }).format(
    new Date(iso),
  );

async function download(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    // Platzi's CDN refuses requests without a browser-like agent.
    headers: { "User-Agent": "Mozilla/5.0 (App Nassican; diploma import)", Referer: "https://platzi.com/" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const type = response.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) throw new Error(`no es una imagen (${type || "sin tipo"})`);
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  if (!folder) throw new Error("Falta la carpeta: npm run certificates:diplomas -- <carpeta>");

  const courses = new Map(
    fs
      .readdirSync(folder)
      .filter((f) => f.endsWith(".json"))
      .flatMap((f) => (JSON.parse(fs.readFileSync(path.join(folder, f), "utf8")) as { data: { courses: Course[] } }).data.courses)
      .map((c) => [c.id, c]),
  );

  const [profile, certificates] = await Promise.all([
    db.profile.findUnique({ where: { id: 1 }, select: { fullName: true } }),
    db.certificate.findMany({
      where: { provider: "Platzi", ...(force ? {} : { fileMediaId: null }) },
      include: { translations: true },
      orderBy: { position: "asc" },
    }),
  ]);
  if (!profile) throw new Error("No hay perfil: el texto alternativo necesita el nombre que imprime el diploma.");

  const library = dry
    ? null
    : ((await db.mediaFolder.findFirst({ where: { name: FOLDER_NAME, parentId: null } })) ??
      (await db.mediaFolder.create({ data: { name: FOLDER_NAME } })));

  console.log(`\n${certificates.length} certificados sin imagen${force ? " (--force: todos)" : ""}.\n`);

  let stored = 0;
  let before = 0;
  let after = 0;
  const failed: string[] = [];

  // One at a time: 37 small downloads, and hammering a CDN in parallel is how a
  // run ends in 429s that mean nothing.
  for (const certificate of certificates) {
    const es = certificate.translations.find((t) => t.locale === "es")?.title ?? "";
    const en = certificate.translations.find((t) => t.locale === "en")?.title ?? es;
    const course = courses.get(courseIdOf(certificate.credentialUrl));
    const url = course?.diploma?.diploma_image;
    const approved = course?.diploma?.approved_date;

    if (!url || !approved) {
      failed.push(`${es}: no está en la exportación`);
      continue;
    }

    const alt = {
      es: `Diploma de Platzi que certifica a ${profile.fullName} por aprobar «${es}» el ${longDate(approved, "es-CO")}.`,
      en: `Platzi diploma (in Spanish) certifying that ${profile.fullName} passed “${en}” on ${longDate(approved, "en-US")}.`,
    };

    if (dry) {
      console.log(`  · ${es}\n      ${alt.es}\n      ${alt.en}`);
      continue;
    }

    try {
      const bytes = await download(url);
      const media = await storeImage({ input: bytes, folderId: library!.id });

      await db.$transaction([
        ...(["es", "en"] as const).map((locale) =>
          db.mediaTranslation.upsert({
            where: { mediaId_locale: { mediaId: media.id, locale } },
            create: { mediaId: media.id, locale, alt: alt[locale], title: `Diploma: ${locale === "es" ? es : en}` },
            update: { alt: alt[locale], title: `Diploma: ${locale === "es" ? es : en}` },
          }),
        ),
        db.certificate.update({ where: { id: certificate.id }, data: { fileMediaId: media.id } }),
      ]);

      stored++;
      before += bytes.length;
      after += Number(media.sizeBytes);
      console.log(
        `  ✓ ${es}  ${Math.round(bytes.length / 1024)} KB → ${Math.round(Number(media.sizeBytes) / 1024)} KB webp · ${media.width}×${media.height}`,
      );
    } catch (error) {
      failed.push(`${es}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (!dry) {
    console.log(
      `\n${stored} diplomas guardados: ${Math.round(before / 1024)} KB → ${Math.round(after / 1024)} KB (−${before ? Math.round((1 - after / before) * 100) : 0} %).`,
    );
  }
  for (const line of failed) console.log(`  ✗ ${line}`);

  if (!dry && stored > 0) {
    const result = await revalidatePublicSite([cacheTags.certificates]);
    console.log(result.ok ? "El sitio público ya lo sabe." : `No se pudo avisar al sitio: ${result.reason}`);
  }

  await db.$disconnect();
  if (failed.length > 0) process.exitCode = 1;
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
