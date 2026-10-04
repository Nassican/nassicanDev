import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { parseBackup, type BackupFile } from "@nassican/db";
import { cacheTags } from "@nassican/shared";
import { logAudit } from "@/lib/audit";
import { RESTORE_CONFIRMATION } from "@/lib/restore-confirm";
import { applyRestore, loadRestorePoint, previewRestore } from "@/lib/restore";
import { notifyPublicSite } from "@/lib/revalidate";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Under Vercel's 4.5 MB request limit, with room for the multipart framing. */
const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Previews or applies a restore, from an uploaded file or a restore point.
 *
 * A route rather than a server action because the browser sends a file. The
 * same request shape does both steps, so what is applied is exactly what was
 * previewed: the form sends the same file again with `mode=apply`, and the
 * server checks it all again rather than trusting that it was looked at.
 */
export async function POST(request: Request) {
  const user = await requireUser();
  if (user.role !== "owner") {
    return NextResponse.json({ error: "Solo un propietario puede restaurar." }, { status: 403 });
  }

  const form = await request.formData();
  const mode = form.get("mode");
  const upload = form.get("file");
  const pointId = form.get("point");

  let file: BackupFile;
  let source: string;
  try {
    if (upload instanceof File) {
      if (upload.size > MAX_BYTES) {
        return NextResponse.json({ error: "El archivo pesa más de 4 MB: no parece una copia de este panel." }, { status: 413 });
      }
      file = parseBackup(new Uint8Array(await upload.arrayBuffer()));
      source = `el archivo ${upload.name}`;
    } else if (typeof pointId === "string" && pointId) {
      const point = await loadRestorePoint(pointId);
      if (!point) return NextResponse.json({ error: "Ese punto ya no existe." }, { status: 404 });
      file = point;
      source = "un punto de restauración";
    } else {
      return NextResponse.json({ error: "Falta el archivo o el punto." }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo leer el archivo." },
      { status: 400 },
    );
  }

  const preview = await previewRestore(file);

  if (mode !== "apply") return NextResponse.json({ preview });

  if (form.get("confirm") !== RESTORE_CONFIRMATION) {
    return NextResponse.json({ error: `Escribe ${RESTORE_CONFIRMATION} para confirmar.` }, { status: 400 });
  }
  if (preview.problem) {
    return NextResponse.json({ error: preview.problem }, { status: 409 });
  }

  const started = Date.now();
  const stamp = new Date(file.createdAt).toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota",
  });
  const applied = await applyRestore(file, {
    userId: user.id,
    reason: `Antes de restaurar la copia del ${stamp}`,
  });

  // Every collection tag: each per-slug read also carries its collection's, so
  // this reaches every cached page without listing slugs.
  notifyPublicSite(Object.values(cacheTags).flatMap((t) => (typeof t === "string" ? [t] : [])));
  revalidatePath("/", "layout");

  await logAudit({
    userId: user.id,
    action: "restore",
    entityType: "backup",
    diff: {
      source,
      backupCreatedAt: file.createdAt,
      rows: applied.rows,
      notes: applied.notes.length,
      pointId: applied.pointId,
      ms: Date.now() - started,
    },
  });

  return NextResponse.json({
    ok: true,
    message: `Restaurada la copia del ${stamp}: ${applied.rows.toLocaleString("es-CO")} filas. Si no era lo que querías, «Volver a este punto» lo deshace.`,
    notes: applied.notes,
  });
}
