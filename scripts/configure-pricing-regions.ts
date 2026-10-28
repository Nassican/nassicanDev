/** Published regional income baselines with an explicitly estimated price proxy. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import study from "./data/pricing-dane-2025.json";
import { studiedRegionalFactor } from "../apps/admin/src/lib/pricing-study";

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const cityDepartments: Record<string, string> = {
  Armenia: "Quindío",
  Barranquilla: "Atlántico",
  Bogotá: "Bogotá D.C.",
  Bucaramanga: "Santander",
  Cali: "Valle del Cauca",
  Cartagena: "Bolívar",
  Cúcuta: "Norte de Santander",
  Florencia: "Caquetá",
  Ibagué: "Tolima",
  Manizales: "Caldas",
  Medellín: "Antioquia",
  Montería: "Córdoba",
  Neiva: "Huila",
  Pasto: "Nariño",
  Pereira: "Risaralda",
  Popayán: "Cauca",
  Quibdó: "Chocó",
  Riohacha: "La Guajira",
  "Santa Marta": "Magdalena",
  Sincelejo: "Sucre",
  Tunja: "Boyacá",
  Valledupar: "Cesar",
  Villavicencio: "Meta",
};
const prefix = "[DANE-PM-2025]";
async function main() {
  loadEnvConfig(join(process.cwd(), "apps/admin"));
  const { db, prismaJson } = await import("@nassican/db");
  const [places, regions, factors, incomes] = await Promise.all([
    db.geoPlace.findMany(),
    db.pricingRegion.findMany(),
    db.pricingRegionFactor.findMany(),
    db.pricingIncomeEstimate.findMany(),
  ]);
  const departments = [...new Set(places.map((p) => p.department))];
  const department = (name: string) => {
    const result = departments.find((d) => fold(d) === fold(name));
    assert.ok(result, `Departamento DIVIPOLA desconocido: ${name}`);
    return result;
  };
  const municipality = (name: string, dep: string) => {
    const candidates = places.filter((p) => p.department === dep);
    const aliases: Record<string, string> = {
      Cali: "Santiago de Cali",
      Cartagena: "Cartagena de Indias",
      Bogotá: "Bogotá D.C.",
      Cúcuta: "San José de Cúcuta",
    };
    const result = candidates.find(
      (p) =>
        fold(p.municipality) === fold(name) || fold(p.municipality) === fold(aliases[name] ?? name),
    );
    assert.ok(result, `Municipio DIVIPOLA desconocido: ${name}`);
    return result.municipality;
  };
  const rows = [
    {
      country: "Colombia",
      department: "",
      municipality: "",
      income: study.nationalIncome,
      source: study.sources[0],
      cell: "F36",
    },
    ...study.departments.map((d) => ({
      country: "Colombia",
      department: department(d.name),
      municipality: "",
      income: d.income,
      source: study.sources[0],
      cell: d.cell,
    })),
    ...study.cities.map((c) => {
      const dep = department(cityDepartments[c.name]);
      return {
        country: "Colombia",
        department: dep,
        municipality: municipality(c.name, dep),
        income: c.income,
        source: study.sources[1],
        cell: c.cell,
      };
    }),
  ];
  const key = (r: { country: string; department: string; municipality: string }) =>
    [r.country, r.department, r.municipality].join("|");
  assert.equal(new Set(rows.map(key)).size, 48);
  console.table(
    rows.map((r) => ({
      región: r.municipality || r.department || "Colombia",
      ingresoPerCápita: r.income,
      factorEstimado: studiedRegionalFactor(r.income, study.nationalIncome),
    })),
  );
  if (!process.argv.includes("--apply")) {
    console.log(
      "48 regiones: 24 departamentos, 23 capitales y referencia nacional. Tres modalidades y todos los servicios por herencia; los demás municipios heredan departamento o país.",
    );
    await db.$disconnect();
    return;
  }
  const directory = join(tmpdir(), "nassican-pricing-study");
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, `before-${Date.now()}.json`),
    JSON.stringify({ regions, factors, incomes }, null, 2),
  );
  await db.pricingRegion.createMany({
    data: rows
      .filter((r) => !regions.some((p) => key(r) === key(p)))
      .map((r) => ({
        id: randomUUID(),
        country: r.country,
        department: r.department,
        municipality: r.municipality,
      })),
    skipDuplicates: true,
  });
  const ids = new Map((await db.pricingRegion.findMany()).map((r) => [key(r), r.id]));
  const factorCreates: Parameters<typeof db.pricingRegionFactor.createMany>[0]["data"] = [];
  const incomeCreates: Parameters<typeof db.pricingIncomeEstimate.createMany>[0]["data"] = [];
  let preserved = 0;
  for (const row of rows) {
    const regionId = ids.get(key(row));
    assert.ok(regionId);
    const justification = `${prefix} ${study.metric}, año 2025: ${row.income} COP; hoja ${row.source.sheet}, celda ${row.cell}; publicado ${row.source.published}. ${row.source.url}`;
    for (const mode of ["remote", "onsite", "hybrid"] as const) {
      const existing = factors.find(
        (f) => f.regionId === regionId && f.serviceId === null && f.mode === mode,
      );
      const data = {
        regionId,
        serviceId: null,
        mode,
        factor: studiedRegionalFactor(row.income, study.nationalIncome),
        origin: "manual" as const,
        date: "2025",
        justification: `${justification} Proxy comercial estimado: limitar entre 0,8 y 1,2 la raíz de (ingreso regional / ${study.nationalIncome}). Suavizado y límites son política ajustable, no una tarifa DANE. Mismo proxy para todos los servicios y modalidades; los viáticos se suman aparte.`,
      };
      if (!existing) factorCreates.push(data);
      else if (existing.justification.startsWith(prefix)) {
        if (
          existing.justification !== data.justification ||
          Number(existing.factor) !== data.factor
        )
          await db.pricingRegionFactor.update({ where: { id: existing.id }, data });
      } else preserved++;
    }
    const existing = incomes.find((i) => i.regionId === regionId && i.stratum === null);
    const data = {
      regionId,
      stratum: null,
      income: row.income,
      date: "2025",
      justification: `${justification} Aproximación al presupuesto individual disponible, no salario personal ni ingreso garantizado. El anexo no desagrega por estrato; la referencia general solo se usa si el estrato es desconocido. No sustituye datos por estrato. Cualquier ingreso conocido tiene prioridad.`,
    };
    if (!existing) incomeCreates.push(data);
    else if (existing.justification.startsWith(prefix)) {
      if (existing.justification !== data.justification || Number(existing.income) !== data.income)
        await db.pricingIncomeEstimate.update({ where: { id: existing.id }, data });
    } else preserved++;
  }
  await db.$transaction([
    db.pricingRegionFactor.createMany({ data: factorCreates }),
    db.pricingIncomeEstimate.createMany({ data: incomeCreates, skipDuplicates: true }),
  ]);
  const owner = await db.user.findFirstOrThrow({
    where: { role: "owner", isActive: true },
    select: { id: true },
  });
  if (factorCreates.length || incomeCreates.length)
    await db.auditLog.create({
      data: {
        userId: owner.id,
        action: "create",
        entityType: "pricing_factor",
        entityId: "DANE-PM-2025",
        diff: prismaJson.record({
          title: "Base regional DANE 2025",
          factors: factorCreates.length,
          incomes: incomeCreates.length,
          source: study.sources.map((s) => s.url),
          origin: "estimated",
        }),
      },
    });
  console.log(
    JSON.stringify({
      createdFactors: factorCreates.length,
      createdIncomeBaselines: incomeCreates.length,
      preservedCustomRows: preserved,
      coveredRegions: rows.length,
      allServices: true,
      modes: 3,
      inheritedMunicipalities: places.length,
    }),
  );
  await db.$disconnect();
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "No se pudo cargar el estudio regional.");
  process.exitCode = 1;
});
