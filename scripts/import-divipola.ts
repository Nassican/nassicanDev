/** DANE's official open dataset, keyed by DIVIPOLA. --dry never writes. */
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import { DIVIPOLA_SOURCE, readDivipola } from "../apps/admin/src/lib/divipola";

async function main() {
  loadEnvConfig(join(process.cwd(), "packages/db"));
  const { db, dbBase } = await import("@nassican/db");
  try {
    const response = await fetch(DIVIPOLA_SOURCE, {
      signal: AbortSignal.timeout(30000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`DIVIPOLA respondió ${response.status}.`);
    const rows = readDivipola(await response.json());
    const existing = await db.geoPlace.findMany();
    const byCode = new Map(existing.map((r) => [r.code, r]));
    const added = rows.filter((r) => !byCode.has(r.code));
    const changed = rows.filter((r) => {
      const old = byCode.get(r.code);
      return (
        old &&
        (old.department !== r.department ||
          old.municipality !== r.municipality ||
          old.departmentCode !== r.departmentCode)
      );
    });
    console.log(
      `DIVIPOLA (DANE): ${rows.length} lugares, ${added.length} nuevos, ${changed.length} actualizados, ${rows.length - added.length - changed.length} sin cambios.`,
    );
    if (process.argv.includes("--dry")) {
      console.log("Modo --dry: no se escribió nada.");
      return;
    }
    await db.$transaction(
      async (tx) => {
        if (added.length) await tx.geoPlace.createMany({ data: added, skipDuplicates: true });
        for (const row of changed)
          await tx.geoPlace.update({ where: { code: row.code }, data: row });
      },
      { timeout: 60000 },
    );
    console.log("Importación terminada. Repetirla conserva las mismas claves.");
  } finally {
    await dbBase.$disconnect();
  }
}
main().catch((error: unknown) => {
  console.error(
    error instanceof Error && !/postgres|password|secret|token|url/i.test(error.message)
      ? error.message
      : "No se pudo importar DIVIPOLA. Revisa la conexión.",
  );
  process.exitCode = 1;
});
