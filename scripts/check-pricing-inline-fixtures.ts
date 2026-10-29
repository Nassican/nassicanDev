/** Long lists for inline-editing QA. Removed by check-pricing.ts --cleanup. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(join(process.cwd(), "apps/admin"));
  const url = new URL(process.env.DATABASE_URL!);
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "55432");
  assert.equal(url.username, "pricing_qa");
  const fixture = JSON.parse(
    await readFile(join(tmpdir(), "nassican-pricing-qa", "fixtures.json"), "utf8"),
  );
  assert.ok(fixture.marker.startsWith("__pricing_qa_"));
  const { dbBase: db } = await import("@nassican/db");
  try {
    assert.equal(
      (await db.pricingService.findUniqueOrThrow({ where: { id: fixture.serviceId } })).name,
      fixture.marker,
    );
    const sample = await db.marketQuote.findFirstOrThrow({
      where: { serviceId: fixture.serviceId },
    });
    const { id: _id, createdAt: _created, ...market } = sample;
    for (let i = 0; i < 25; i++) {
      const region = await db.pricingRegion.create({
        data: { country: fixture.marker, department: `Inline ${String(i).padStart(2, "0")}` },
      });
      await db.pricingRegionFactor.create({
        data: {
          regionId: region.id,
          serviceId: fixture.serviceId,
          mode: "remote",
          factor: "1.1",
          origin: "manual",
          justification: fixture.marker,
          date: "2026-10-29",
        },
      });
      await db.pricingIncomeEstimate.create({
        data: {
          regionId: region.id,
          stratum: 2,
          income: "1000000",
          justification: fixture.marker,
          date: "2026-10-29",
        },
      });
      await db.marketQuote.create({
        data: { ...market, description: `${fixture.marker} Inline ${i}` },
      });
    }
    console.log("Long synthetic market, factor and income lists ready on loopback only.");
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error("Inline fixtures failed; no credentials printed.");
  process.exitCode = 1;
});
