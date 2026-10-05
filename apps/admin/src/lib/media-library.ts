import "server-only";

import { db } from "@nassican/db";
import { locales, type Locale } from "@nassican/shared";
import { describeUsageMany, type MediaUsageSummary } from "@/lib/media-usage";

export type MediaText = Record<Locale, { alt: string; caption: string }>;

export type MediaItem = {
  id: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  createdAt: string;
  folderId: string | null;
  text: MediaText;
  usage: MediaUsageSummary[];
};

function emptyText(): MediaText {
  return Object.fromEntries(
    locales.map((l) => [l, { alt: "", caption: "" }]),
  ) as MediaText;
}

/**
 * The library never selects `blob.data`: listing a dozen images must not pull
 * megabytes of binary out of Postgres. That separation is the whole reason the
 * bytes live in their own table.
 *
 * Every image's metadata comes down at once — a few hundred bytes each, so even
 * a thousand is less than one diploma — and the browser filters, sorts and pages
 * it without asking again. What would not scale is the thumbnails, and those
 * are paged and lazy.
 */
export async function listMedia(): Promise<MediaItem[]> {
  const rows = await db.media.findMany({
    select: {
      id: true,
      url: true,
      mimeType: true,
      sizeBytes: true,
      width: true,
      height: true,
      createdAt: true,
      folderId: true,
      translations: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const usage = await describeUsageMany(rows.map((row) => row.id));

  return rows.map((row) => {
    const text = emptyText();
    for (const locale of locales) {
      const t = row.translations.find((x) => x.locale === locale);
      text[locale] = { alt: t?.alt ?? "", caption: t?.caption ?? "" };
    }

    return {
      id: row.id,
      url: row.url,
      mimeType: row.mimeType,
      sizeBytes: Number(row.sizeBytes),
      width: row.width,
      height: row.height,
      createdAt: row.createdAt.toISOString(),
      folderId: row.folderId,
      text,
      usage: usage.get(row.id) ?? [],
    };
  });
}

export type MediaFolderItem = { id: string; name: string; count: number };

/**
 * Folders, flat. The schema allows nesting, and nothing uses it: at this scale
 * one level answers «where are the diplomas», and a tree would be a second
 * navigation to learn for no image that needs it.
 */
export async function listFolders(): Promise<MediaFolderItem[]> {
  const rows = await db.mediaFolder.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, _count: { select: { media: true } } },
  });
  return rows.map((f) => ({ id: f.id, name: f.name, count: f._count.media }));
}

/** Total bytes held in the blob table, for the library header. */
export async function mediaTotals(): Promise<{ count: number; bytes: number }> {
  const rows = await db.media.aggregate({
    _count: true,
    _sum: { sizeBytes: true },
  });
  return { count: rows._count, bytes: Number(rows._sum.sizeBytes ?? 0) };
}
