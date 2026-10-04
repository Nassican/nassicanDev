import { NextResponse } from "next/server";
import { readRestorePoint } from "@/lib/restore";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** A restore point as a downloadable backup: the same format, the same file. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user.role !== "owner") {
    return NextResponse.json({ error: "Solo un propietario puede descargarlo." }, { status: 403 });
  }

  const point = await readRestorePoint((await params).id);
  if (!point) return NextResponse.json({ error: "Ese punto ya no existe." }, { status: 404 });

  const stamp = point.createdAt.toISOString().slice(0, 16).replace(/[:T]/g, "-");
  return new NextResponse(new Uint8Array(point.data), {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="nassican-punto-${stamp}.json.gz"`,
      "Cache-Control": "no-store",
    },
  });
}
