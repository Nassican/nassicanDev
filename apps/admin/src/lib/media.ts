import "server-only";

import { createHash } from "node:crypto";
import sharp from "sharp";
import { db, mediaPath } from "@nassican/db";

/**
 * Nothing on a portfolio is rendered wider than this, and the largest layout
 * slot is well under it. Anything bigger is a photo straight out of a camera
 * or a retina screenshot, and downscaling it is the single biggest saving.
 */
const MAX_WIDTH = 1920;

/** A blur placeholder small enough to inline as a data URI. */
const PLACEHOLDER_WIDTH = 16;

export type OptimisedImage = {
  data: Buffer;
  width: number;
  height: number;
  checksum: string;
  blurDataUrl: string;
};

/**
 * Converts anything sharp can read into a single optimised WebP.
 *
 * One format, one size: the alternative is a set of variants per breakpoint,
 * which is worth it for a photo gallery and not for a handful of screenshots.
 * `next/image` still serves it responsively through its own resizer.
 */
export async function optimiseImage(input: Buffer): Promise<OptimisedImage> {
  const image = sharp(input, { failOn: "error" }).rotate();
  const metadata = await image.metadata();

  const pipeline =
    metadata.width && metadata.width > MAX_WIDTH
      ? image.resize({ width: MAX_WIDTH, withoutEnlargement: true })
      : image;

  const { data, info } = await pipeline
    .webp({ quality: 82, effort: 5 })
    .toBuffer({ resolveWithObject: true });

  const placeholder = await sharp(data)
    .resize({ width: PLACEHOLDER_WIDTH })
    .webp({ quality: 40 })
    .toBuffer();

  return {
    data,
    width: info.width,
    height: info.height,
    checksum: createHash("sha256").update(data).digest("hex"),
    blurDataUrl: `data:image/webp;base64,${placeholder.toString("base64")}`,
  };
}

/**
 * Optimises and stores an image, returning the media row.
 *
 * Keyed by the checksum of the *stored* bytes, so uploading the same picture
 * twice reuses the row instead of duplicating the blob - and re-running an
 * import is free.
 */
export async function storeImage({
  input,
  uploadedBy,
  folderId,
}: {
  input: Buffer;
  uploadedBy?: string | null;
  folderId?: string | null;
}) {
  const image = await optimiseImage(input);
  const url = mediaPath(image.checksum);

  const existing = await db.media.findUnique({
    where: { checksum: image.checksum },
    select: { id: true },
  });

  const fields = {
    kind: "image" as const,
    storageKey: image.checksum,
    url,
    mimeType: "image/webp",
    sizeBytes: BigInt(image.data.length),
    width: image.width,
    height: image.height,
    blurDataUrl: image.blurDataUrl,
    folderId: folderId ?? null,
    uploadedBy: uploadedBy ?? null,
  };

  const media = existing
    ? await db.media.update({ where: { id: existing.id }, data: fields })
    : await db.media.create({ data: { ...fields, checksum: image.checksum } });

  // Prisma's Bytes maps to Uint8Array; Buffer is a subclass with a wider
  // backing type, so it needs converting rather than casting.
  const bytes = new Uint8Array(image.data);

  await db.mediaBlob.upsert({
    where: { mediaId: media.id },
    update: { data: bytes },
    create: { mediaId: media.id, data: bytes },
  });

  return media;
}
