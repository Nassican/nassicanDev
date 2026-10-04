import { gzipSync } from "node:zlib";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { buildBackup } from "@/lib/backup";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Downloads the backup.
 *
 * Gzipped, and the reason is a limit rather than taste: a Vercel function
 * cannot answer with more than 4.5 MB. The whole database is 1.3 MB of JSON
 * today and 274 KB gzipped — less than the usual tenfold, because the images
 * are already compressed — so the ceiling sits sixteen times above it, not three.
 *
 * Owners only. A backup holds every user, the finances mirror and the audit
 * trail, and an editor's job does not need any of it.
 */
export async function GET() {
  const user = await requireUser();
  if (user.role !== "owner") {
    return NextResponse.json(
      { error: "Solo un propietario puede descargar la copia de seguridad." },
      { status: 403 },
    );
  }

  const started = Date.now();
  const { file, rows } = await buildBackup();
  const json = JSON.stringify(file);
  const body = gzipSync(json);

  await logAudit({
    userId: user.id,
    action: "export",
    entityType: "backup",
    diff: {
      rows,
      tables: Object.keys(file.tables).length,
      bytes: body.length,
      rawBytes: json.length,
      ms: Date.now() - started,
    },
  });

  const stamp = file.createdAt.slice(0, 16).replace(/[:T]/g, "-");

  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="nassican-${stamp}.json.gz"`,
      "Cache-Control": "no-store",
    },
  });
}
