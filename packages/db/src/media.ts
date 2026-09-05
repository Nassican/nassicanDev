import "server-only";

import { db } from "./index";

export type StoredImage = {
  data: Buffer;
  mimeType: string;
  checksum: string;
};

/**
 * Reads one stored image by its checksum, which is what the public URL carries.
 *
 * Looking up by checksum rather than by id is what makes the URL immutable:
 * the bytes that answer `/media/<checksum>.webp` can never change, so both the
 * CDN and the browser may cache them forever. Replacing a project's cover
 * produces a different checksum and therefore a different URL.
 */
export async function readImageByChecksum(
  checksum: string,
): Promise<StoredImage | null> {
  const media = await db.media.findUnique({
    where: { checksum },
    select: { id: true, mimeType: true, blob: { select: { data: true } } },
  });

  if (!media?.blob) return null;

  return {
    data: Buffer.from(media.blob.data),
    mimeType: media.mimeType,
    checksum,
  };
}

/** `/media/<checksum>.webp` - the path stored in `media.url`. */
export function mediaPath(checksum: string, format = "webp"): string {
  return `/media/${checksum}.${format}`;
}

/** Pulls the checksum back out of a filename like `abc123.webp`. */
export function checksumFromFilename(filename: string): string | null {
  const match = /^([0-9a-f]{64})\.[a-z0-9]+$/.exec(filename);
  return match ? match[1] : null;
}
