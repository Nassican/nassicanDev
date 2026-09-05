import { NextResponse } from "next/server";
import { storeImage } from "@/lib/media";
import { currentSession } from "@/lib/session";

/** Beyond this an upload is a mistake, not a screenshot. */
const MAX_BYTES = 20 * 1024 * 1024;

const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/avif", "image/gif"];

/**
 * Uploads one image: it is optimised to WebP and stored in the database.
 *
 * A route handler rather than a server action because the browser sends a
 * file: multipart is what `FormData` produces natively, and streaming it here
 * avoids base64-ing megabytes through a server action payload.
 */
export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "falta el archivo" }, { status: 400 });
  }

  if (!ACCEPTED.includes(file.type)) {
    return NextResponse.json(
      { error: `Formato no admitido: ${file.type || "desconocido"}.` },
      { status: 415 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `El archivo pesa ${Math.round(file.size / 1024 / 1024)} MB; el máximo es 20 MB.` },
      { status: 413 },
    );
  }

  try {
    const media = await storeImage({
      input: Buffer.from(await file.arrayBuffer()),
      uploadedBy: session.user.id,
    });

    return NextResponse.json({
      id: media.id,
      url: media.url,
      width: media.width,
      height: media.height,
      sizeBytes: Number(media.sizeBytes),
    });
  } catch (error) {
    console.error("[media] fallo al procesar la subida", error);
    return NextResponse.json(
      { error: "No se pudo procesar la imagen. ¿Está corrupta?" },
      { status: 422 },
    );
  }
}
