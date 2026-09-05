import { unstable_cache } from "next/cache";
import { db } from "@nassican/db";
import {
  CACHE_SECONDS,
  cacheTags,
  locales,
  type Locale,
  type Localized,
} from "@nassican/shared";

export type ExperienceItem = {
  /** Human-readable range shown in the UI, per language. */
  period: Localized<string>;
  /** Machine-readable start/end for <time>; omit `end` while ongoing. */
  start: string;
  end?: string;
  title: Localized<string>;
  /** Organisation name, kept as written in both languages. */
  org: string;
  desc: Localized<string>;
  /** Names must match the keys in `skills.ts` so the icons resolve. */
  stack: string[];
};

function localized<T>(pick: (locale: Locale) => T): Localized<T> {
  return Object.fromEntries(locales.map((l) => [l, pick(l)])) as Localized<T>;
}

/**
 * Work history only. The Systems Engineering degree lives in `education.ts`,
 * so it is not repeated here.
 */
async function readExperience(): Promise<ExperienceItem[]> {
  const rows = await db.experience.findMany({
    include: {
      translations: true,
      technologies: {
        include: { technology: true },
        orderBy: { position: "asc" },
      },
    },
    orderBy: { position: "asc" },
  });

  return rows.map((row) => {
    const t = (locale: Locale) => row.translations.find((x) => x.locale === locale);

    return {
      org: row.org,
      start: row.startDate,
      end: row.endDate ?? undefined,
      period: localized((l) => t(l)?.periodLabel ?? ""),
      title: localized((l) => t(l)?.title ?? ""),
      desc: localized((l) => t(l)?.description ?? ""),
      stack: row.technologies.map((x) => x.technology.key),
    };
  });
}

export const getExperience = unstable_cache(readExperience, ["experience"], {
  tags: [cacheTags.experience],
  revalidate: CACHE_SECONDS,
});
