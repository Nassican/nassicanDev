import "server-only";

import {
  BACKUP_FORMAT,
  dbBase,
  encodeRows,
  latestMigration,
  modelNames,
  readRows,
  tableOrder,
  type BackupFile,
  type ModelName,
  type PrismaClient,
} from "@nassican/db";

/**
 * The whole database as one file, minus what must not leave it.
 *
 * Every table comes from the schema itself, so a model added later is in the
 * next copy without anyone remembering to list it. What is listed by hand is
 * the opposite: what stays out, and why.
 */

/**
 * Left out entirely, because a backup is a file that ends up in a Downloads
 * folder, a cloud drive, an email to yourself.
 *
 * - `Session`: each row is a live login. Restoring them would sign back in
 *   whoever held them, which is the opposite of what revoking a session meant.
 * - `Verification`: one-use tokens that expire in minutes. Nothing to keep.
 * - `RestorePoint`: whole backups kept for undoing a restore. A copy holding
 *   copies of itself grows with every restore and protects against nothing new.
 */
export const EXCLUDED: ModelName[] = ["Session", "Verification", "RestorePoint"];

/**
 * Kept, with these columns blanked.
 *
 * The account row is what links a Google identity to a panel user, and losing
 * it would mean the first login after a restore meets a user with no way in.
 * Its tokens are another matter: a refresh token is a standing grant to read
 * Analytics and Search Console. The next login issues fresh ones anyway.
 */
export const REDACTED: Partial<Record<ModelName, string[]>> = {
  Account: ["accessToken", "refreshToken", "idToken", "password"],
};

export async function buildBackup(
  client: PrismaClient = dbBase,
  schema = "public",
): Promise<{ file: BackupFile; rows: number }> {
  const models = tableOrder(modelNames.filter((m) => !EXCLUDED.includes(m)));

  // One batch: at this distance every sequential read is a whole round trip,
  // and sixty of them would be most of the wait.
  const [migration, ...read] = await Promise.all([
    latestMigration(client, schema),
    ...models.map((model) => readRows(client, model)),
  ]);

  const tables: BackupFile["tables"] = {};
  let rows = 0;

  models.forEach((model, i) => {
    const blank = REDACTED[model] ?? [];
    const kept = read[i].map((row) =>
      blank.length === 0
        ? row
        : { ...row, ...Object.fromEntries(blank.map((field) => [field, null])) },
    );
    tables[model] = encodeRows(model, kept);
    rows += kept.length;
  });

  return {
    rows,
    file: {
      format: BACKUP_FORMAT,
      version: 1,
      createdAt: new Date().toISOString(),
      migration,
      excluded: EXCLUDED,
      redacted: REDACTED,
      tables,
    },
  };
}
