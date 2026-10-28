import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import strataStudy from "./data/pricing-bogota-strata.json";

async function main() {
  loadEnvConfig(join(process.cwd(), "apps/admin"));
  const { db } = await import("@nassican/db");
  const { emptyPricingService, emptyPricingClient, emptyPricingQuote } =
    await import("../apps/admin/src/lib/pricing-draft");
  const {
    savePricingService,
    getPricingServices,
    savePricingClient,
    savePricingQuote,
    pricingSnapshot,
    getPricingGeography,
  } = await import("../apps/admin/src/lib/pricing");
  const { resolveRegionalIncome, incomeCityOptions } =
    await import("../apps/admin/src/lib/pricing-geography");
  const geography = await getPricingGeography();
  assert.equal(
    incomeCityOptions(geography.places, geography.incomes).length,
    geography.places.length,
  );
  for (const place of geography.places) {
    for (let stratum = 0; stratum <= 6; stratum++) {
      const estimate = resolveRegionalIncome(
        geography.incomes,
        { country: "Colombia", ...place },
        stratum,
      );
      assert.ok(estimate && estimate.income > 0, `Missing ${place.code}, stratum ${stratum}`);
    }
  }
  console.log(
    `Nationwide coverage: ${geography.places.length} DIVIPOLA places × 7 strata, every reference positive and sourced.`,
  );
  const marker = `__pricing_study_${randomUUID()}`;
  let clientId: string | undefined;
  try {
    const a = await savePricingService({
      ...emptyPricingService(),
      name: `${marker} A`,
      typicalHours: "10",
      minimum: "100.000",
      recommendedPrice: "1.000.000",
    });
    const b = await savePricingService({
      ...emptyPricingService(),
      name: `${marker} B`,
      typicalHours: "16",
      minimum: "200.000",
      recommendedPrice: "2.000.000",
    });
    const pkg = await savePricingService({
      ...emptyPricingService(),
      name: `${marker} paquete`,
      componentIds: [a.id, b.id],
    });
    const view = (await getPricingServices()).find((s) => s.id === pkg.id)!;
    assert.equal(view.typicalHours, 26);
    assert.equal(view.minimum, 300000);
    assert.equal(view.recommendedPrice, 3000000);
    assert.equal(view.components.length, 2);
    await assert.rejects(
      savePricingService({
        ...emptyPricingService(),
        name: `${marker} anidado`,
        componentIds: [pkg.id, b.id],
      }),
    );
    await assert.rejects(
      savePricingService({ ...emptyPricingService(), id: a.id, name: a.name, active: false }),
    );
    const client = await savePricingClient({
      ...emptyPricingClient(),
      name: marker,
      country: "Colombia",
      department: "NARIÑO",
      municipality: "PASTO",
    });
    clientId = client.id;
    const draft = {
      ...emptyPricingQuote(),
      title: marker,
      clientId,
      serviceId: pkg.id,
      hours: "26",
      directCosts: "34.225",
    };
    const quote = await savePricingQuote(draft);
    assert.equal(quote.snapshot.inputs.monthlyIncome, 1370170);
    assert.equal(quote.snapshot.inputs.incomeOrigin, "estimated");
    assert.equal(quote.snapshot.geography.level, "municipio");
    assert.equal(quote.snapshot.service.components?.length, 2);
    assert.equal(quote.snapshot.result.floor, quote.snapshot.result.hourlyCost * 26 + 34225);
    await savePricingService({
      ...emptyPricingService(),
      id: b.id,
      name: b.name,
      typicalHours: "30",
      minimum: "200.000",
      recommendedPrice: "2.000.000",
    });
    assert.equal((await getPricingServices()).find((s) => s.id === pkg.id)?.typicalHours, 40);
    assert.equal(
      (
        await db.pricingQuote.findUniqueOrThrow({ where: { id: quote.id } })
      ).snapshot.service.components?.find((s) => s.id === b.id)?.hours,
      16,
    );
    await db.pricingClient.update({ where: { id: clientId }, data: { stratum: 2 } });
    const pastoScenario = await pricingSnapshot(draft);
    assert.equal(pastoScenario.inputs.monthlyIncome, 1030000);
    assert.ok(
      pastoScenario.result.explanation.some((line) => line.includes("MODELO-COMERCIAL-V1")),
    );
    const bogota = await db.geoPlace.findUniqueOrThrow({ where: { code: "11001" } });
    for (const row of strataStudy.strata) {
      await db.pricingClient.update({
        where: { id: clientId },
        data: {
          department: bogota.department,
          municipality: bogota.municipality,
          stratum: row.stratum,
        },
      });
      const snapshot = await pricingSnapshot(draft);
      assert.equal(snapshot.inputs.monthlyIncome, row.income);
      assert.equal(snapshot.inputs.incomeOrigin, "estimated");
      assert.ok(
        snapshot.result.explanation.some((line) => line.includes("2024") && line.includes("SDM")),
      );
    }
    await db.pricingClient.update({ where: { id: clientId }, data: { stratum: 0 } });
    assert.equal((await pricingSnapshot(draft)).inputs.monthlyIncome, 2300000);
    await db.pricingClient.update({
      where: { id: clientId },
      data: { monthlyIncome: 10000000, incomeOrigin: "declared" },
    });
    assert.equal((await pricingSnapshot(draft)).inputs.monthlyIncome, 10000000);
    console.log(
      "Database passed: all municipalities and strata covered, explicit Pasto model, neutral stratum 0 scenario, six Bogotá references preserved, known-income priority, package totals and immutable snapshots.",
    );
  } finally {
    if (clientId) await db.pricingQuote.deleteMany({ where: { clientId } });
    const services = await db.pricingService.findMany({
      where: { name: { startsWith: marker } },
      select: { id: true },
    });
    await db.pricingServiceComponent.deleteMany({
      where: { packageId: { in: services.map((s) => s.id) } },
    });
    await db.pricingService.deleteMany({ where: { id: { in: services.map((s) => s.id) } } });
    if (clientId) await db.pricingClient.delete({ where: { id: clientId } });
    await db.$disconnect();
  }
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Study verification failed");
  process.exitCode = 1;
});
