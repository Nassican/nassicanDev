/**
 * One-way migration of the portfolio content from the TypeScript modules in
 * `apps/web/src/lib/data/` into the database.
 *
 *   npm run content:import           # writes
 *   npm run content:import -- --dry  # reports what it would write
 *
 * Idempotent: every write is an upsert keyed by the value that identifies the
 * thing (a technology's registry key, a project's slug), so running it twice
 * changes nothing. That matters because it is how the import gets verified -
 * run it, compare the rendered site against the snapshot, fix, run again.
 *
 * It imports technologies, skill groups and projects. Profile, experience,
 * education and certificates stay in code until their own panel modules exist:
 * moving content the panel cannot yet edit would only create a second source
 * of truth.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "@nassican/db";
import { prismaJson } from "@nassican/db";
import type { ContentBlock, Locale } from "@nassican/shared";

import {
  skills,
  skillsRegistry,
} from "../apps/web/src/lib/data/skills";
import type { ProjectItem } from "../apps/web/src/lib/data/projects/types";
import { project as strategix } from "../apps/web/src/lib/data/projects/strategix";
import { project as cursovisor } from "../apps/web/src/lib/data/projects/cursovisor";

/**
 * The source folders, imported one by one rather than through the registry:
 * `projects/index.ts` now queries the database, so reading it here would make
 * the import read its own output. These folders stay in the repository as the
 * backup until the migration is confirmed in production.
 */
const projects: ProjectItem[] = [strategix, cursovisor];

const dryRun = process.argv.includes("--dry");

function say(action: string, detail: string) {
  console.log(`${dryRun ? "[simulacro] " : ""}${action.padEnd(22)} ${detail}`);
}

async function importTechnologies(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const [key, config] of Object.entries(skillsRegistry)) {
    say("tecnología", key);

    if (dryRun) {
      // Register the key anyway: validating that every project's stack
      // resolves is the main thing a dry run is for.
      ids.set(key, "dry-run");
      continue;
    }

    const row = await db.technology.upsert({
      where: { key },
      update: {
        name: config.name,
        hex: config.hex,
        textColor: config.text ?? null,
        bgColor: config.bg ?? null,
        borderColor: config.border ?? null,
        glow: config.glow ?? null,
        glowOpacity: config.glowOpacity ?? null,
      },
      create: {
        key,
        name: config.name,
        hex: config.hex,
        textColor: config.text ?? null,
        bgColor: config.bg ?? null,
        borderColor: config.border ?? null,
        glow: config.glow ?? null,
        glowOpacity: config.glowOpacity ?? null,
      },
    });
    ids.set(key, row.id);
  }

  return ids;
}

/** Labels for the Skills section headings, as the dictionaries word them. */
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
          if (!technologyId) {
            console.warn(`  aviso: "${name}" no existe en skillsRegistry`);
            return null;
          }
          return { groupId: group.id, technologyId, position: index };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null),
    });

    position += 1;
  }
}

/** Width and height straight out of the PNG IHDR chunk. */
function pngSize(file: Buffer): { width: number; height: number } | null {
  if (file.length < 24 || file.toString("ascii", 12, 16) !== "IHDR") return null;
  return { width: file.readUInt32BE(16), height: file.readUInt32BE(20) };
}

/**
 * Project screenshots stay where they are, under `apps/web/public/`. What the
 * import adds is the `media` row that points at them, so the cover is a
 * foreign key from day one and Multimedia has something to take over. No alt
 * text is written: the components derive it from the title and the tagline,
 * and inventing one would be worse than the real thing they already render.
 */
async function importMedia(publicPath: string): Promise<string | null> {
  const file = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "apps",
    "web",
    "public",
    publicPath.replace(/^\//, ""),
  );

  if (!existsSync(file)) {
    console.warn(`  aviso: no existe ${publicPath}`);
    return null;
  }

  const bytes = readFileSync(file);
  const size = pngSize(bytes);
  const checksum = createHash("sha256").update(bytes).digest("hex");

  say("multimedia", `${publicPath} (${Math.round(bytes.length / 1024)} KB)`);
  if (dryRun) return null;

  const data = {
    kind: "image" as const,
    storageKey: publicPath,
    url: publicPath,
    mimeType: "image/png",
    sizeBytes: BigInt(bytes.length),
    width: size?.width ?? null,
    height: size?.height ?? null,
  };

  const row = await db.media.upsert({
    where: { checksum },
    update: data,
    create: { ...data, checksum },
  });

  return row.id;
}

async function importProjects(technologyIds: Map<string, string>) {
  let position = 0;

  for (const project of projects) {
    say("proyecto", `${project.slug} (${project.stack.length} tecnologías)`);

    for (const name of project.stack) {
      if (!technologyIds.has(name)) {
        console.warn(`  aviso: stack "${name}" no existe en skillsRegistry`);
      }
    }

    if (dryRun) {
      position += 1;
      continue;
    }

    const coverMediaId = project.image ? await importMedia(project.image) : null;

    const meta = {
      title: project.title,
      yearLabel: project.year,
      date: new Date(project.date),
      status: "published" as const,
      comingSoon: project.comingSoon ?? false,
      featured: project.featured ?? false,
      demoUrl: project.demo || null,
      repoUrl: project.repo ?? null,
      coverMediaId,
      position,
    };

    const row = await db.project.upsert({
      where: { slug: project.slug },
      update: meta,
      create: { slug: project.slug, ...meta },
    });

    for (const locale of ["es", "en"] as const) {
      const t = project.content[locale];
      const data = {
        tagline: t.tagline,
        summary: t.summary ?? null,
        role: t.role ?? null,
        highlights: t.highlights ? prismaJson.strings(t.highlights) : undefined,
        body: t.body ? prismaJson.body(t.body as ContentBlock[]) : undefined,
      };

      await db.projectTranslation.upsert({
        where: { projectId_locale: { projectId: row.id, locale } },
        update: data,
        create: { projectId: row.id, locale, ...data },
      });
    }

    await db.projectTechnology.deleteMany({ where: { projectId: row.id } });
    await db.projectTechnology.createMany({
      data: project.stack
        .map((name, index) => {
          const technologyId = technologyIds.get(name);
          return technologyId
            ? { projectId: row.id, technologyId, position: index }
            : null;
        })
        .filter((r): r is NonNullable<typeof r> => r !== null),
    });

    position += 1;
  }
}

async function main() {
  if (dryRun) console.log("Simulacro: no se escribe nada.\n");

  const technologyIds = await importTechnologies();
  await importSkillGroups(technologyIds);
  await importProjects(technologyIds);

  if (!dryRun) {
    const [technologies, groups, projectCount] = await Promise.all([
      db.technology.count(),
      db.skillGroup.count(),
      db.project.count(),
    ]);
    console.log(
      `\nEn la base: ${technologies} tecnologías · ${groups} grupos · ${projectCount} proyectos`,
    );
  }

  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
