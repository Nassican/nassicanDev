/**
 * Moves images that still live as files under `apps/web/public/` into the
 * database, converted to WebP.
 *
 *   npm run media:optimise           # writes
 *   npm run media:optimise -- --dry  # reports what it would do
 *
 * Finds every `media` row whose URL still points at a path under /public,
 * optimises the file behind it and replaces the row with a database-backed one
 * served from `/media/<checksum>.webp`. Whatever referenced the media by
 * foreign key - a project cover, an article's OG image - keeps working, because
 * the row's id never changes.
 *
 * Idempotent: rows already served from /media are skipped.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { db, mediaPath } from "@nassican/db";

const dryRun = process.argv.includes("--dry");
const publicDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "apps",
  "web",
  "public",
);

const MAX_WIDTH = 1920;

function kb(bytes: number) {
  return `${Math.round(bytes / 1024)} KB`;
}

async function main() {
  const candidates = await db.media.findMany({
    where: { NOT: { url: { startsWith: "/media/" } } },
    select: { id: true, url: true, sizeBytes: true },
  });

  if (candidates.length === 0) {
    console.log("Nada que hacer: todas las imágenes ya están en la base.");
    await db.$disconnect();
    return;
  }

  for (const media of candidates) {
    const file = join(publicDir, media.url.replace(/^\//, ""));

    if (!existsSync(file)) {
      console.warn(`aviso: no existe el archivo de ${media.url}, se omite`);
      continue;
    }

    const original = readFileSync(file);
    const image = sharp(original, { failOn: "error" }).rotate();
    const metadata = await image.metadata();

    const pipeline =
      metadata.width && metadata.width > MAX_WIDTH
        ? image.resize({ width: MAX_WIDTH, withoutEnlargement: true })
        : image;

    const { data, info } = await pipeline
      .webp({ quality: 82, effort: 5 })
      .toBuffer({ resolveWithObject: true });

    const placeholder = await sharp(data)
      .resize({ width: 16 })
      .webp({ quality: 40 })
      .toBuffer();

    const checksum = createHash("sha256").update(data).digest("hex");
    const saved = Math.round((1 - data.length / original.length) * 100);

    console.log(
      `${dryRun ? "[simulacro] " : ""}${media.url}  ${kb(original.length)} → ${kb(data.length)} webp  (-${saved}%)  ${info.width}×${info.height}`,
    );

    if (dryRun) continue;

    await db.media.update({
      where: { id: media.id },
      data: {
        url: mediaPath(checksum),
        storageKey: checksum,
        checksum,
        mimeType: "image/webp",
        sizeBytes: BigInt(data.length),
        width: info.width,
        height: info.height,
        blurDataUrl: `data:image/webp;base64,${placeholder.toString("base64")}`,
      },
    });

    await db.mediaBlob.upsert({
      where: { mediaId: media.id },
      update: { data },
      create: { mediaId: media.id, data },
    });
  }

  if (!dryRun) {
    const remaining = await db.media.count({
      where: { NOT: { url: { startsWith: "/media/" } } },
    });
    const stored = await db.mediaBlob.count();
    console.log(
      `\n${stored} imágenes en la base · ${remaining} pendientes en /public`,
    );
  }

  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
