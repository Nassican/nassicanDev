import { gunzipSync } from "node:zlib";
import { Prisma, type PrismaClient } from "../generated/prisma";
import {
  decodeValue,
  encodeValue,
  insertionOrder,
  parentsFirst,
  type FieldKind,
} from "./backup-codec";

/**
 * Generic reading and writing of whole tables, for the backup and the trash.
 *
 * Everything here is driven by Prisma's own description of the schema, so a
 * model added tomorrow is in the next backup without anyone remembering to list
 * it — a backup that silently skips the newest table is found out on the one day
 * it matters.
 *
 * Rows travel as JSON (`backup-codec.ts` says how each type is written), and
 * every write goes through `createMany`, so a restored row passes the same
 * constraints as one typed into the panel.
 */

export type ModelName = Prisma.ModelName;
type Client = PrismaClient | Prisma.TransactionClient;
type Row = Record<string, unknown>;

type ForeignKey = {
  field: string;
  target: ModelName;
  /** Whether the column may be cleared when its target has gone. */
  nullable: boolean;
  onDelete: string | undefined;
};

export type ModelInfo = {
  name: ModelName;
  table: string;
  kinds: Record<string, FieldKind>;
  columns: Record<string, string>;
  /** Null for tables keyed by two columns, the `*Translation` rows. */
  idField: string | null;
  uniques: string[];
  foreignKeys: ForeignKey[];
  /** `autoincrement()` columns, whose sequence must follow restored ids. */
  serials: string[];
};

const KINDS = new Set<string>(["DateTime", "Decimal", "BigInt", "Bytes", "Json"]);

function isAutoincrement(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    (value as { name: unknown }).name === "autoincrement"
  );
}

export const modelInfo = Object.fromEntries(
  Prisma.dmmf.datamodel.models.map((model) => {
    const scalars = model.fields.filter((f) => f.kind !== "object");
    const required = new Map(scalars.map((f) => [f.name, f.isRequired]));

    const info: ModelInfo = {
      name: model.name as ModelName,
      table: model.dbName ?? model.name,
      kinds: Object.fromEntries(
        scalars.map((f) => [f.name, (KINDS.has(f.type) ? f.type : "plain") as FieldKind]),
      ),
      columns: Object.fromEntries(scalars.map((f) => [f.name, f.dbName ?? f.name])),
      idField: scalars.find((f) => f.isId)?.name ?? null,
      uniques: scalars.filter((f) => f.isUnique).map((f) => f.name),
      foreignKeys: model.fields
        .filter((f) => f.kind === "object" && f.relationFromFields?.length === 1)
        .map((f) => {
          const field = f.relationFromFields![0];
          return {
            field,
            target: f.type as ModelName,
            nullable: required.get(field) === false,
            onDelete: f.relationOnDelete,
          };
        }),
      serials: scalars.filter((f) => isAutoincrement(f.default)).map((f) => f.name),
    };

    return [model.name, info];
  }),
) as Record<ModelName, ModelInfo>;

export const modelNames = Object.keys(modelInfo) as ModelName[];

type Delegate = {
  findMany(args?: { where?: object; select?: Record<string, true> }): Promise<Row[]>;
  createMany(args: { data: Row[] }): Promise<{ count: number }>;
  count(args?: { where?: object }): Promise<number>;
  updateMany(args: { where: object; data: Row }): Promise<{ count: number }>;
  deleteMany(args?: { where?: object }): Promise<{ count: number }>;
};

function delegate(client: Client, model: ModelName): Delegate {
  // The one loose cast on this path: the model is chosen at runtime, and Prisma
  // only types its delegates by name at compile time.
  const key = model[0].toLowerCase() + model.slice(1);
  return (client as unknown as Record<string, Delegate>)[key];
}

/** Tables in an order that can be inserted without breaking a key. */
export function tableOrder(models: readonly ModelName[] = modelNames): ModelName[] {
  return insertionOrder(
    models.map((name) => ({
      name,
      dependsOn: modelInfo[name].foreignKeys.map((fk) => fk.target),
    })),
  );
}

export function encodeRows(model: ModelName, rows: Row[]): Row[] {
  const { kinds } = modelInfo[model];
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([field, value]) => [
        field,
        encodeValue(kinds[field] ?? "plain", value),
      ]),
    ),
  );
}

function decodeRow(model: ModelName, row: Row): Row {
  const { kinds } = modelInfo[model];
  return Object.fromEntries(
    Object.entries(row).map(([field, value]) => {
      const kind = kinds[field] ?? "plain";
      // A nullable `jsonb` written as plain `null` is rejected: Prisma asks
      // which null is meant. The column's own NULL is what was read.
      if (kind === "Json" && value === null) return [field, Prisma.DbNull];
      return [field, decodeValue(kind, value)];
    }),
  );
}

export function readRows(client: Client, model: ModelName, where?: object): Promise<Row[]> {
  return delegate(client, model).findMany(where ? { where } : undefined);
}

export function countRows(client: Client, model: ModelName): Promise<number> {
  return delegate(client, model).count();
}

/** Writes encoded rows back. Self-referencing tables go parents first. */
export async function insertRows(client: Client, model: ModelName, rows: Row[]): Promise<number> {
  const info = modelInfo[model];
  const selfKeys = info.foreignKeys.filter((fk) => fk.target === model).map((fk) => fk.field);
  const ordered = info.idField ? parentsFirst(rows, info.idField, selfKeys) : rows;

  let written = 0;
  for (let i = 0; i < ordered.length; i += 1000) {
    const chunk = ordered.slice(i, i + 1000).map((row) => decodeRow(model, row));
    written += (await delegate(client, model).createMany({ data: chunk })).count;
  }
  return written;
}

/**
 * The Postgres schema a connection URL's model queries go to.
 *
 * Needed because **raw SQL does not follow it**. Prisma applies `?schema=` by
 * qualifying its own queries, and leaves `search_path` alone — so an unqualified
 * table name in `$queryRaw` resolves to `public` whatever the URL says. Found
 * restoring into a scratch schema: the sequence reset moved `public`'s sequence
 * and left the restored one at 1.
 */
export function schemaOf(url: string | undefined): string {
  let schema = "public";
  try {
    schema = (url && new URL(url).searchParams.get("schema")) || "public";
  } catch {
    // Not a URL Prisma would accept either; it raises its own error.
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
    throw new Error(`Nombre de esquema no válido: ${schema}`);
  }
  return schema;
}

/**
 * Moves an `autoincrement()` sequence past the ids just restored.
 *
 * Inserting explicit ids does not advance it, so without this the next audit
 * entry written after a restore collides with the oldest one restored.
 */
export async function resetSerials(
  client: Client,
  model: ModelName,
  schema = "public",
): Promise<void> {
  const info = modelInfo[model];
  for (const field of info.serials) {
    const table = `"${schema}"."${info.table}"`;
    const column = info.columns[field];
    // Identifiers come from the Prisma schema and `schemaOf`, never from input.
    await client.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('${table}', '${column}'), COALESCE((SELECT MAX("${column}") FROM ${table}), 0) + 1, false)`,
    );
  }
}

/** The newest migration applied, which is what a backup's shape belongs to. */
export async function latestMigration(client: Client, schema = "public"): Promise<string | null> {
  const rows = await client.$queryRawUnsafe<{ migration_name: string }[]>(
    `SELECT migration_name FROM "${schema}"._prisma_migrations
     WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
     ORDER BY migration_name DESC LIMIT 1`,
  );
  return rows[0]?.migration_name ?? null;
}

export const BACKUP_FORMAT = "nassican-backup";

export type BackupFile = {
  format: typeof BACKUP_FORMAT;
  version: 1;
  createdAt: string;
  /** Restoring needs a database migrated to exactly this point. */
  migration: string | null;
  /** Tables deliberately left out, so their absence reads as a decision. */
  excluded: ModelName[];
  /** Columns blanked in the rows that were kept. */
  redacted: Partial<Record<ModelName, string[]>>;
  tables: Partial<Record<ModelName, Row[]>>;
};

// ---------------------------------------------------------------------------
// Snapshots: one entity and everything that would go with it
// ---------------------------------------------------------------------------

export type SnapshotPart = { model: ModelName; rows: Row[] };

/**
 * Rows elsewhere that pointed at the entity through an `ON DELETE SET NULL`
 * key. Deleting cleared them; restoring points them back — a page brought back
 * from the trash is in the menu again, not merely in the database.
 */
export type Backlink = { model: ModelName; field: string; ids: string[] };

export type Snapshot = { parts: SnapshotPart[]; backlinks: Backlink[] };

/**
 * Everything `DELETE` would take with a row: the row, every table that
 * cascades from it — found from the schema, not listed by hand — and any
 * `extra` rows the caller knows belong to it without a key saying so.
 *
 * Listing the cascades by hand is how a new `*Translation` table would one day
 * be deleted with its parent and quietly missing from the restore.
 */
export async function takeSnapshot(
  client: Client,
  root: ModelName,
  id: string,
  extra: { model: ModelName; where: object }[] = [],
): Promise<Snapshot | null> {
  const [rootRow] = await readRows(client, root, { id });
  if (!rootRow) return null;

  const parts: SnapshotPart[] = [{ model: root, rows: [rootRow] }];
  const queue: { model: ModelName; ids: unknown[] }[] = [{ model: root, ids: [id] }];

  while (queue.length > 0) {
    const parent = queue.shift()!;
    const children = modelNames.flatMap((model) =>
      modelInfo[model].foreignKeys
        .filter(
          (fk) =>
            fk.target === parent.model && fk.onDelete === "Cascade" && model !== parent.model,
        )
        .map((fk) => ({ model, field: fk.field })),
    );

    const found = await Promise.all(
      children.map(async ({ model, field }) => ({
        model,
        rows: await readRows(client, model, { [field]: { in: parent.ids } }),
      })),
    );

    for (const { model, rows } of found) {
      if (rows.length === 0) continue;
      parts.push({ model, rows });
      const idField = modelInfo[model].idField;
      if (idField) queue.push({ model, ids: rows.map((r) => r[idField]) });
    }
  }

  for (const { model, where } of extra) {
    const rows = await readRows(client, model, where);
    if (rows.length > 0) parts.push({ model, rows });
  }

  const links = await Promise.all(
    modelNames.flatMap((model) =>
      modelInfo[model].foreignKeys
        .filter((fk) => fk.target === root && fk.onDelete === "SetNull")
        .map(async (fk): Promise<Backlink | null> => {
          const idField = modelInfo[model].idField;
          if (!idField) return null;
          const rows = await delegate(client, model).findMany({
            where: { [fk.field]: id },
            select: { [idField]: true },
          });
          return rows.length > 0
            ? { model, field: fk.field, ids: rows.map((r) => String(r[idField])) }
            : null;
        }),
    ),
  );

  return {
    parts: parts.map((p) => ({ model: p.model, rows: encodeRows(p.model, p.rows) })),
    backlinks: links.filter((b): b is Backlink => b !== null),
  };
}

/** A reference that no longer resolved, and what was done about it. */
export type RestoreNote = {
  model: ModelName;
  field: string;
  target: ModelName;
  rows: number;
  /** `cleared` set the column to null; `dropped` left the row out. */
  action: "cleared" | "dropped";
};

/**
 * Clears or drops references that would not resolve once the parts are written.
 *
 * A row the parts bring along always counts as present. For the tables in
 * `whole`, the parts are the *entire* table — they are about to replace it — so
 * a row that is in the database today but not in the parts does not count: it
 * will be gone by the time the reference is checked. Every other table is asked.
 */
async function resolveReferences(
  client: Client,
  input: SnapshotPart[],
  whole: ReadonlySet<ModelName> = new Set(),
): Promise<{ parts: SnapshotPart[]; notes: RestoreNote[] }> {
  const local = new Map<ModelName, Set<unknown>>();
  for (const part of input) {
    const idField = modelInfo[part.model].idField;
    if (!idField) continue;
    const set = local.get(part.model) ?? new Set();
    for (const row of part.rows) set.add(row[idField]);
    local.set(part.model, set);
  }

  const notes: RestoreNote[] = [];
  const parts: SnapshotPart[] = [];

  for (const part of input) {
    let rows = part.rows.map((r) => ({ ...r }));

    for (const fk of modelInfo[part.model].foreignKeys) {
      const mine = local.get(fk.target);
      const outside = (value: unknown) => value != null && !mine?.has(value);
      const wanted = [...new Set(rows.map((r) => r[fk.field]).filter(outside))];
      if (wanted.length === 0) continue;

      let present = new Set<unknown>();
      if (!whole.has(fk.target)) {
        const targetId = modelInfo[fk.target].idField ?? "id";
        const found = await delegate(client, fk.target).findMany({
          where: { [targetId]: { in: wanted } },
          select: { [targetId]: true },
        });
        present = new Set(found.map((r) => r[targetId]));
      }
      const missing = (row: Row) => outside(row[fk.field]) && !present.has(row[fk.field]);

      const affected = rows.filter(missing).length;
      if (affected === 0) continue;

      rows = fk.nullable
        ? rows.map((r) => (missing(r) ? { ...r, [fk.field]: null } : r))
        : rows.filter((r) => !missing(r));

      notes.push({
        model: part.model,
        field: fk.field,
        target: fk.target,
        rows: affected,
        action: fk.nullable ? "cleared" : "dropped",
      });
    }

    parts.push({ model: part.model, rows });
  }

  return { parts, notes };
}

export type RestoreResult =
  | { ok: true; notes: RestoreNote[]; relinked: number }
  | { ok: false; conflict: { model: ModelName; field: string; value: string } };

/**
 * Puts a snapshot back, inside one transaction.
 *
 * What it points at may have gone while it sat in the trash — the tag, the
 * cover image, the store. A nullable reference is cleared and a required one
 * drops its row, and both are **reported**: the restore succeeds with an
 * honest list rather than failing on the first missing image.
 *
 * What it cannot do is overwrite. If another row took the slug, the route or
 * the image's checksum meanwhile, nothing is written and the conflict is named.
 */
export async function restoreSnapshot(
  client: PrismaClient,
  snapshot: Snapshot,
  inside?: (tx: Prisma.TransactionClient) => Promise<unknown>,
): Promise<RestoreResult> {
  for (const part of snapshot.parts) {
    const info = modelInfo[part.model];
    const keys = [info.idField, ...info.uniques].filter(
      (k, i, all): k is string => !!k && all.indexOf(k) === i,
    );

    for (const key of keys) {
      const values = part.rows.map((r) => r[key]).filter((v) => v != null);
      if (values.length === 0) continue;
      const [taken] = await delegate(client, part.model).findMany({
        where: { [key]: { in: values } },
        select: { [key]: true },
      });
      if (taken) {
        return {
          ok: false,
          conflict: { model: part.model, field: key, value: String(taken[key]) },
        };
      }
    }
  }

  const { parts, notes } = await resolveReferences(client, snapshot.parts);

  const root = snapshot.parts[0];
  const rootId = root.rows[0][modelInfo[root.model].idField ?? "id"];
  const order = tableOrder([...new Set(parts.map((p) => p.model))]);
  let relinked = 0;

  await client.$transaction(
    async (tx) => {
      for (const model of order) {
        for (const part of parts.filter((p) => p.model === model)) {
          await insertRows(tx, model, part.rows);
        }
      }

      for (const link of snapshot.backlinks) {
        const idField = modelInfo[link.model].idField ?? "id";
        // Only rows still cleared: one that has since been pointed somewhere
        // else was a decision made after the deletion, and that one wins.
        const { count } = await delegate(tx, link.model).updateMany({
          where: { [idField]: { in: link.ids }, [link.field]: null },
          data: { [link.field]: rootId },
        });
        relinked += count;
      }

      if (inside) await inside(tx);
    },
    { timeout: 30_000 },
  );

  return { ok: true, notes, relinked };
}

// ---------------------------------------------------------------------------
// Restoring over a live database, from the panel
// ---------------------------------------------------------------------------

/**
 * What a restore from the panel replaces: everything someone wrote by hand.
 *
 * The CLI restores into an empty database and puts back everything. The panel
 * restores over the one it is running on, so it has to choose, and the line is
 * **what you made against what happened**.
 */
export const REPLACED_ON_RESTORE = [
  "Post", "PostTranslation", "PostRevision", "Category", "CategoryTranslation",
  "Tag", "TagTranslation", "PostTag",
  "Project", "ProjectTranslation", "Technology", "ProjectTechnology",
  "SkillGroup", "SkillGroupTranslation", "SkillGroupItem",
  "Profile", "ProfileTranslation", "ProfileCv", "ProfileCvTranslation",
  "Experience", "ExperienceTranslation", "ExperienceTechnology",
  "Education", "EducationTranslation", "Certificate", "CertificateTranslation",
  "Page", "PageTranslation",
  "Media", "MediaBlob", "MediaTranslation", "MediaFolder", "MediaUsage",
  "SeoSettings", "SeoSettingsTranslation", "Redirect",
  "SiteSettings", "NavigationItem", "NavigationItemTranslation", "HomeSection",
  "GameStore", "Game", "Book",
] as const satisfies readonly ModelName[];

/**
 * Left exactly as they are, for three different reasons.
 *
 * - **Who can get in**: users, accounts, sessions. Restoring an old user table
 *   is how a restore locks its own operator out — the one mistake with no way
 *   back through the panel.
 * - **What happened**: the audit log, syncs, events, the trash, restore points.
 *   A history rolled back is not a history; and the restore itself must be in it.
 * - **Mirrors of someone else's data**: GA4, Search Console, Vercel, Wallet, link
 *   checks, uptime. The next sync is newer than any backup.
 */
export const KEPT_ON_RESTORE = [
  "User", "Session", "Account", "Verification",
  "AuditLog", "SyncRun", "SystemEvent", "TrashItem", "RestorePoint",
  "ContentStatsDaily",
  "SearchConsoleDaily", "AnalyticsDailyTotals", "AnalyticsDailyPage",
  "AnalyticsDailySource", "AnalyticsDailyGeo", "AnalyticsDailyDevice",
  "VercelAnalyticsDaily", "Deployment", "UptimeCheck", "OutboundLink",
  "WalletAccount", "WalletCategory", "WalletRecord", "WalletBudget",
] as const satisfies readonly ModelName[];

/**
 * Fails to compile when a model is in neither list. A new table that a restore
 * silently skipped — or silently wiped — would be found out on the day it was
 * needed. Same trick as `localeParity`.
 */
type Assigned = (typeof REPLACED_ON_RESTORE)[number] | (typeof KEPT_ON_RESTORE)[number];
export type RestorePolicyComplete = [Exclude<ModelName, Assigned>] extends [never]
  ? true
  : Exclude<ModelName, Assigned>;
export const restorePolicyComplete: RestorePolicyComplete = true;

export type ReplaceChange = {
  model: ModelName;
  /** Rows today. */
  current: number;
  /** Rows in the file. */
  incoming: number;
  /** In the database and not in the file: created after the backup, lost. */
  lost: number;
  /** In the file and not in the database: deleted after the backup, back. */
  returning: number;
};

export type ReplacePlan = {
  backupMigration: string | null;
  currentMigration: string | null;
  changes: ReplaceChange[];
};

/** What a restore would do, without doing it. */
export async function planReplace(
  client: Client,
  file: BackupFile,
  schema = "public",
): Promise<ReplacePlan> {
  const [currentMigration, ...current] = await Promise.all([
    latestMigration(client, schema),
    ...REPLACED_ON_RESTORE.map((model) => readRows(client, model)),
  ]);

  const changes = REPLACED_ON_RESTORE.map((model, i): ReplaceChange => {
    const incoming = file.tables[model] ?? [];
    const idField = modelInfo[model].idField;
    const key = (row: Row) =>
      idField ? String(row[idField]) : JSON.stringify(Object.keys(row).sort().map((k) => row[k]));
    const before = new Set(encodeRows(model, current[i]).map(key));
    const after = new Set(incoming.map(key));

    return {
      model,
      current: before.size,
      incoming: after.size,
      lost: [...before].filter((k) => !after.has(k)).length,
      returning: [...after].filter((k) => !before.has(k)).length,
    };
  });

  return { backupMigration: file.migration, currentMigration, changes };
}

/**
 * Replaces every table in `REPLACED_ON_RESTORE` with the file's rows, in one
 * transaction: emptied in reverse key order, filled in key order. A failure
 * anywhere leaves the database exactly as it was.
 *
 * References into the kept tables — a post's author, an image's uploader — are
 * checked against the database as it is, and cleared when the user is gone.
 */
export async function replaceContent(
  client: PrismaClient,
  file: BackupFile,
  schema = "public",
): Promise<{ rows: number; notes: RestoreNote[] }> {
  const current = await latestMigration(client, schema);
  if (current !== file.migration) {
    throw new Error(`La copia es de la migración ${file.migration} y la base está en ${current}.`);
  }

  const order = tableOrder([...REPLACED_ON_RESTORE]);
  const { parts, notes } = await resolveReferences(
    client,
    order.map((model) => ({ model, rows: file.tables[model] ?? [] })),
    new Set<ModelName>(REPLACED_ON_RESTORE),
  );

  let rows = 0;
  await client.$transaction(
    async (tx) => {
      for (const model of [...order].reverse()) {
        await delegate(tx, model).deleteMany();
      }
      for (const part of parts) {
        rows += await insertRows(tx, part.model, part.rows);
        await resetSerials(tx, part.model, schema);
      }
    },
    { timeout: 120_000, maxWait: 20_000 },
  );

  return { rows, notes };
}

/**
 * A backup file's bytes as a `BackupFile`, or an error that says why not.
 * Shared by the CLI and the panel so both accept and refuse the same files.
 */
export function parseBackup(bytes: Uint8Array): BackupFile {
  // Gzip by its magic bytes rather than its name: a renamed file still restores.
  const text =
    bytes[0] === 0x1f && bytes[1] === 0x8b
      ? gunzipSync(bytes).toString("utf8")
      : Buffer.from(bytes).toString("utf8");

  let file: BackupFile;
  try {
    file = JSON.parse(text) as BackupFile;
  } catch {
    throw new Error("El archivo no es JSON: no parece una copia de seguridad.");
  }

  if (file?.format !== BACKUP_FORMAT || file.version !== 1 || typeof file.tables !== "object") {
    throw new Error("Esto no es una copia de seguridad de App Nassican, o es de una versión que no se conoce.");
  }

  const known = new Set<string>(modelNames);
  const unknown = Object.keys(file.tables).filter((t) => !known.has(t));
  if (unknown.length > 0) {
    throw new Error(`La copia trae tablas que este esquema no tiene: ${unknown.join(", ")}.`);
  }

  return file;
}
