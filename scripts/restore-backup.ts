/**
 * Restores a backup downloaded from «Copias de seguridad» into an empty database.
 *
 *   RESTORE_DATABASE_URL=postgres://… npm run backup:restore -- copia.json.gz --dry
 *   RESTORE_DATABASE_URL=postgres://… npm run backup:restore -- copia.json.gz
 *
 * Before running it, the target needs the schema: `prisma migrate deploy`
 * against the same URL. The script refuses a database at a different migration
 * than the backup, because rows written for one shape of a table do not fit
 * another, and finding that out halfway through is worse than not starting.
 *
 * **The target URL is its own variable on purpose.** Reading `DATABASE_URL`
 * would make the production database the default destination of a restore. It
 * also refuses any database that is not empty, so a wrong URL can fail but
 * cannot overwrite.
 *
 * It talks plain Postgres over TCP rather than through the Neon adapter, so the
 * same command restores into Neon, a VPS or a laptop.
 */
import fs from "node:fs";
import {
  PrismaClient,
  countRows,
  insertRows,
  latestMigration,
  modelNames,
  parseBackup,
  resetSerials,
  schemaOf,
  tableOrder,
  type BackupFile,
  type ModelName,
} from "@nassican/db";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const path = args.find((a) => !a.startsWith("--"));
const url = process.env.RESTORE_DATABASE_URL;

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

if (!path) fail("Falta el archivo: npm run backup:restore -- copia.json.gz");
if (!url) fail("Falta RESTORE_DATABASE_URL, la base de destino. No se usa DATABASE_URL a propósito.");

let file: BackupFile;
try {
  file = parseBackup(fs.readFileSync(path));
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

const client = new PrismaClient({ datasourceUrl: url });
const schema = schemaOf(url);

async function main() {
  const target = await latestMigration(client, schema).catch(() => null);
  if (target !== file.migration) {
    fail(
      `La copia es de la migración ${file.migration ?? "(ninguna)"} y el destino está en ${target ?? "(sin migrar)"}.\n` +
        "  Migra una base vacía hasta esa misma migración —`prisma migrate deploy` desde el commit que la trae— y restaura ahí.",
    );
  }

  const counts = await Promise.all(modelNames.map((m) => countRows(client, m)));
  const occupied = modelNames.filter((_, i) => counts[i] > 0);
  if (occupied.length > 0) {
    fail(
      `El destino no está vacío (${occupied.slice(0, 6).join(", ")}${occupied.length > 6 ? "…" : ""}).\n` +
        "  Restaurar solo escribe en una base vacía: nunca mezcla ni sobrescribe.",
    );
  }

  const order = tableOrder(Object.keys(file.tables) as ModelName[]);
  const total = order.reduce((n, m) => n + (file.tables[m]?.length ?? 0), 0);

  console.log(`\nCopia del ${file.createdAt} · migración ${file.migration}`);
  console.log(`${order.length} tablas, ${total} filas. Fuera de la copia: ${file.excluded.join(", ")}.`);
  for (const [model, fields] of Object.entries(file.redacted)) {
    console.log(`En blanco en ${model}: ${fields?.join(", ")}.`);
  }

  if (dry) {
    console.log("\n--dry: no se escribe nada. Orden de inserción:");
    for (const model of order) console.log(`  ${model.padEnd(28)} ${file.tables[model]?.length ?? 0}`);
    process.exit(0);
  }

  const started = Date.now();
  // One transaction: a restore that dies at table forty leaves an empty
  // database, not a half-full one that looks like it worked.
  await client.$transaction(
    async (tx) => {
      for (const model of order) {
        await insertRows(tx, model, file.tables[model] ?? []);
        await resetSerials(tx, model, schema);
      }
    },
    { timeout: 10 * 60_000, maxWait: 60_000 },
  );

  // Counted again from the database rather than trusted from the writes.
  const after = await Promise.all(order.map((m) => countRows(client, m)));
  const wrong = order.filter((m, i) => after[i] !== (file.tables[m]?.length ?? 0));

  if (wrong.length > 0) {
    fail(`Las cuentas no cuadran en: ${wrong.join(", ")}.`);
  }

  console.log(`\n✓ ${total} filas en ${order.length} tablas, ${((Date.now() - started) / 1000).toFixed(1)} s. Las cuentas cuadran tabla por tabla.`);
  console.log("  Entra con Google: la cuenta se vuelve a vincular y emite tokens nuevos.\n");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.$disconnect());
