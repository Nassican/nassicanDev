import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { db } from "@nassican/db";
import { requireUser } from "@/lib/session";
import { billingAvailable, parseChargeSnapshot } from "@/lib/billing";
import { billingUuid, billingMinor } from "@/lib/billing-values";
import { renderCommercialPdf } from "@/lib/commercial-pdf";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!billingUuid(id) || !(await billingAvailable()))
    return NextResponse.json({ error: "Cuenta no disponible." }, { status: 404 });
  const charge = await db.billingCharge.findUnique({
    where: { id },
    include: { receipts: { orderBy: { paidAt: "asc" } } },
  });
  if (!charge) return NextResponse.json({ error: "Cuenta no encontrada." }, { status: 404 });
  const s = parseChargeSnapshot(charge.snapshot);
  const paid = charge.receipts.reduce(
    (sum, r) => sum + billingMinor(r.amount.toString()),
    BigInt(0),
  );
  const reference = `NC-${String(charge.sequence).padStart(6, "0")}`;
  const bytes = await renderCommercialPdf({
    kind: "charge",
    reference,
    issued: s.issuedDate,
    dueDate: s.dueDate,
    title: s.projectTitle,
    concept: `${s.concept}\n${s.installmentLabel} (${s.installmentNumber} de ${s.installmentCount})`,
    description: "",
    amount: Number(s.amount),
    currency: s.currency,
    issuer: s.issuer,
    recipient: s.recipient,
    logo: await readFile(path.join(process.cwd(), "src/app/icon.png")),
    status: charge.canceledAt
      ? "Anulada"
      : paid >= billingMinor(s.amount)
        ? "Pagada"
        : paid > BigInt(0)
          ? "Con abonos"
          : "Pendiente",
    canceled: charge.canceledAt !== null,
    cancellationReason: charge.cancellationReason ?? "",
    quoteReference: s.quoteReference,
    paid: Number(paid) / 100,
    paymentTerms: s.paymentTerms,
    period: s.period,
    receipts: charge.receipts.map((r) => ({
      amount: Number(r.amount),
      paidAt: r.paidAt,
      reference: r.reference,
    })),
  });
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="cuenta-de-cobro-nassican-${reference.toLowerCase()}.pdf"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
