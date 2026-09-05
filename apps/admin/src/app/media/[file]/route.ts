import { checksumFromFilename, readImageByChecksum } from "@nassican/db";

/**
 * Serves an image out of the database.
 *
 * The filename is the checksum of the bytes, so the response can never go
 * stale: it is safe to tell every cache to keep it forever. That is what makes
 * storing the bytes in Postgres viable - the database answers once per image
 * per edge location, not once per visitor.
 *
 * `/media/<checksum>.webp` contains a dot, which the locale proxy's matcher
 * already excludes, so this path is never rewritten onto the [locale] segment.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  const checksum = checksumFromFilename(file);
  if (!checksum) return new Response("Not found", { status: 404 });

  const image = await readImageByChecksum(checksum);
  if (!image) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.mimeType,
      "Content-Length": String(image.data.length),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
