import "server-only";

import { gzipSync } from "node:zlib";
import {
  dbBase,
  parseBackup,
  planReplace,
  replaceContent,
  type BackupFile,
  type ModelName,
  type PrismaClient,
} from "@nassican/db";
import { buildBackup } from "@/lib/backup";
import { describeNote } from "@/lib/trash";

/**
 * Restoring a backup over the live database, from the panel.
 *
 * The CLI restores into an empty database and refuses anything else. This is
 * the other case — «go back to how it was on Tuesday» — and it is the most
 * destructive thing the panel does, so three things stand between a click and
 * the result:
 *
 * 1. **A preview first.** What comes back, what is lost, per table, before
 *    anything is written. Nothing is applied without having been shown.
 * 2. **A typed confirmation**, checked again on the server.
 * 3. **A restore point** of the current state, taken before every restore and
 *    restorable the same way. A restore with the wrong file is one click from
 *    undone.
 *
 * Which tables are replaced and which are left alone is decided in
 * `packages/db/src/backup.ts`, next to the compile-time check that every table
 * has been assigned to one side.
 */

/** Points kept. Each is a whole backup; five is a week of second thoughts. */
const KEEP_POINTS = 5;

/**
 * The tables a person recognises, in the order they think of them. The rest
 * — translations, join tables, blobs — move with their parents and only add
 * noise to a preview.
 */
const labels: Partial<Record<ModelName, string>> = {
  Post: "Artículos",
  Project: "Proyectos",
  Page: "Páginas",
  Media: "Imágenes",
  Technology: "Tecnologías",
  Experience: "Experiencia",
  Education: "Formación",
  Certificate: "Certificados",
  NavigationItem: "Entradas del menú",
  Redirect: "Redirecciones",
  Game: "Juegos",
  GameStore: "Tiendas",
  Book: "Libros",
};

export type PreviewRow = {
  label: string;
  current: number;
  incoming: number;
  lost: number;
  returning: number;
};

export type RestorePreview = {
  createdAt: string;
  /** Why it cannot be applied, or null when it can. */
  problem: string | null;
  rows: PreviewRow[];
};

export async function previewRestore(
  file: BackupFile,
  client: PrismaClient = dbBase,
  schema = "public",
): Promise<RestorePreview> {
  const plan = await planReplace(client, file, schema);

  const problem =
    plan.backupMigration !== plan.currentMigration
      ? `La copia es de otra versión de la base (${plan.backupMigration ?? "sin migración"}; ahora ${plan.currentMigration}). ` +
        "Desde el panel solo se restaura una copia de la versión actual: las tablas cambiaron de forma desde entonces."
      : null;

  const order = Object.keys(labels);
  const rows = plan.changes
    .filter((c) => labels[c.model])
    .sort((a, b) => order.indexOf(a.model) - order.indexOf(b.model))
    .map((c) => ({
      label: labels[c.model]!,
      current: c.current,
      incoming: c.incoming,
      lost: c.lost,
      returning: c.returning,
    }));

  return { createdAt: file.createdAt, problem, rows };
}

export type RestoreApplied = { rows: number; notes: string[]; pointId: string };

/**
 * Takes a restore point of the current state, then replaces the content.
 *
 * The point is written first and outside the transaction on purpose: if the
 * restore fails, the database is untouched and the point is merely redundant;
 * if it succeeds, the point is the way back.
 */
export async function applyRestore(
  file: BackupFile,
  options: { userId: string; reason: string },
  client: PrismaClient = dbBase,
  schema = "public",
): Promise<RestoreApplied> {
  const { file: before, rows } = await buildBackup(client, schema);
  const data = gzipSync(JSON.stringify(before));

  const point = await client.restorePoint.create({
    data: {
      reason: options.reason,
      data: new Uint8Array(data),
      sizeBytes: data.length,
      rows,
      createdBy: options.userId,
    },
    select: { id: true },
  });

  const result = await replaceContent(client, file, schema);

  const old = await client.restorePoint.findMany({
    orderBy: { createdAt: "desc" },
    skip: KEEP_POINTS,
    select: { id: true },
  });
  if (old.length > 0) {
    await client.restorePoint.deleteMany({ where: { id: { in: old.map((p) => p.id) } } });
  }

  return { rows: result.rows, notes: result.notes.map(describeNote), pointId: point.id };
}

export type RestorePointEntry = {
  id: string;
  reason: string;
  createdAt: Date;
  rows: number;
  sizeBytes: number;
  by: string | null;
};

export async function listRestorePoints(): Promise<RestorePointEntry[]> {
  const points = await dbBase.restorePoint.findMany({
    orderBy: { createdAt: "desc" },
    // Never the bytes: the list is a list.
    select: {
      id: true,
      reason: true,
      createdAt: true,
      rows: true,
      sizeBytes: true,
      user: { select: { name: true, email: true } },
    },
  });

  return points.map((p) => ({
    id: p.id,
    reason: p.reason,
    createdAt: p.createdAt,
    rows: p.rows,
    sizeBytes: p.sizeBytes,
    by: p.user?.name ?? p.user?.email ?? null,
  }));
}

/** A point's bytes, as the download serves them. */
export async function readRestorePoint(id: string): Promise<{ data: Uint8Array; createdAt: Date } | null> {
  return dbBase.restorePoint.findUnique({
    where: { id },
    select: { data: true, createdAt: true },
  });
}

/** A point as a backup file, ready to preview or apply. */
export async function loadRestorePoint(id: string): Promise<BackupFile | null> {
  const point = await readRestorePoint(id);
  return point ? parseBackup(point.data) : null;
}
