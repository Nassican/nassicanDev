export type UploadedMedia = {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  sizeBytes: number;
};

export type UploadResult =
  | { ok: true; media: UploadedMedia }
  | { ok: false; error: string };

/**
 * Sends one image to `/api/media/upload`, where it is converted to WebP and
 * stored. Shared by the cover picker and the body editor so both report the
 * same errors and the same saving.
 */
export async function uploadImage(file: File): Promise<UploadResult> {
  const body = new FormData();
  body.append("file", file);

  try {
    const response = await fetch("/api/media/upload", { method: "POST", body });
    const result = await response.json();

    if (!response.ok) {
      return { ok: false, error: result.error ?? "No se pudo subir la imagen." };
    }

    return { ok: true, media: result as UploadedMedia };
  } catch {
    return { ok: false, error: "No se pudo contactar con el servidor." };
  }
}

/** "180 KB → 24 KB webp (−87 %) · 1920×1080" */
export function savingLabel(originalBytes: number, media: UploadedMedia): string {
  const saved = Math.round((1 - media.sizeBytes / originalBytes) * 100);
  return `${Math.round(originalBytes / 1024)} KB → ${Math.round(media.sizeBytes / 1024)} KB webp${
    saved > 0 ? ` (−${saved}%)` : ""
  } · ${media.width}×${media.height}`;
}
