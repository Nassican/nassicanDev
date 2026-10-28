/**
 * A reviewed commercial catalog, not an inferred record of completed work.
 * Defaults to a dry run. --apply updates only this catalog and its settings;
 * Wallet, project agreements and existing quote snapshots remain independent.
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import catalog from "./data/pricing-portfolio.json";
import { addMoney, divideMoney, scaleMoney } from "../apps/admin/src/lib/pricing-engine";
import type { PricingScope, PricingUnit } from "@nassican/shared";

const roundUp = (value: number, step: number) => Math.ceil(value / step) * step;
const numericKeys = [
  "targetIncome",
  "fixedCosts",
  "billableHours",
  "margin",
  "projectWeight",
  "capacityWeight",
  "marketWeight",
  "rounding",
] as const;

async function main() {
  loadEnvConfig(join(process.cwd(), "apps/admin"));
  const { db, prismaJson } = await import("@nassican/db");
  const apply = process.argv.includes("--apply");
  const existing = await db.pricingService.findMany({ include: { components: true } });
  const currentTiers = await db.pricingTier.findMany({ orderBy: { fromIncome: "asc" } });
  const tiersChanged =
    JSON.stringify(
      currentTiers.map((t) => ({
        fromIncome: Number(t.fromIncome),
        toIncome: t.toIncome === null ? null : Number(t.toIncome),
        percent: Number(t.percent),
        minimum: Number(t.minimum),
        maximum: Number(t.maximum),
      })),
    ) !== JSON.stringify(catalog.incomeTiers);
  const currentSettings = await db.pricingSettings.findUniqueOrThrow({
    where: { id: "singleton" },
  });
  // The page owns this preference; reloading a commercial catalog must not
  // replace the percentage the operator has configured there.
  const familyDiscount = Number(currentSettings.familyDiscount);
  const settings = Object.fromEntries(
    numericKeys.map((key) => [key, Number(currentSettings[key])]),
  ) as typeof catalog.settings;
  const hourlyCost = divideMoney(
    addMoney(settings.targetIncome, settings.fixedCosts),
    settings.billableHours,
  );
  const rows = catalog.services.map((service) => {
    assert.ok(["project", "monthly", "hour"].includes(service.unit));
    assert.ok(
      service.hours > 0 &&
        service.normal > 0 &&
        service.incomePercent >= 0 &&
        service.incomePercent <= 1,
    );
    const minimum = roundUp(scaleMoney(hourlyCost, service.hours), settings.rounding);
    const normal = Math.max(
      service.normal,
      roundUp(scaleMoney(minimum, 1 + settings.margin), 100000),
    );
    const family = addMoney(normal, -scaleMoney(normal, familyDiscount));
    const found =
      existing.find((r) => r.name === service.name) ??
      existing.find((r) => (service.aliases ?? []).some((alias) => alias === r.name));
    const data = {
      name: service.name,
      unit: service.unit as PricingUnit,
      typicalHours: service.hours,
      minimum,
      incomePercent: service.incomePercent,
      active: true,
      description: service.scope,
      recommendedPrice: normal,
    };
    const changed =
      !found ||
      found.name !== data.name ||
      found.unit !== data.unit ||
      Number(found.typicalHours) !== data.typicalHours ||
      Number(found.minimum) !== minimum ||
      Number(found.incomePercent) !== data.incomePercent ||
      found.description !== data.description ||
      Number(found.recommendedPrice) !== data.recommendedPrice ||
      !found.active;
    return { service, found, data, family, changed };
  });
  for (const row of rows) {
    const keys = row.service.components ?? [];
    if (keys.length) {
      const parts = keys.map((key) => rows.find((r) => r.service.key === key));
      assert.ok(parts.every(Boolean));
      row.data.typicalHours = parts.reduce((n, p) => n + p!.data.typicalHours, 0);
      row.data.minimum = addMoney(...parts.map((p) => p!.data.minimum));
      assert.equal(row.data.typicalHours, row.service.hours);
      row.data.recommendedPrice = Math.max(
        row.data.recommendedPrice,
        roundUp(scaleMoney(row.data.minimum, 1 + settings.margin), 100000),
      );
      row.family = addMoney(
        row.data.recommendedPrice,
        -scaleMoney(row.data.recommendedPrice, familyDiscount),
      );
    }
    const expectedNames = keys
      .map((key) => rows.find((r) => r.service.key === key)!.data.name)
      .sort();
    const currentNames = (row.found?.components ?? [])
      .map((c) => existing.find((s) => s.id === c.componentId)?.name)
      .sort();
    row.changed ||=
      JSON.stringify(expectedNames) !== JSON.stringify(currentNames) ||
      (!!row.found && Number(row.found.minimum) !== row.data.minimum);
  }
  assert.equal(new Set(rows.map((r) => r.data.name)).size, rows.length);
  const settingsChanged = numericKeys.some((key) => Number(currentSettings[key]) !== settings[key]);
  const settingsPatch = Object.fromEntries(numericKeys.map((key) => [key, settings[key]]));
  const market = await db.marketQuote.findMany({
    where: { description: { startsWith: "[Catálogo portafolio:" } },
  });
  const marketRows = catalog.marketReferences.map((reference) => {
    const service = rows.find((r) => r.service.key === reference.service);
    assert.ok(service, `Servicio desconocido en ${reference.key}`);
    assert.ok(["basic", "standard", "advanced"].includes(reference.scope));
    const description = `[Catálogo portafolio:${reference.key}] ${reference.description}`;
    const found = market.find((r) =>
      r.description.startsWith(`[Catálogo portafolio:${reference.key}]`),
    );
    const data = {
      scope: reference.scope as PricingScope,
      description,
      price: reference.price,
      unit: "project" as const,
      currency: "COP" as const,
      provider: reference.provider,
      country: "Colombia",
      department: "",
      municipality: "",
      mode: "remote" as const,
      date: catalog.reviewedAt,
      source: "published" as const,
      url: reference.url,
      origin: "estimated" as const,
    };
    const changed =
      !found ||
      Object.entries(data).some(([key, value]) =>
        key === "price" ? Number(found.price) !== value : found[key as keyof typeof data] !== value,
      );
    return { reference, service, found, data, changed };
  });
  console.table(
    rows.map((r) => ({
      servicio: r.data.name,
      unidad: r.data.unit,
      horas: r.data.typicalHours,
      piso: r.data.minimum,
      normal: r.data.recommendedPrice,
      familiar: r.family,
      cambio: r.changed,
    })),
  );
  console.log(
    JSON.stringify({
      mode: apply ? "apply" : "dry",
      hourlyCost,
      hourlyTarget: scaleMoney(hourlyCost, 1 + settings.margin),
      costParameters: settings,
      familyDiscount,
      serviceChanges: rows.filter((r) => r.changed).length,
      settingsChanged,
      tiersChanged,
      marketChanges: marketRows.filter((r) => r.changed).length,
    }),
  );
  if (!apply) {
    await db.$disconnect();
    return;
  }

  const directory = join(tmpdir(), "nassican-pricing-portfolio");
  await mkdir(directory, { recursive: true });
  const snapshotPath = join(directory, `before-${Date.now()}.json`);
  await writeFile(
    snapshotPath,
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        settings: currentSettings,
        services: existing,
        market,
        tiers: currentTiers,
      },
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
      if (settingsChanged) {
        await tx.pricingSettings.update({
          where: { id: "singleton" },
          data: settingsPatch,
        });
        await tx.auditLog.create({
          data: {
            userId: owner.id,
            action: "update",
            entityType: "pricing_settings",
            entityId: "singleton",
            diff: prismaJson.record({
              title: "Base de tarifas del portafolio",
              source: "configure-pricing-portfolio",
              before: Object.fromEntries(
                numericKeys.map((key) => [key, Number(currentSettings[key])]),
              ),
              after: settings,
              familyDiscount,
              assumptions: catalog.assumptions,
            }),
          },
        });
      }
      const ids = new Map<string, string>();
      for (const row of rows) {
        const saved = row.changed
          ? row.found
            ? await tx.pricingService.update({
                where: { id: row.found.id },
                data: row.data,
              })
            : await tx.pricingService.create({ data: row.data })
          : row.found;
        assert.ok(saved);
        ids.set(row.service.key, saved.id);
        if (row.changed)
          await tx.auditLog.create({
            data: {
              userId: owner.id,
              action: row.found ? "update" : "create",
              entityType: "pricing_service",
              entityId: saved.id,
              diff: prismaJson.record({
                title: saved.name,
                source: "configure-pricing-portfolio",
                hoursOrigin: "estimated",
                scope: row.service.scope,
                evidence: row.service.evidence,
                minimum: row.data.minimum,
                recommended: row.data.recommendedPrice,
                family: row.family,
                familyDiscount,
              }),
            },
          });
      }
      for (const row of rows.filter((r) => r.changed)) {
        const packageId = ids.get(row.service.key)!;
        await tx.pricingServiceComponent.deleteMany({ where: { packageId } });
        const keys = row.service.components ?? [];
        if (keys.length)
          await tx.pricingServiceComponent.createMany({
            data: keys.map((key) => ({ packageId, componentId: ids.get(key)! })),
          });
      }
      if (tiersChanged) {
        await tx.pricingTier.deleteMany();
        await tx.pricingTier.createMany({ data: catalog.incomeTiers });
        await tx.auditLog.create({
          data: {
            userId: owner.id,
            action: "update",
            entityType: "pricing_tiers",
            entityId: "tiers",
            diff: prismaJson.record({
              title: "Tramos comerciales mensuales",
              source: "configure-pricing-portfolio",
              count: catalog.incomeTiers.length,
              basis: catalog.tierBasis,
            }),
          },
        });
      }
      for (const row of marketRows.filter((r) => r.changed)) {
        const serviceId = ids.get(row.reference.service);
        assert.ok(serviceId);
        const saved = row.found
          ? await tx.marketQuote.update({
              where: { id: row.found.id },
              data: { ...row.data, serviceId },
            })
          : await tx.marketQuote.create({ data: { ...row.data, serviceId } });
        await tx.auditLog.create({
          data: {
            userId: owner.id,
            action: row.found ? "update" : "create",
            entityType: "market_quote",
            entityId: saved.id,
            diff: prismaJson.record({
              title: saved.description,
              source: "configure-pricing-portfolio",
              url: row.data.url,
              origin: "estimated",
            }),
          },
        });
      }
    },
    { timeout: 30000 },
  );
  const persisted = await db.pricingService.findMany({
    where: { name: { in: rows.map((r) => r.data.name) } },
  });
  assert.equal(persisted.length, rows.length);
  for (const row of rows) {
    const saved = persisted.find((r) => r.name === row.data.name);
    assert.ok(saved);
    assert.equal(Number(saved.minimum), row.data.minimum);
    assert.equal(Number(saved.typicalHours), row.data.typicalHours);
    assert.equal(saved.unit, row.data.unit);
  }
  console.log(
    `Configuración verificada: ${rows.length} servicios y ${marketRows.length} referencias publicadas. Copia previa: ${snapshotPath}`,
  );
  console.log(
    "El porcentaje familiar se configura en Parámetros y se aplica al marcar Tarifa familiar en Calcular. Los costos directos se conservan.",
  );
  await db.$disconnect();
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "No se pudo configurar el catálogo");
  process.exitCode = 1;
});
