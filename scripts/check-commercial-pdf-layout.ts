/** Synthetic commercial stationery checks. No database, credentials or financial writes. */
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PDFDocument } from "pdf-lib";
import {
  renderCommercialPdf,
  type CommercialPdfDocument,
} from "../apps/admin/src/lib/commercial-pdf";
import { emptyBillingIssuer, emptyBillingParty } from "../apps/admin/src/lib/billing-values";

async function main() {
  const directory = join(tmpdir(), "nassican-pricing-qa", "compact-pdf");
  await mkdir(directory, { recursive: true });
  const logo = await readFile("apps/admin/src/app/icon.png");
  const common = {
    reference: "NAS-EJEMPLO2026",
    issued: "2026-10-28",
    validity: "2026-11-28",
    title: "Plataforma comercial Esferas",
    concept: "EsferasExplosivasShop + EsferasExplosivasApp",
    description: Array.from(
      { length: 8 },
      (_, i) =>
        `Módulo ${i + 1}: configuración, integración y pruebas del flujo acordado con el cliente.`,
    ).join("\n"),
    amount: 9386000,
    currency: "COP",
    unit: "project",
    logo,
    issuer: {
      ...emptyBillingIssuer(),
      name: "Nassican · emisor de ejemplo",
      identification: "CC 00000003",
      address: "Dirección de ejemplo 123",
      city: "Pasto, Nariño",
      email: "emisor@example.invalid",
      phone: "+57 000 000 0000",
      bank: "Banco de ejemplo",
      accountType: "Ahorros",
      accountNumber: "0000000000",
      paymentInstructions:
        "Identifique la transferencia con la referencia de esta cuenta y confirme el pago al correo del emisor.",
    },
    recipient: {
      ...emptyBillingParty(),
      name: "Cliente de ejemplo documental",
      identification: "NIT 00000004",
      address: "Dirección comercial de ejemplo 456",
      city: "Bogotá, Colombia",
      email: "cliente@example.invalid",
      phone: "+57 000 000 0001",
    },
    paymentTerms:
      "Transferencia bancaria según los hitos acordados. Cada pago recibido se confirma antes de descontarlo del saldo.",
    deliveryTerms:
      "Entrega por avances; incluye revisión de los módulos acordados, pruebas y capacitación para usar la plataforma.",
  } satisfies Omit<CommercialPdfDocument, "kind">;
  const quote: CommercialPdfDocument = {
    ...common,
    kind: "quote",
    installments: Array.from({ length: 4 }, (_, i) => ({
      id: String(i + 1),
      label: [
        "Anticipo y definición",
        "Diseño y catálogo",
        "Integración y pruebas",
        "Entrega y capacitación",
      ][i],
      amount: "2346500.00",
      dueDate: null,
    })),
  };
  const charge: CommercialPdfDocument = {
    ...common,
    kind: "charge",
    reference: "NC-000001",
    quoteReference: common.reference,
    validity: undefined,
    description: common.description.split("\n").slice(0, 4).join("\n"),
    dueDate: "2026-11-28",
    paid: 1400000,
    receipts: Array.from({ length: 4 }, (_, i) => ({
      amount: 350000,
      paidAt: "2026-10-28",
      reference: `Transferencia de ejemplo ${i + 1}`,
    })),
  };
  const cases: [string, CommercialPdfDocument, boolean][] = [
    ["quote", quote, true],
    ["charge", charge, true],
    [
      "short",
      {
        ...quote,
        description: "Implementación del catálogo y entrega de la tienda.",
        installments: undefined,
      },
      true,
    ],
    [
      "long",
      {
        ...quote,
        description: `${"Integración, configuración y pruebas de todos los módulos acordados. ".repeat(300)}\nULTIMO CONTENIDO CONSERVADO`,
      },
      false,
    ],
    [
      "many-rows",
      {
        ...quote,
        installments: Array.from({ length: 100 }, (_, i) => ({
          id: String(i + 1),
          label: `HITO ${i + 1} · Entrega parcial y validación del avance acordado`,
          amount: "93860.00",
          dueDate: null,
        })),
      },
      false,
    ],
  ];
  for (const [name, document, single] of cases) {
    const before = JSON.stringify(document);
    const bytes = await renderCommercialPdf(document);
    assert.equal(JSON.stringify(document), before, "PDF formatting must not mutate the agreement.");
    const pages = (await PDFDocument.load(bytes)).getPageCount();
    if (!process.argv.includes("--baseline")) {
      if (single) assert.equal(pages, 1, `${name} should fit a legible A4 page`);
      else assert.ok(pages > 1, `${name} must retain its full content across pages`);
    }
    await writeFile(
      join(directory, `${name}${process.argv.includes("--baseline") ? "-before" : ""}.pdf`),
      bytes,
    );
    console.log(`${name}: ${pages} page(s)`);
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
