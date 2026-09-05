/**
 * Imports the technology registry from `apps/web/src/lib/data/skills.ts` into
 * the database.
 *
 *   npm run content:import           # writes
 *   npm run content:import -- --dry  # reports what it would write
 *
 * Idempotent: every write is an upsert keyed by the technology's registry key,
 * so running it twice changes nothing.
 *
 * Projects and articles are no longer here - they live in the database and are
 * edited in the panel. `skills.ts` is the last content module the public site
 * still reads directly, for the Skills section; this script keeps the
 * `technologies` table in step with it so projects can reference technologies
 * by foreign key. Both halves go away together when the Skills module exists.
 */
import { db } from "@nassican/db";
import type { Locale } from "@nassican/shared";
import { skills, skillsRegistry } from "../apps/web/src/lib/data/skills";

const dryRun = process.argv.includes("--dry");

function say(action: string, detail: string) {
  console.log(`${dryRun ? "[simulacro] " : ""}${action.padEnd(22)} ${detail}`);
}

async function importTechnologies(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const [key, config] of Object.entries(skillsRegistry)) {
    say("tecnología", key);

    if (dryRun) {
      // Register the key anyway: validating that every group's members resolve
      // is the main thing a dry run is for.
      ids.set(key, "dry-run");
      continue;
    }

    const fields = {
      name: config.name,
      hex: config.hex,
      textColor: config.text ?? null,
      bgColor: config.bg ?? null,
      borderColor: config.border ?? null,
      glow: config.glow ?? null,
      glowOpacity: config.glowOpacity ?? null,
    };

    const row = await db.technology.upsert({
      where: { key },
      update: fields,
      create: { key, ...fields },
    });
    ids.set(key, row.id);
  }

  return ids;
}

/** Headings for the Skills section, worded as the dictionaries word them. */
const groupLabels: Record<string, Record<Locale, string>> = {
  frontend: { es: "Frontend", en: "Frontend" },
  backend: { es: "Backend", en: "Backend" },
  tools: { es: "Herramientas", en: "Tools" },
  databases: { es: "Bases de datos", en: "Databases" },
};

async function importSkillGroups(technologyIds: Map<string, string>) {
  let position = 0;

  for (const [key, members] of Object.entries(skills)) {
    say("grupo de skills", `${key} (${members.length})`);

    for (const name of members) {
      if (!technologyIds.has(name)) {
        console.warn(`  aviso: "${name}" no existe en skillsRegistry`);
      }
    }

    if (dryRun) {
      position += 1;
      continue;
    }

    const group = await db.skillGroup.upsert({
      where: { key },
      update: { position },
      create: { key, position },
    });

    for (const locale of ["es", "en"] as const) {
      const label = groupLabels[key]?.[locale] ?? key;
      await db.skillGroupTranslation.upsert({
        where: { groupId_locale: { groupId: group.id, locale } },
        update: { label },
        create: { groupId: group.id, locale, label },
      });
    }

    await db.skillGroupItem.deleteMany({ where: { groupId: group.id } });
    await db.skillGroupItem.createMany({
      data: members
        .map((name, index) => {
          const technologyId = technologyIds.get(name);
          return technologyId
            ? { groupId: group.id, technologyId, position: index }
            : null;
        })
        .filter((row): row is NonNullable<typeof row> => row !== null),
    });

    position += 1;
  }
}

async function main() {
  if (dryRun) console.log("Simulacro: no se escribe nada.\n");

  const technologyIds = await importTechnologies();
  await importSkillGroups(technologyIds);

  if (!dryRun) {
    const [technologies, groups] = await Promise.all([
      db.technology.count(),
      db.skillGroup.count(),
    ]);
    console.log(`\nEn la base: ${technologies} tecnologías · ${groups} grupos`);
  }

  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
