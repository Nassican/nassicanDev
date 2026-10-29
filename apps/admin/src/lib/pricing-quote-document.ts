import type { BillingPlanDetails, PricingSnapshot, PricingStatus, PricingUnit } from "@nassican/shared";
import { modeLabels, scopeLabels } from "./pricing-draft";

/** Explicit allowlist of information suitable for the client-facing document. */
export type QuoteDocument = {
  billing?: BillingPlanDetails;
  reference: string;
  title: string;
  client: string;
  location: string;
  issued: string;
  validity: string;
  status: PricingStatus;
  service: string;
  services: string[];
  scope: string;
  mode: string;
  unit: PricingUnit;
  description: string;
  amount: number;
  currency: string;
  family: boolean;
};

export function quoteDocument(
  quote: {
    id: string;
    title: string;
    createdAt: Date | string;
    validUntil: string | null;
    status: PricingStatus;
    final: number;
    currency: string;
    unit: PricingUnit;
    snapshot: PricingSnapshot;
  },
  timezone = "America/Bogota",
): QuoteDocument {
  const s = quote.snapshot;
  const names = (
    s.service.components?.length ? s.service.components : (s.service.selectedServices ?? [])
  ).map((item) => item.name);
  return {
    reference: `NAS-${quote.id.replace(/-/g, "").slice(0, 12).toUpperCase()}`,
    title: quote.title,
    client: s.client.name,
    location: [
      s.client.location.municipality,
      s.client.location.department,
      s.client.location.country,
    ]
      .filter(Boolean)
      .join(", "),
    issued: new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: timezone }).format(
      new Date(quote.createdAt),
    ),
    validity: quote.validUntil ?? "Sin fecha definida",
    status: quote.status,
    service: s.service.name,
    services: [...new Set(names)],
    scope: scopeLabels[s.service.scope],
    mode: modeLabels[s.inputs.mode],
    unit: quote.unit,
    description: s.service.description,
    amount: quote.final,
    currency: quote.currency,
    family: Boolean(s.result.family),
  };
}

export function quotePdfFilename(reference: string) {
  return `cotizacion-nassican-${reference.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase()}.pdf`;
}
