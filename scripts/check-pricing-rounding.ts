/** Apply only reviewed commercial migrations, backing up settings and checking quote immutability. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(join(process.cwd(), "apps/admin"));
  const { dbBase: db } = await import("@nassican/db");
  const digest = async () =>
    createHash("sha256")
      .update(
        JSON.stringify(
          await db.pricingQuote.findMany({
            orderBy: { id: "asc" },
            select: { id: true, snapshot: true, final: true, status: true },
          }),
        ),
      )
      .digest("hex");
  try {
    if (process.argv.includes("--legacy-readonly")) {
      // Assert an existing singleton first: getPricingParameters cannot create one.
      const existing = await db.$queryRawUnsafe<{ id: string }[]>(
        "SELECT id FROM \"pricing_settings\" WHERE id = 'singleton'",
      );
      assert.equal(existing.length, 1);
      const { getPricingParameters, pricingRoundingSchemaReady } =
        await import("../apps/admin/src/lib/pricing");
      const parameters = await getPricingParameters();
      assert.ok(Number.isFinite(parameters.rounding) && parameters.rounding > 0);
      assert.ok(Number.isFinite(parameters.familyRounding) && parameters.familyRounding! > 0);
      console.log(
        (await pricingRoundingSchemaReady())
          ? "Configured schema verified read-only; commercial rounding column is available."
          : "Configured legacy schema verified read-only; calculator uses requested rounding without applying a migration.",
      );
      return;
    }
    const before = await digest();
    if (process.argv.includes("--simulate-legacy-local")) {
      const target = new URL(process.env.DATABASE_URL!);
      assert.equal(target.hostname, "127.0.0.1");
      assert.equal(target.port, "55432");
      assert.equal(target.username, "pricing_qa");
      await db.$executeRawUnsafe('ALTER TABLE "pricing_settings" DROP COLUMN "family_rounding"');
      await db.$executeRawUnsafe('UPDATE "pricing_settings" SET "rounding" = 1000');
      await db.$executeRawUnsafe(
        "DELETE FROM \"_prisma_migrations\" WHERE migration_name = '20261028010000_pricing_commercial_rounding'",
      );
      assert.equal(await digest(), before);
      console.log(
        "Synthetic local schema reset to its pre-migration state; existing quote snapshots and amounts are unchanged.",
      );
      return;
    }
    const settings = await db.$queryRawUnsafe<Record<string, unknown>[]>(
      'SELECT * FROM "pricing_settings" ORDER BY id',
    );
    if (process.argv.includes("--migrate")) {
      const applied = await db.$queryRawUnsafe<{ migration_name: string }[]>(
        'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL',
      );
      const known = new Set(applied.map((row) => row.migration_name));
      const pending = (await readdir("packages/db/prisma/migrations", { withFileTypes: true }))
        .filter((entry) => entry.isDirectory() && !known.has(entry.name))
        .map((entry) => entry.name);
      if (process.argv.includes("--with-billing")) {
        const reviewed = new Set([
          "20261028010000_pricing_commercial_rounding",
          "20261028020000_billing_plans",
        ]);
        assert.ok(
          pending.length > 0 && pending.every((name) => reviewed.has(name)),
          "Only the reviewed rounding and billing migrations may be pending.",
        );
      } else {
        assert.deepEqual(
          pending,
          ["20261028010000_pricing_commercial_rounding"],
          "Only the reviewed commercial-rounding migration may be pending.",
        );
      }
      const directory = join(tmpdir(), "nassican-pricing-qa");
      await mkdir(directory, { recursive: true });
      await writeFile(
        join(directory, `rounding-settings-before-${Date.now()}.json`),
        JSON.stringify({ settings, quotesHash: before }, null, 2),
      );
      const result = spawnSync(
        process.execPath,
        [
          "node_modules/prisma/build/index.js",
          "migrate",
          "deploy",
          "--schema",
          "packages/db/prisma/schema.prisma",
        ],
        { encoding: "utf8", env: process.env },
      );
      await writeFile(
        join(directory, "rounding-migration.log"),
        `${result.stdout}\n${result.stderr}`,
      );
      assert.equal(
        result.status,
        0,
        "Migration failed; inspect the private temporary migration log.",
      );
      // Clear prepared SELECT * result types after the column is added.
      await db.$disconnect();
      const after = await db.$queryRawUnsafe<Record<string, unknown>[]>(
        'SELECT * FROM "pricing_settings" ORDER BY id',
      );
      for (const row of settings) {
        const current = after.find((item) => item.id === row.id)!;
        for (const key of Object.keys(row).filter((key) => key !== "rounding"))
          assert.equal(
            String(current[key]),
            String(row[key]),
            `Existing setting ${key} changed unexpectedly.`,
          );
      }
    }
    assert.equal(await digest(), before, "Saved quotes must remain unchanged.");
    const current = await db.pricingSettings.findUniqueOrThrow({ where: { id: "singleton" } });
    assert.ok(Number(current.rounding) > 0 && Number(current.familyRounding) > 0);
    console.log(
      "Commercial rounding verified; saved quote snapshots and final amounts are unchanged.",
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
