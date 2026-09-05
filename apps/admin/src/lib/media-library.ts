import "server-only";

import { db } from "@nassican/db";
import { locales, type Locale } from "@nassican/shared";
import { describeUsage, type MediaUsageSummary } from "@/lib/media-usage";

export type MediaText = Record<Locale, { alt: string; caption: string }>;

export type MediaItem = {
  id: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  createdAt: string;
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
      translations: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return Promise.all(
    rows.map(async (row) => {
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
        text,
        usage: await describeUsage(row.id),
      };
    }),
  );
}

/** Total bytes held in the blob table, for the library header. */
export async function mediaTotals(): Promise<{ count: number; bytes: number }> {
  const rows = await db.media.aggregate({
    _count: true,
    _sum: { sizeBytes: true },
  });
  return { count: rows._count, bytes: Number(rows._sum.sizeBytes ?? 0) };
}
