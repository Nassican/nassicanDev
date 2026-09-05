import { unstable_cache } from "next/cache";
import { db } from "@nassican/db";
import {
  CACHE_SECONDS,
  cacheTags,
  locales,
  type Locale,
  type Localized,
} from "@nassican/shared";

export type EducationItem = {
  /** Human-readable range shown in the UI, per language. */
  period: Localized<string>;
  /** Machine-readable start, for <time>. */
  start: string;
  /**
   * Real completion date when `status` is "completed", expected end otherwise.
   * Omit when there is no meaningful end date at all.
   */
  end?: string;
  /**
   * Stated explicitly rather than derived from `end`: the site is statically
   * built, so it cannot re-evaluate "has this finished yet" as time passes.
   */
  status: "completed" | "in-progress";
  title: Localized<string>;
  /** Institution name, kept as written in both languages. */
  org: string;
  desc: Localized<string>;
  link?: string;
};

function localized<T>(pick: (locale: Locale) => T): Localized<T> {
  return Object.fromEntries(locales.map((l) => [l, pick(l)])) as Localized<T>;
}

async function readEducation(): Promise<EducationItem[]> {
  const rows = await db.education.findMany({
    include: { translations: true },
    orderBy: { position: "asc" },
  });

  return rows.map((row) => {
    const t = (locale: Locale) => row.translations.find((x) => x.locale === locale);

    return {
      org: row.institution,
      start: row.startDate,
      end: row.endDate ?? undefined,
      status: row.status === "completed" ? "completed" : "in-progress",
      link: row.link ?? undefined,
      period: localized((l) => t(l)?.periodLabel ?? ""),
      title: localized((l) => t(l)?.degree ?? ""),
      desc: localized((l) => t(l)?.description ?? ""),
    };
  });
}

export const getEducation = unstable_cache(readEducation, ["education"], {
  tags: [cacheTags.education],
  revalidate: CACHE_SECONDS,
});
