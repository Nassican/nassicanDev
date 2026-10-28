/** Disposable persistence checks for ad hoc multi-service quotes. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(join(process.cwd(), "apps/admin"));
  const { db } = await import("@nassican/db");
  const { emptyPricingClient, emptyPricingService, emptyPricingQuote } =
    await import("../apps/admin/src/lib/pricing-draft");
  const {
    savePricingClient,
    savePricingService,
    savePricingQuote,
    pricingSnapshot,
    getMarketQuotes,
    setPricingQuoteStatus,
  } = await import("../apps/admin/src/lib/pricing");
  const marker = `__pricing_multi_${randomUUID()}`;
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
      typicalHours: "6",
      minimum: "200.000",
      recommendedPrice: "900.000",
    });
    const c = await savePricingService({
      ...emptyPricingService(),
      name: `${marker} C`,
      typicalHours: "4",
      minimum: "150.000",
      recommendedPrice: "600.000",
    });
    const monthly = await savePricingService({
      ...emptyPricingService(),
      name: `${marker} mensual`,
      unit: "monthly",
      typicalHours: "2",
    });
    const pkg = await savePricingService({
      ...emptyPricingService(),
      name: `${marker} paquete`,
      componentIds: [a.id, b.id],
    });
    const client = await savePricingClient({
      ...emptyPricingClient(),
      name: marker,
      monthlyIncome: "5.000.000",
      incomeOrigin: "declared",
    });
    clientId = client.id;
    const draft = {
      ...emptyPricingQuote(),
      clientId,
      serviceId: pkg.id,
      additionalServiceIds: [c.id],
      title: marker,
      hours: "20",
      directCosts: "34.225",
      family: true,
    };
    const count = await db.pricingService.count({ where: { name: { startsWith: marker } } });
    const quote = await savePricingQuote(draft);
    const frozen = quote.snapshot;
    assert.equal(frozen.inputs.minimum, 450000);
    assert.equal(frozen.inputs.hours, 20);
    assert.equal(frozen.inputs.directCosts, 34225);
    assert.equal(frozen.inputs.market, null);
    assert.equal(frozen.service.selectedServices?.length, 2);
    assert.equal(frozen.service.components?.length, 3);
    assert.equal(frozen.result.family?.unrestricted, true);
    assert.ok(frozen.notes.some((n) => n.includes("referencia conjunta")));
    assert.equal(await db.pricingService.count({ where: { name: { startsWith: marker } } }), count);
    await assert.rejects(
      pricingSnapshot({ ...draft, additionalServiceIds: [a.id] }),
      /ya está incluido/,
    );
    await assert.rejects(
      pricingSnapshot({ ...draft, additionalServiceIds: [monthly.id] }),
      /misma unidad/,
    );
    await assert.rejects(pricingSnapshot({ ...draft, unit: "monthly" }), /unidad de cobro común/);
    await db.pricingService.update({ where: { id: c.id }, data: { active: false } });
    await assert.rejects(pricingSnapshot(draft), /no está disponible/);
    await db.pricingService.update({
      where: { id: c.id },
      data: { active: true, typicalHours: 15 },
    });
    assert.equal(
      (await pricingSnapshot(draft)).service.components?.find((s) => s.id === c.id)?.hours,
      15,
    );
    const stored = await db.pricingQuote.findUniqueOrThrow({ where: { id: quote.id } });
    assert.equal(stored.snapshot.service.components?.find((s) => s.id === c.id)?.hours, 4);
    assert.deepEqual(stored.snapshot, frozen);
    const accepted = await setPricingQuoteStatus(quote.id, "accepted");
    assert.equal(accepted.ok, true);
    assert.equal(await db.clientProject.count({ where: { clientId } }), 1);
    const project = await db.clientProject.findFirstOrThrow({ where: { clientId } });
    assert.equal(Number(project.amount), Number(quote.final));
    assert.ok(project.description?.includes(`${marker} C`));
    assert.equal(
      (await getMarketQuotes()).some((q) => q.id === `own:${quote.id}`),
      false,
    );
    const single = await savePricingQuote({
      ...emptyPricingQuote(),
      clientId,
      serviceId: a.id,
      title: `${marker} individual`,
      hours: "10",
    });
    await setPricingQuoteStatus(single.id, "accepted");
    assert.equal(
      (await getMarketQuotes()).some((q) => q.id === `own:${single.id}`),
      true,
    );
    console.log(
      "Multi-service database checks passed: package + service totals, overlap and unit guards, complete family discount, no catalog side effects, immutable selections, one accepted project and separate market comparability.",
    );
  } finally {
    if (clientId) {
      await db.pricingQuote.deleteMany({ where: { clientId } });
      await db.clientProject.deleteMany({ where: { clientId } });
      await db.pricingClient.deleteMany({ where: { id: clientId } });
    }
    const services = await db.pricingService.findMany({
      where: { name: { startsWith: marker } },
      select: { id: true },
    });
    const ids = services.map((s) => s.id);
    await db.pricingServiceComponent.deleteMany({ where: { packageId: { in: ids } } });
    await db.pricingService.deleteMany({ where: { id: { in: ids } } });
    assert.equal(await db.pricingService.count({ where: { name: { startsWith: marker } } }), 0);
    await db.$disconnect();
  }
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Multi-service database checks failed");
  process.exitCode = 1;
});
