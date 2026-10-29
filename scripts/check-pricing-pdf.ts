/** Synthetic export samples plus immutable saved-quote checks; no remote writes. */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createQuotePdf } from "../apps/admin/src/lib/pricing-quote-pdf";
import type { QuoteDocument } from "../apps/admin/src/lib/pricing-quote-document";

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
  console.log(
    "Synthetic branded PDF samples created for visual review, including long descriptions and USD monthly pricing.",
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
