import type { QuoteDocument } from "./pricing-quote-document";
import { quoteStatusLabels } from "./pricing-draft";
import { renderCommercialPdf } from "./commercial-pdf";
import { emptyBillingIssuer, emptyBillingParty } from "./billing-values";

type Brand = { logo: Uint8Array; name?: string; email?: string };
export async function createQuotePdf(quote: QuoteDocument, brand: Brand) {
  const billing = quote.billing;
  return renderCommercialPdf({
    kind: "quote",
    reference: quote.reference,
    issued: quote.issued,
    validity: quote.validity,
    title: quote.title,
    concept: [...new Set([quote.service, ...quote.services].filter(Boolean))].join("\n"),
    description: quote.description,
    amount: quote.amount,
    currency: quote.currency,
    unit: quote.unit,
    issuer: billing?.issuer ?? {
      ...emptyBillingIssuer(),
      name: brand.name || "Nassican",
      email: brand.email || "",
    },
    recipient: billing?.recipient ?? {
      ...emptyBillingParty(),
      name: quote.client,
      city: quote.location,
    },
    logo: brand.logo,
    installments: billing?.installments,
    paymentTerms: billing?.paymentTerms,
    deliveryTerms: billing?.deliveryTerms,
    period: billing?.period,
    status: `${quoteStatusLabels[quote.status]}${quote.family ? " · Tarifa familiar" : ""}`,
  });
}
