/** Persistence checks are restricted to synthetic data on the temporary local PostgreSQL instance. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(join(process.cwd(), "apps/admin"));
  const target = new URL(process.env.DATABASE_URL!);
  assert.equal(target.hostname, "127.0.0.1");
  assert.equal(target.port, "55432");
  assert.equal(target.username, "pricing_qa");
  const { db } = await import("@nassican/db");
  const { getPricingCalculator, pricingSnapshot } = await import("../apps/admin/src/lib/pricing");
  const { emptyPricingQuote, quoteInput } = await import("../apps/admin/src/lib/pricing-draft");
  const { livePricingInput } = await import("../apps/admin/src/lib/pricing-live");
  const { calculatePricing } = await import("../apps/admin/src/lib/pricing-engine");
  const ids = JSON.parse(
    await readFile(join(tmpdir(), "nassican-pricing-qa", "fixtures.json"), "utf8"),
  );
  assert.equal(
    (await db.pricingService.findUniqueOrThrow({ where: { id: ids.serviceId } })).name,
    ids.marker,
  );
  const row = await db.pricingClient.create({
    data: {
      name: "__pricing_qa_auto_income",
      type: "person",
      country: "Colombia",
      department: "Nariño",
      municipality: "Pasto",
      stratum: 1,
      incomeOrigin: "missing",
    },
  });
  try {
    const financial = await db.pricingClientFinancial.findFirstOrThrow({
      where: { clientId: ids.clientId },
    });
    assert.equal(Number(financial.equity), 7000000);
    assert.equal(Number(financial.assets), 10000000);
    assert.equal(Number(financial.liabilities), 3000000);
    for (const [department, municipality, stratum, income] of [
      ["Nariño", "Pasto", 1, 690000],
      ["Nariño", "Pasto", 6, 4110000],
      ["Antioquia", "Medellín", 6, 5790000],
    ] as const) {
      await db.pricingClient.update({
        where: { id: row.id },
        data: { department, municipality, stratum },
      });
      const view = await getPricingCalculator();
      const client = view.clients.find((c) => c.id === row.id)!;
      const service = view.services.find((s) => s.id === ids.serviceId)!;
      const draft = {
        ...emptyPricingQuote(),
        clientId: row.id,
        serviceId: service.id,
        hours: "20",
        directCosts: "0",
      };
      const live = livePricingInput(
        quoteInput(draft, service, client),
        client,
        null,
        view.parameters,
        view.tiers,
        view.geography,
        service.id,
      );
      const snapshot = await pricingSnapshot(draft);
      assert.equal(snapshot.inputs.monthlyIncome, income);
      assert.equal(live.input.monthlyIncome, snapshot.inputs.monthlyIncome);
      assert.equal(
        calculatePricing(live.input, view.parameters).capacity,
        snapshot.result.capacity,
      );
      assert.equal(
        calculatePricing(live.input, view.parameters).suggested,
        snapshot.result.suggested,
      );
    }
    console.log(
      "Database passed: browser-saved equity, live/server parity for Pasto and Medellín strata, unchanged quote calculation rules.",
    );
  } finally {
    await db.pricingClient.delete({ where: { id: row.id } });
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
