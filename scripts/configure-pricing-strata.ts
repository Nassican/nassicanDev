/** Transcribe one verified, historical city/stratum table without projecting it to other regions. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadEnvConfig } from "@next/env";
import study from "./data/pricing-bogota-strata.json";

const prefix = "[SDM-BOG-EM2021-2024]";
async function main() {
  loadEnvConfig(join(process.cwd(), "apps/admin"));
  const { db, prismaJson } = await import("@nassican/db");
  try {
    const place = await db.geoPlace.findUniqueOrThrow({ where: { code: study.municipalityCode } });
    const location = {
      country: "Colombia",
      department: place.department,
      municipality: place.municipality,
    };
    const region = await db.pricingRegion.findFirst({ where: location });
    const existing = region
      ? await db.pricingIncomeEstimate.findMany({ where: { regionId: region.id } })
      : [];
    assert.equal(study.strata.length, 6);
    assert.equal(new Set(study.strata.map((r) => r.stratum)).size, 6);
    const rows = study.strata.map((r) => {
      assert.ok(r.stratum >= 1 && r.stratum <= 6 && r.income > 0);
      const found = existing.find((e) => e.stratum === r.stratum);
      const data = {
        stratum: r.stratum,
        income: r.income,
        date: String(study.referenceYear),
        justification: `${prefix} ${study.metric}. ${study.method} ${study.limitations} ${study.publisher}. ${study.table}; fila ${r.stratum}, página ${r.page}. Fuente: ${study.url}#page=${r.page}`,
      };
      const custom = !!found && !found.justification.startsWith(prefix);
      const changed =
        !custom &&
        (!found ||
          Number(found.income) !== data.income ||
          found.date !== data.date ||
          found.justification !== data.justification);
      return { found, data, custom, changed };
    });
    console.table(
      rows.map((r) => ({
        estrato: r.data.stratum,
        ingreso: r.data.income,
        referencia: r.data.date,
        cambio: r.changed,
        personalizado: r.custom,
      })),
    );
    console.log(
      JSON.stringify({
        apply: process.argv.includes("--apply"),
        changes: rows.filter((r) => r.changed).length,
        preservedCustomRows: rows.filter((r) => r.custom).length,
        missingStrata: [0],
        surveyYear: study.surveyYear,
        referenceYear: study.referenceYear,
      }),
    );
    if (!process.argv.includes("--apply")) return;
    const directory = join(tmpdir(), "nassican-pricing-strata");
    await mkdir(directory, { recursive: true });
    await writeFile(
      join(directory, `before-${Date.now()}.json`),
      JSON.stringify({ region, existing }, null, 2),
    );
    const owner = await db.user.findFirstOrThrow({
      where: { role: "owner", isActive: true },
      select: { id: true },
    });
    await db.$transaction(async (tx) => {
      const savedRegion = region ?? (await tx.pricingRegion.create({ data: location }));
      for (const row of rows.filter((r) => r.changed)) {
        const saved = row.found
          ? await tx.pricingIncomeEstimate.update({ where: { id: row.found.id }, data: row.data })
          : await tx.pricingIncomeEstimate.create({
              data: { ...row.data, regionId: savedRegion.id },
            });
        await tx.auditLog.create({
          data: {
            userId: owner.id,
            action: row.found ? "update" : "create",
            entityType: "pricing_income",
            entityId: saved.id,
            diff: prismaJson.record({
              title: `Bogotá, estrato ${row.data.stratum}`,
              source: "configure-pricing-strata",
              income: row.data.income,
              surveyYear: study.surveyYear,
              referenceYear: study.referenceYear,
              url: study.url,
            }),
          },
        });
      }
    });
    console.log(
      "Seis referencias por estrato verificadas para Bogotá; estrato 0 y otras regiones sin extrapolación. Preferencias y cotizaciones previas conservadas.",
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "No se pudo cargar el estudio por estrato",
  );
  process.exitCode = 1;
});
