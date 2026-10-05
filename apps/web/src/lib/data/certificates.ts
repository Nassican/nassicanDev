import { unstable_cache } from "next/cache";
import { db } from "@nassican/db";
import {
  CACHE_SECONDS,
  cacheTags,
  locales,
  type Locale,
  type Localized,
} from "@nassican/shared";

export type CertificateImage = {
  url: string;
  width: number;
  height: number;
  blurDataUrl: string | null;
  /** Written per language in the media library; falls back to the title. */
  alt: Localized<string>;
};

export type Certificate = {
  title: Localized<string>;
  /** Provider name, kept as written in both languages. */
  provider: string;
  category: Localized<string>;
  date?: string;
  url: string;
  /** The diploma itself, when one has been stored. */
  image?: CertificateImage;
};

async function readCertificates(): Promise<Certificate[]> {
  const rows = await db.certificate.findMany({
    include: {
      translations: true,
      file: {
        select: {
          url: true,
          width: true,
          height: true,
          blurDataUrl: true,
          translations: { select: { locale: true, alt: true } },
        },
      },
    },
    orderBy: { position: "asc" },
  });

  const localized = <T,>(pick: (locale: Locale) => T): Localized<T> =>
    Object.fromEntries(locales.map((l) => [l, pick(l)])) as Localized<T>;

  return rows.map((row) => {
    const t = (locale: Locale) => row.translations.find((x) => x.locale === locale);
    const title = localized((l) => t(l)?.title ?? "");
    const file = row.file;

    return {
      provider: row.provider,
      date: row.dateLabel ?? undefined,
      url: row.credentialUrl,
      title,
      category: localized((l) => t(l)?.category ?? ""),
      // Width and height are required by next/image to reserve the space; a
      // file without them is left out rather than shown with a layout jump.
      image:
        file && file.width && file.height
          ? {
              url: file.url,
              width: file.width,
              height: file.height,
              blurDataUrl: file.blurDataUrl,
              alt: localized((l) => file.translations.find((x) => x.locale === l)?.alt || title[l]),
            }
          : undefined,
    };
  });
}

export const getCertificates = unstable_cache(readCertificates, ["certificates"], {
  tags: [cacheTags.certificates],
  revalidate: CACHE_SECONDS,
});
