import "server-only";

import { db } from "@nassican/db";

/**
 * The technologies and the groups they sit in.
 *
 * The data has been in these tables since the content migration — projects and
 * experience already reference technologies by foreign key — but nothing could
 * edit it, so the public site kept reading `skills.ts` from the code. This module
 * is what closes that.
 */

export type TechnologyRow = {
  id: string;
  key: string;
  name: string;
  hex: string;
  iconSvg: string | null;
  deviconName: string | null;
  deviconVariant: string | null;
  /** Used by projects or experience, so deleting it would orphan something. */
  uses: number;
  groups: string[];
};

export type GroupRow = {
  id: string;
  key: string;
  position: number;
  labels: { locale: string; label: string }[];
  members: { technologyId: string; position: number }[];
};

export type SkillsSummary = {
  technologies: TechnologyRow[];
  groups: GroupRow[];
  /** How many have a real brand icon stored, which is the point of the module. */
  withIcon: number;
};

export async function getSkills(): Promise<SkillsSummary> {
  // One Promise.all: at this distance a dependent query is a whole round trip.
  const [technologies, groups] = await Promise.all([
    db.technology.findMany({
      orderBy: { name: "asc" },
      include: {
        groups: { select: { groupId: true } },
        _count: { select: { projects: true, experience: true } },
      },
    }),
    db.skillGroup.findMany({
      orderBy: { position: "asc" },
      include: {
        translations: { select: { locale: true, label: true } },
        items: { select: { technologyId: true, position: true }, orderBy: { position: "asc" } },
      },
    }),
  ]);

  const rows: TechnologyRow[] = technologies.map((t) => ({
    id: t.id,
    key: t.key,
    name: t.name,
    hex: t.hex,
    iconSvg: t.iconSvg,
    deviconName: t.deviconName,
    deviconVariant: t.deviconVariant,
    uses: t._count.projects + t._count.experience,
    groups: t.groups.map((g) => g.groupId),
  }));

  return {
    technologies: rows,
    groups: groups.map((g) => ({
      id: g.id,
      key: g.key,
      position: g.position,
      labels: g.translations.map((t) => ({ locale: t.locale, label: t.label })),
      members: g.items,
    })),
    withIcon: rows.filter((r) => r.iconSvg !== null).length,
  };
}

/** Stores a picked icon, already prepared by `fetchDeviconSvg`. */
export async function setTechnologyIcon(
  id: string,
  icon: { deviconName: string; deviconVariant: string; svg: string } | null,
): Promise<string> {
  const row = await db.technology.update({
    where: { id },
    data: icon
      ? {
          deviconName: icon.deviconName,
          deviconVariant: icon.deviconVariant,
          iconSvg: icon.svg,
        }
      : { deviconName: null, deviconVariant: null, iconSvg: null },
    select: { name: true },
  });
  return row.name;
}

export async function setTechnologyColor(id: string, hex: string): Promise<string> {
  const row = await db.technology.update({
    where: { id },
    data: { hex },
    select: { name: true },
  });
  return row.name;
}
