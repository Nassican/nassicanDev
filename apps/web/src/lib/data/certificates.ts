import { unstable_cache } from "next/cache";
import { db } from "@nassican/db";
import { cacheTags, locales, type Locale, type Localized } from "@nassican/shared";

export type Certificate = {
  title: Localized<string>;
  /** Provider name, kept as written in both languages. */
  provider: string;
  category: Localized<string>;
  date?: string;
  url: string;
};

async function readCertificates(): Promise<Certificate[]> {
  const rows = await db.certificate.findMany({
    include: { translations: true },
    orderBy: { position: "asc" },
  });

  const localized = <T,>(pick: (locale: Locale) => T): Localized<T> =>
    Object.fromEntries(locales.map((l) => [l, pick(l)])) as Localized<T>;

  return rows.map((row) => {
    const t = (locale: Locale) => row.translations.find((x) => x.locale === locale);

    return {
      provider: row.provider,
      date: row.dateLabel ?? undefined,
      url: row.credentialUrl,
      title: localized((l) => t(l)?.title ?? ""),
      category: localized((l) => t(l)?.category ?? ""),
    };
  });
}

export const getCertificates = unstable_cache(readCertificates, ["certificates"], {
  tags: [cacheTags.certificates],
});
