/** Synthetic fixtures; hard guard prevents writing to any remote database. */
import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";
import { join } from "node:path";

async function main() {
  loadEnvConfig(join(process.cwd(), "apps/admin"));
  const target = new URL(process.env.DATABASE_URL!);
  assert.equal(target.hostname, "127.0.0.1");
  assert.equal(target.port, "55432");
  assert.equal(target.username, "pricing_qa");
  const { db } = await import("@nassican/db");
  const { defaultPricingParameters } = await import("../apps/admin/src/lib/pricing-engine");
  try {
    await db.user.upsert({
      where: { email: "pricing-qa@example.invalid" },
      create: {
        email: "pricing-qa@example.invalid",
        name: "Local pricing QA",
        emailVerified: true,
        isActive: true,
      },
      update: {},
    });
    await db.pricingSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...defaultPricingParameters },
      update: {},
    });
    for (const [code, departmentCode, department, municipality, income] of [
      ["52001", "52", "Nariño", "Pasto", 1370170],
      ["05001", "05", "Antioquia", "Medellín", 1929483],
      ["11001", "11", "Bogotá D.C.", "Bogotá D.C.", 2297080],
    ] as const) {
      await db.geoPlace.upsert({
        where: { code },
        create: { code, departmentCode, department, municipality },
        update: {},
      });
      const region = await db.pricingRegion.upsert({
        where: {
          country_department_municipality: { country: "Colombia", department, municipality },
        },
        create: { country: "Colombia", department, municipality },
        update: {},
      });
      await db.pricingIncomeEstimate.upsert({
        where: { id: `local-income-${code}` },
        create: {
          id: `local-income-${code}`,
          regionId: region.id,
          stratum: null,
          income,
          justification:
            "Synthetic local QA: verifies calculation against a known regional base, not research data.",
          date: "2025",
        },
        update: {},
      });
    }
    console.log(
      "Synthetic user, settings and three municipal bases prepared in loopback-only QA database.",
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
