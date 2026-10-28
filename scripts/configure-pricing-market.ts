/** Import reviewed public offers without changing services, settings or agreements. */
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadEnvConfig } from "@next/env";
import type { PricingScope, PricingUnit } from "@nassican/shared";
import catalog from "./data/pricing-portfolio.json";
import study from "./data/pricing-market-study-2026-10.json";

const prefix = "[Estudio mercado:";
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

async function main() {
  loadEnvConfig(join(process.cwd(), "apps/admin"));
  const { db, prismaJson } = await import("@nassican/db");
  try {
    const apply = process.argv.includes("--apply");
    const [services, existing, settings, tiers, agreements] = await Promise.all([
      db.pricingService.findMany({
        orderBy: { id: "asc" },
        include: { components: { orderBy: { componentId: "asc" } } },
      }),
      db.marketQuote.findMany(),
      db.pricingSettings.findUniqueOrThrow({ where: { id: "singleton" } }),
      db.pricingTier.findMany({ orderBy: { id: "asc" } }),
      db.pricingQuote.findMany({ orderBy: { id: "asc" } }),
    ]);
    assert.equal(new Set(study.references.map((r) => r.key)).size, study.references.length);
    const protectedBefore = digest({ services, settings, tiers, agreements });
    const country = "Colombia";
    const rows = study.references.map((reference) => {
      assert.match(reference.key, /^[a-z0-9-]+$/);
      assert.ok(Number.isSafeInteger(reference.price) && reference.price > 0);
      assert.ok(["project", "monthly", "hour"].includes(reference.unit));
      assert.ok(["basic", "standard", "advanced"].includes(reference.scope));
      assert.equal(new URL(reference.url).protocol, "https:");
      const definition = catalog.services.find((s) => s.key === reference.service);
      assert.ok(definition, `Servicio desconocido: ${reference.service}`);
      const service = services.find(
        (s) => s.name === definition.name || definition.aliases?.includes(s.name),
      );
      assert.ok(service?.active, `No se encontró el servicio activo ${definition.name}`);
      assert.equal(service.unit, reference.unit, `Unidad incompatible: ${reference.key}`);
      const marker = `${prefix}${reference.key}]`;
      const description = `${marker} ${reference.description} Consulta: ${study.checkedAt}. ${reference.priceKind === "starting" ? "Precio desde." : reference.priceKind === "promotion" ? "Oferta promocional, confirmar vigencia." : "Importe del plan publicado."} Alcance y modalidad clasificados como estimados; sin equivalencia funcional garantizada.`;
      const data = {
        serviceId: service.id,
        scope: reference.scope as PricingScope,
        description,
        price: reference.price,
        unit: reference.unit as PricingUnit,
        currency: "COP" as const,
        provider: reference.provider,
        country,
        department: reference.department ?? "",
        municipality: reference.municipality ?? "",
        mode: "remote" as const,
        date: study.checkedAt,
        source: "published" as const,
        url: reference.url,
        origin: "estimated" as const,
      };
      const owned = existing.filter((q) => q.description.startsWith(marker));
      assert.ok(owned.length <= 1, `Referencia repetida: ${reference.key}`);
      const found = owned[0];
      const equivalent = existing.find(
        (q) =>
          q.serviceId === data.serviceId &&
          q.url === data.url &&
          q.provider === data.provider &&
          Number(q.price) === data.price &&
          q.scope === data.scope &&
          q.unit === data.unit &&
          q.mode === data.mode &&
          q.country === data.country &&
          q.department === data.department &&
          q.municipality === data.municipality,
      );
      const unchanged =
        found &&
        Object.entries(data).every(([key, value]) =>
          key === "price"
            ? Number(found.price) === value
            : found[key as keyof typeof data] === value,
        );
      // A changed imported row may be the operator's edit. Never replace it.
      const status = found
        ? unchanged
          ? "sin cambios"
          : "personalizada, se conserva"
        : equivalent
          ? "ya existe, no duplicar"
          : "crear";
      return { key: reference.key, service: service.name, status, data, id: randomUUID() };
    });
    console.table(
      rows.map((r) => ({
        servicio: r.service,
        proveedor: r.data.provider,
        COP: r.data.price,
        unidad: r.data.unit,
        alcance: r.data.scope,
        acción: r.status,
      })),
    );
    const additions = rows.filter((r) => r.status === "crear");
    console.log(
      JSON.stringify({
        mode: apply ? "apply" : "dry",
        reviewed: rows.length,
        providers: new Set(rows.map((r) => r.data.provider)).size,
        services: new Set(rows.map((r) => r.data.serviceId)).size,
        additions: additions.length,
        preserved: rows.length - additions.length,
      }),
    );
    if (!apply || !additions.length) return;

    const directory = join(tmpdir(), "nassican-pricing-market");
    await mkdir(directory, { recursive: true });
    const backup = join(directory, `before-${Date.now()}.json`);
    await writeFile(
      backup,
      JSON.stringify(
        { capturedAt: new Date().toISOString(), existing, settings, tiers, services, agreements },
        null,
        2,
      ),
    );
    const owner = await db.user.findFirstOrThrow({
      where: { role: "owner", isActive: true },
      select: { id: true },
    });
    await db.$transaction(
      async (tx) => {
        // Recheck after preparing the backup so a second importer cannot duplicate this study.
        const concurrent = await tx.marketQuote.count({
          where: { description: { startsWith: prefix } },
        });
        assert.equal(
          concurrent,
          existing.filter((q) => q.description.startsWith(prefix)).length,
          "La muestra cambió; vuelve a simular.",
        );
        await tx.marketQuote.createMany({ data: additions.map((r) => ({ id: r.id, ...r.data })) });
        await tx.auditLog.createMany({
          data: additions.map((r) => ({
            userId: owner.id,
            action: "create" as const,
            entityType: "market_quote",
            entityId: r.id,
            diff: prismaJson.record({
              title: r.data.description,
              source: "configure-pricing-market",
              studyVersion: study.version,
              checkedAt: study.checkedAt,
              url: r.data.url,
              origin: "estimated",
            }),
          })),
        });
      },
      { timeout: 30000, isolationLevel: "Serializable" },
    );
    const [saved, servicesAfter, settingsAfter, tiersAfter, agreementsAfter] = await Promise.all([
      db.marketQuote.findMany({ where: { id: { in: additions.map((r) => r.id) } } }),
      db.pricingService.findMany({
        orderBy: { id: "asc" },
        include: { components: { orderBy: { componentId: "asc" } } },
      }),
      db.pricingSettings.findUniqueOrThrow({ where: { id: "singleton" } }),
      db.pricingTier.findMany({ orderBy: { id: "asc" } }),
      db.pricingQuote.findMany({ orderBy: { id: "asc" } }),
    ]);
    assert.equal(saved.length, additions.length);
    for (const row of additions) {
      const persisted = saved.find((q) => q.id === row.id)!;
      assert.equal(Number(persisted.price), row.data.price);
      assert.equal(persisted.unit, row.data.unit);
      assert.equal(persisted.serviceId, row.data.serviceId);
      assert.equal(persisted.origin, "estimated");
    }
    assert.equal(
      digest({
        services: servicesAfter,
        settings: settingsAfter,
        tiers: tiersAfter,
        agreements: agreementsAfter,
      }),
      protectedBefore,
      "Los datos protegidos cambiaron durante la carga; revisar concurrencia.",
    );
    const oldRows = await db.marketQuote.findMany({
      where: { id: { in: existing.map((q) => q.id) } },
    });
    assert.equal(
      digest(oldRows.sort((a, b) => a.id.localeCompare(b.id))),
      digest(existing.sort((a, b) => a.id.localeCompare(b.id))),
    );
    console.log(
      `Verificadas ${saved.length} referencias nuevas. Conservados servicios, parámetros, descuento familiar, tramos, acuerdos y referencias anteriores. Copia previa: ${backup}`,
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((error: unknown) => {
  console.error(
    error instanceof assert.AssertionError
      ? error.message
      : "No se pudo cargar el estudio de mercado. No se imprimieron credenciales.",
  );
  process.exitCode = 1;
});
