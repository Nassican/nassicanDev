import "server-only";

import { unstable_cache } from "next/cache";
import { db } from "@nassican/db";
import { cacheTags, CACHE_SECONDS } from "@nassican/shared";

/**
 * The technologies and their groups, for the skills section.
 *
 * **Not exported from the `lib/data` barrel**, because `Skills.tsx` is a client
 * component and imports from it — the rule CLAUDE.md states about the posts
 * queries, for the same reason. The page reads this and passes it down.
 */

export type TechnologyBrand = {
  key: string;
  name: string;
  hex: string;
  /** Prepared markup, or null to fall back to the monochrome react-icons map. */
  iconSvg: string | null;
};

export type SkillGroupData = {
  key: string;
  labels: Record<string, string>;
  items: TechnologyBrand[];
};

export const getSkillGroups = unstable_cache(
  async (): Promise<SkillGroupData[]> => {
    const groups = await db.skillGroup.findMany({
      orderBy: { position: "asc" },
      include: {
        translations: { select: { locale: true, label: true } },
        items: {
          orderBy: { position: "asc" },
          include: {
            technology: {
              select: { key: true, name: true, hex: true, iconSvg: true },
            },
          },
        },
      },
    });

    return groups.map((group) => ({
      key: group.key,
      labels: Object.fromEntries(group.translations.map((t) => [t.locale, t.label])),
      items: group.items.map((item) => ({
        key: item.technology.key,
        name: item.technology.name,
        hex: item.technology.hex,
        iconSvg: item.technology.iconSvg,
      })),
    }));
  },
  ["skill-groups"],
  { tags: [cacheTags.skills], revalidate: CACHE_SECONDS },
);
