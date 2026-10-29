import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { db } from "@nassican/db";
import { requireUser } from "@/lib/session";
import { billingAvailable } from "@/lib/billing";
import { billingUuid, parseBillingDetails } from "@/lib/billing-values";
import { renderCommercialPdf } from "@/lib/commercial-pdf";
import { getTimezone } from "@/lib/site-config";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!billingUuid(id) || !(await billingAvailable()))
    return NextResponse.json({ error: "Plan no disponible." }, { status: 404 });
  const plan = await db.billingPlan.findUnique({
    where: { id },
    include: { quote: { select: { validUntil: true } } },
  });
  if (!plan) return NextResponse.json({ error: "Plan no encontrado." }, { status: 404 });
  const s = parseBillingDetails(plan.details, Number(plan.amount));
  const scope =
    plan.details &&
    typeof plan.details === "object" &&
    !Array.isArray(plan.details) &&
    typeof plan.details.scopeDescription === "string"
      ? plan.details.scopeDescription
      : "";
  const reference = `NAS-${(plan.quoteId || plan.id).replace(/-/g, "").slice(0, 12).toUpperCase()}`;
  const timezone = await getTimezone();
  const bytes = await renderCommercialPdf({
    kind: "quote",
    reference,
    issued: new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: timezone }).format(
      plan.createdAt,
    ),
    validity: plan.quote?.validUntil ?? "Sin fecha definida",
    title: plan.title,
    concept: plan.title,
    description: scope,
    amount: Number(plan.amount),
    currency: plan.currency,
    unit: plan.unit,
    issuer: s.issuer,
    recipient: s.recipient,
    logo: await readFile(path.join(process.cwd(), "src/app/icon.png")),
    installments: s.installments,
    paymentTerms: s.paymentTerms,
    deliveryTerms: s.deliveryTerms,
    period: s.period,
  });
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="cotizacion-nassican-${reference.toLowerCase()}.pdf"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
