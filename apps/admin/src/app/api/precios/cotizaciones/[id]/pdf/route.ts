import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { db } from "@nassican/db";
import { requireUser } from "@/lib/session";
import { getTimezone } from "@/lib/site-config";
import { quoteDocument, quotePdfFilename } from "@/lib/pricing-quote-document";
import { createQuotePdf } from "@/lib/pricing-quote-pdf";
import { billingAvailable } from "@/lib/billing";
import { billingMinor, parseBillingDetails } from "@/lib/billing-values";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id))
    return NextResponse.json({ error: "Cotización no encontrada." }, { status: 404 });
  const quote = await db.pricingQuote.findUnique({ where: { id } });
  if (!quote) return NextResponse.json({ error: "Cotización no encontrada." }, { status: 404 });
  const [profile, timezone, logo] = await Promise.all([
    db.profile.findUnique({ where: { id: 1 }, select: { fullName: true, email: true } }),
    getTimezone(),
    readFile(path.join(process.cwd(), "src/app/icon.png")),
  ]);
  const document = quoteDocument({ ...quote, final: Number(quote.final) }, timezone);
  if (await billingAvailable()) {
    const plan = await db.billingPlan.findUnique({ where: { quoteId: id } });
    if (plan && billingMinor(plan.amount.toString()) === billingMinor(Number(quote.final)) && plan.currency === quote.currency)
      document.billing = parseBillingDetails(plan.details, Number(plan.amount));
  }
  const bytes = await createQuotePdf(document, {
    logo,
    name: profile?.fullName,
    email: profile?.email,
  });
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${quotePdfFilename(document.reference)}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
