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
  iconMono: boolean;
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
    iconMono: t.iconMode === "mono",
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

/**
 * A new technology.
 *
 * The key is what projects and experience reference by foreign key, and what the
 * icon's symbol id is built from, so it has to be unique and stable — the module
 * refuses a duplicate rather than silently merging two things with one name.
 */
export async function createTechnology(input: {
  key: string;
  name: string;
  hex: string;
}): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  const existing = await db.technology.findUnique({ where: { key: input.key } });
  if (existing) return { ok: false, reason: `Ya existe «${input.key}».` };

  const row = await db.technology.create({
    data: { key: input.key, name: input.name, hex: input.hex },
  });
  return { ok: true, id: row.id };
}

/**
 * Deleting is refused while anything points at it.
 *
 * Same rule as `deleteMedia`, and for the same reason: a project's stack is a
 * foreign key, so removing the row underneath it would either fail loudly at the
 * database or quietly empty a chip. Saying how many is what makes the refusal
 * actionable.
 */
export async function removeTechnology(
  id: string,
): Promise<{ ok: true; name: string } | { ok: false; reason: string }> {
  const row = await db.technology.findUnique({
    where: { id },
    select: { name: true, _count: { select: { projects: true, experience: true } } },
  });
  if (!row) return { ok: false, reason: "Ya no existe." };

  const uses = row._count.projects + row._count.experience;
  if (uses > 0) {
    return {
      ok: false,
      reason: `«${row.name}» se usa en ${uses} ${uses === 1 ? "sitio" : "sitios"}. Quítalo de ahí primero.`,
    };
  }

  await db.technology.delete({ where: { id } });
  return { ok: true, name: row.name };
}

export async function setIconMode(id: string, mode: "color" | "mono"): Promise<string> {
  const row = await db.technology.update({
    where: { id },
    data: { iconMode: mode },
    select: { name: true },
  });
  return row.name;
}

/** Puts a technology in a group, or takes it out. */
export async function setGroupMembership(
  technologyId: string,
  groupId: string,
  member: boolean,
): Promise<void> {
  if (!member) {
    await db.skillGroupItem.deleteMany({ where: { technologyId, groupId } });
    return;
  }

  // Appended at the end: a new member has no opinion about where it goes, and
  // guessing would reshuffle an order somebody set on purpose.
  const last = await db.skillGroupItem.findFirst({
    where: { groupId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await db.skillGroupItem.upsert({
    where: { groupId_technologyId: { groupId, technologyId } },
    create: { groupId, technologyId, position: (last?.position ?? -1) + 1 },
    update: {},
  });
}
