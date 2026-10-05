import "server-only";

import {
  db,
  dbBase,
  prismaJson,
  restoreSnapshot,
  takeSnapshot,
  type ModelName,
  type RestoreNote,
  type Snapshot,
  type TrashKind,
} from "@nassican/db";
import { cacheTags, postTags } from "@nassican/shared";

/**
 * The trash: a deletion that can be taken back for thirty days.
 *
 * A deletion is still a real `DELETE`. What changes is that the rows are copied
 * into `trash_items` first, inside the same transaction — so there is no moment
 * where the content is gone from both places, and nothing that reads the
 * content ever has to know the trash exists. Why a snapshot and not a
 * `deletedAt` column is in the schema, next to the model.
 */

export const TRASH_DAYS = 30;

const roots: Record<TrashKind, ModelName> = {
  post: "Post",
  project: "Project",
  page: "Page",
  media: "Media",
  game: "Game",
  book: "Book",
  subscription: "Subscription",
  journal: "JournalEntry",
  task: "Task",
};

export const kindLabels: Record<TrashKind, string> = {
  post: "Artículo",
  project: "Proyecto",
  page: "Página",
  media: "Imagen",
  game: "Juego",
  book: "Libro",
  subscription: "Suscripción",
  journal: "Nota de bitácora",
  task: "Pendiente",
};

/**
 * Rows that belong to an entity with no foreign key to say so.
 *
 * `media_usages` names its entity by type and id, so a cascade cannot find it.
 * Leaving them behind was a bug before the trash existed: deleting an article
 * kept its images marked «en uso» forever, and the media library refuses to
 * delete an image that is in use. Taking them along fixes that, and restoring
 * puts them back.
 */
function extras(kind: TrashKind, id: string) {
  return kind === "post" || kind === "project" || kind === "page"
    ? [{ model: "MediaUsage" as const, where: { entityType: kind, entityId: id } }]
    : [];
}

type Row = Record<string, unknown>;

function rowsOf(snapshot: Snapshot, model: ModelName): Row[] {
  return snapshot.parts.find((p) => p.model === model)?.rows ?? [];
}

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value : null);

/** What the list calls it: the name a person would recognise. */
function labelOf(kind: TrashKind, snapshot: Snapshot): string {
  const root = snapshot.parts[0].rows[0];
  const spanish = (model: ModelName, field: string) =>
    text(rowsOf(snapshot, model).find((r) => r.locale === "es")?.[field]);

  switch (kind) {
    case "post":
      return spanish("PostTranslation", "title") ?? String(root.slug);
    case "project":
      return String(root.title);
    case "page":
      return `${spanish("PageTranslation", "title") ?? "Página"} (${String(root.route)})`;
    case "media":
      return spanish("MediaTranslation", "alt") ?? `Imagen ${String(root.checksum ?? root.id).slice(0, 12)}`;
    case "subscription":
      return String(root.name);
    case "journal":
      return String(root.text).slice(0, 80);
    case "task":
      return String(root.title);
    default:
      return String(root.title);
  }
}

/**
 * The tags to invalidate when this entity leaves or rejoins the site. Empty for
 * what the site never shows.
 */
export function siteTagsFor(kind: TrashKind, root: Row): string[] {
  switch (kind) {
    case "post":
      return postTags(String(root.slug));
    case "project":
      return [cacheTags.projects, cacheTags.project(String(root.slug))];
    case "page":
      return [cacheTags.pages, cacheTags.page(String(root.route))];
    case "media":
      // An image may have been an avatar, a certificate file or the default
      // social image, all `SET NULL` keys that the trash restores.
      return [cacheTags.posts, cacheTags.projects, cacheTags.profile, cacheTags.certificates, cacheTags.seoSettings];
    default:
      return [];
  }
}

function remove(kind: TrashKind, id: string) {
  switch (kind) {
    case "post":
      return dbBase.post.delete({ where: { id } });
    case "project":
      return dbBase.project.delete({ where: { id } });
    case "page":
      return dbBase.page.delete({ where: { id } });
    case "media":
      return dbBase.media.delete({ where: { id } });
    case "game":
      return dbBase.game.delete({ where: { id } });
    case "book":
      return dbBase.book.delete({ where: { id } });
    case "subscription":
      return dbBase.subscription.delete({ where: { id } });
    case "journal":
      return dbBase.journalEntry.delete({ where: { id } });
    case "task":
      return dbBase.task.delete({ where: { id } });
  }
}

export type Trashed = { label: string; root: Row };

/**
 * Copies an entity into the trash and deletes it, in one transaction.
 *
 * Null when there was nothing to delete — a double click, or another tab that
 * got there first.
 */
export async function moveToTrash(kind: TrashKind, id: string, userId: string): Promise<Trashed | null> {
  const snapshot = await takeSnapshot(dbBase, roots[kind], id, extras(kind, id));
  if (!snapshot) return null;

  const label = labelOf(kind, snapshot);

  await dbBase.$transaction([
    dbBase.trashItem.create({
      data: {
        kind,
        entityId: id,
        label: label.slice(0, 300),
        payload: prismaJson.snapshot(snapshot),
        sizeBytes: Buffer.byteLength(JSON.stringify(snapshot)),
        deletedBy: userId,
      },
    }),
    remove(kind, id),
    ...(extras(kind, id).length > 0
      ? [dbBase.mediaUsage.deleteMany({ where: { entityType: kind, entityId: id } })]
      : []),
  ]);

  return { label, root: snapshot.parts[0].rows[0] };
}

export type TrashEntry = {
  id: string;
  kind: TrashKind;
  label: string;
  sizeBytes: number;
  deletedAt: Date;
  expiresAt: Date;
  deletedBy: string | null;
};

export async function listTrash(): Promise<TrashEntry[]> {
  const items = await db.trashItem.findMany({
    orderBy: { deletedAt: "desc" },
    // Never the payload: an image in the trash carries its bytes.
    select: {
      id: true,
      kind: true,
      label: true,
      sizeBytes: true,
      deletedAt: true,
      user: { select: { name: true, email: true } },
    },
  });

  return items.map((item) => ({
    id: item.id,
    kind: item.kind,
    label: item.label,
    sizeBytes: item.sizeBytes,
    deletedAt: item.deletedAt,
    expiresAt: new Date(item.deletedAt.getTime() + TRASH_DAYS * 86_400_000),
    deletedBy: item.user?.name ?? item.user?.email ?? null,
  }));
}

const nouns: Partial<Record<ModelName, [string, string]>> = {
  Media: ["imagen", "imágenes"],
  Tag: ["etiqueta", "etiquetas"],
  Technology: ["tecnología", "tecnologías"],
  User: ["usuario", "usuarios"],
  Category: ["categoría", "categorías"],
  GameStore: ["tienda", "tiendas"],
  MediaFolder: ["carpeta", "carpetas"],
  Page: ["página", "páginas"],
};

/** One sentence per reference that did not survive the wait. */
export function describeNote(note: RestoreNote): string {
  const [one, many] = nouns[note.target] ?? ["referencia", "referencias"];
  const what = `${note.rows} ${note.rows === 1 ? one : many}`;
  const exists = note.rows === 1 ? "ya no existe" : "ya no existen";

  if (note.model === "MediaUsage") {
    return `${what} del contenido ${exists}: revisa los bloques de imagen, se verán rotos.`;
  }
  return note.action === "cleared"
    ? `${what} ${exists}; el campo quedó vacío.`
    : `${what} ${exists} y no se restauró.`;
}

function describeConflict(field: string, value: string): string {
  switch (field) {
    case "slug":
      return `Ya hay otro elemento con la dirección «${value}». Cámbiala o bórralo antes de restaurar.`;
    case "route":
      return `La ruta ${value} ya la usa otra página.`;
    case "checksum":
      return "Esa misma imagen ya está otra vez en la biblioteca.";
    default:
      return "Ya existe: probablemente se restauró antes.";
  }
}

export type RestoreOutcome =
  | { ok: false; message: string }
  | {
      ok: true;
      kind: TrashKind;
      entityId: string;
      label: string;
      root: Row;
      notes: string[];
      relinked: number;
    };

export async function restoreFromTrash(itemId: string): Promise<RestoreOutcome> {
  const item = await db.trashItem.findUnique({ where: { id: itemId } });
  if (!item) return { ok: false, message: "Ya no está en la papelera." };

  const result = await restoreSnapshot(dbBase, item.payload, (tx) =>
    // Inside the same transaction: restored and still in the trash would be a
    // second copy waiting to collide with the first.
    tx.trashItem.delete({ where: { id: itemId } }),
  );

  if (!result.ok) {
    return { ok: false, message: describeConflict(result.conflict.field, result.conflict.value) };
  }

  return {
    ok: true,
    kind: item.kind,
    entityId: item.entityId,
    label: item.label,
    root: item.payload.parts[0].rows[0],
    notes: result.notes.map(describeNote),
    relinked: result.relinked,
  };
}

export async function destroyTrashItem(itemId: string): Promise<{ kind: TrashKind; label: string } | null> {
  const item = await db.trashItem.findUnique({
    where: { id: itemId },
    select: { kind: true, label: true },
  });
  if (!item) return null;
  await db.trashItem.delete({ where: { id: itemId } });
  return item;
}

/** What the daily job clears. Returns how many went. */
export async function purgeTrash(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - TRASH_DAYS * 86_400_000);
  const { count } = await db.trashItem.deleteMany({ where: { deletedAt: { lt: cutoff } } });
  return count;
}
