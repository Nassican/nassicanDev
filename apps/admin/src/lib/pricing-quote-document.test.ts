import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import type { PricingSnapshot } from "@nassican/shared";
import { quoteDocument, quotePdfFilename } from "./pricing-quote-document";
import { createQuotePdf } from "./pricing-quote-pdf";
import { defaultPricingParameters, calculatePricing } from "./pricing-engine";
import { emptyPricingQuote, quoteInput } from "./pricing-draft";

function savedQuote() {
  const input = quoteInput(
    emptyPricingQuote(),
    { minimum: 0, incomePercent: 0.1 },
    { monthlyIncome: 87654321, incomeOrigin: "declared" },
  );
  const snapshot: PricingSnapshot = {
    version: 1,
    parameters: defaultPricingParameters,
    inputs: input,
    result: calculatePricing(input, defaultPricingParameters),
    client: {
      name: "María Muñoz",
      type: "person",
      location: { country: "Colombia", department: "Nariño", municipality: "Pasto" },
      stratum: 6,
      zone: "urban",
    },
    providerLocation: { country: "Colombia", department: "Nariño", municipality: "Pasto" },
    service: {
      name: "Plataforma Esferas Shop + App",
      scope: "advanced",
      description: "Tienda y gestión de inventario.\nIncluye configuración y capacitación.",
      components: [
        {
          id: "shop",
          name: "EsferasExplosivasShop",
          hours: 120,
          minimum: 13000000,
          recommendedPrice: 13000000,
        },
        {
          id: "app",
          name: "EsferasExplosivasApp",
          hours: 180,
          minimum: 20000000,
          recommendedPrice: 20000000,
        },
      ],
    },
    geography: {
      factor: 1,
      origin: "estimated",
      level: "city",
      explanation: "PRIVATE_REGIONAL_REASON",
    },
    financial: null,
    tiers: [],
    marketEvidence: [],
    notes: ["PRIVATE_FINANCIAL_REASON"],
  };
  return {
    id: "12345678-1234-4234-8234-123456789abc",
    title: "Propuesta de plataforma",
    createdAt: "2026-10-29T01:00:00Z",
    validUntil: "2026-11-15",
    status: "draft" as const,
    final: 9386000,
    currency: "COP",
    unit: "project" as const,
    snapshot,
  };
}

test("client document uses the agreed final amount, frozen scope and local creation date", () => {
  const quote = savedQuote();
  const doc = quoteDocument(quote);
  assert.equal(doc.amount, 9386000);
  assert.equal(doc.client, "María Muñoz");
  assert.equal(doc.issued, "28 de octubre de 2026");
  assert.deepEqual(doc.services, ["EsferasExplosivasShop", "EsferasExplosivasApp"]);
  const text = JSON.stringify(doc);
  for (const privateValue of [
    "87654321",
    "PRIVATE_FINANCIAL_REASON",
    "PRIVATE_REGIONAL_REASON",
    "stratum",
    "financial",
    "parameters",
    "monthlyIncome",
    "recommendedPrice",
  ]) {
    assert.ok(!text.includes(privateValue), `Private value leaked: ${privateValue}`);
  }
  assert.equal((doc as unknown as Record<string, unknown>).minimum, undefined);
});

test("legacy, family, hourly and zero-valued quotes keep their actual agreed amount", () => {
  const quote = savedQuote();
  delete quote.snapshot.service.components;
  const family = calculatePricing(
    { ...quote.snapshot.inputs, family: true },
    defaultPricingParameters,
  ).family;
  const result = quoteDocument({
    ...quote,
    final: 0,
    unit: "hour",
    currency: "USD",
    validUntil: null,
    snapshot: { ...quote.snapshot, result: { ...quote.snapshot.result, family } },
  });
  assert.equal(result.amount, 0);
  assert.equal(result.family, true);
  assert.deepEqual(result.services, []);
  assert.equal(result.validity, "Sin fecha definida");
  assert.match(quotePdfFilename('NAS-123\r\n";bad/../'), /^cotizacion-nassican-[\w-]+\.pdf$/);
});

test("PDF generation handles accents, explicit zero and long paginated descriptions", async () => {
  const logo = readFileSync(join(process.cwd(), "apps/admin/src/app/icon.png"));
  const doc = quoteDocument(savedQuote());
  const short = await createQuotePdf(doc, { logo, name: "Nassican" });
  assert.equal(Buffer.from(short).subarray(0, 5).toString(), "%PDF-");
  const pdf = await PDFDocument.load(short);
  assert.equal(pdf.getAuthor(), "Nassican");
  assert.equal(pdf.getPageCount(), 1);
  const long = await createQuotePdf(
    {
      ...doc,
      amount: 0,
      currency: "USD",
      description: `${"Descripción con ñ y acentos. ".repeat(650)}\n${"X".repeat(700)}\nFINAL DEL ALCANCE`,
    },
    { logo },
  );
  const multi = await PDFDocument.load(long);
  assert.ok(multi.getPageCount() >= 3);
  assert.equal(
    multi.getPages().every((page) => page.getSize().width > 590),
    true,
  );
});
