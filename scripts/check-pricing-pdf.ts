/** Synthetic export samples plus immutable saved-quote checks; no remote writes. */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { createQuotePdf } from "../apps/admin/src/lib/pricing-quote-pdf";
import type { QuoteDocument } from "../apps/admin/src/lib/pricing-quote-document";
import { emptyBillingIssuer, emptyBillingParty } from "../apps/admin/src/lib/billing-values";

async function main() {
  const directory = join(tmpdir(), "nassican-pricing-qa");
  await mkdir(directory, { recursive: true });
  const logo = await readFile("apps/admin/src/app/icon.png");
  const quote: QuoteDocument = {
    reference: "NAS-EJEMPLO2026",
    title: "Plataforma comercial Esferas",
    client: "María Muñoz · Empresa de ejemplo",
    location: "Pasto, Nariño, Colombia",
    issued: "28 de octubre de 2026",
    validity: "2026-11-15",
    status: "draft",
    service: "EsferasExplosivasShop + EsferasExplosivasApp",
    services: [
      "Tienda en línea EsferasExplosivasShop",
      "Inventario y operación EsferasExplosivasApp",
    ],
    scope: "Avanzado",
    mode: "Remota",
    unit: "project",
    description:
      "Tienda en línea conectada con la gestión de inventario y pedidos.\nIncluye configuración del catálogo, perfiles de usuario, pruebas del flujo de compra y capacitación.\nDeligurtPOS se cotiza como servicio independiente si se requiere.",
    amount: 9386000,
    currency: "COP",
    family: true,
  };
  await writeFile(
    join(directory, "cotizacion-nassican-ejemplo.pdf"),
    await createQuotePdf(quote, { logo, name: "Equipo Nassican", email: "contacto@example.com" }),
  );
  const long = {
    ...quote,
    title: "Propuesta con alcance extenso",
    amount: 1234.56,
    currency: "USD",
    unit: "monthly" as const,
    family: false,
    description: `${"Integración, configuración y pruebas de los módulos acordados. ".repeat(450)}\n${"X".repeat(700)}\nFINAL DEL ALCANCE EXTENSO`,
  };
  const bytes = await createQuotePdf(long, { logo });
  assert.equal(Buffer.from(bytes).subarray(0, 5).toString(), "%PDF-");
  await writeFile(join(directory, "cotizacion-nassican-extensa.pdf"), bytes);
  await writeFile(
    join(directory, "cotizacion-nassican-100-cuotas.pdf"),
    await createQuotePdf(
      {
        ...quote,
        family: false,
        billing: {
          version: 1,
          issuer: {
            ...emptyBillingIssuer(),
            name: "Nassican · emisor ficticio",
            identification: "CC 00000003",
          },
          recipient: {
            ...emptyBillingParty(),
            name: "Cliente ficticio",
            identification: "NIT 00000004",
          },
          installments: Array.from({ length: 100 }, (_, index) => ({
            id: randomUUID(),
            label: `CUOTA ${index + 1} · ${index === 99 ? "ULTIMO HITO DOCUMENTAL" : "Configuración, pruebas y entrega parcial de los módulos acordados"}`,
            amount: "93860.00",
            dueDate: null,
          })),
          paymentTerms: "Cien cuotas de prueba, sin cobros reales.",
          deliveryTerms: "Entrega ficticia para comprobar la paginación de las tablas.",
          period: "",
        },
      },
      { logo },
    ),
  );
  console.log(
    "Synthetic branded PDF samples created for visual review, including long descriptions and USD monthly pricing.",
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
