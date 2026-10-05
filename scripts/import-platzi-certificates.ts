/**
 * Imports the Platzi diplomas exported from the account's «Mis cursos» API.
 *
 *   npm run certificates:platzi -- <carpeta> --dry   informa sin escribir
 *   npm run certificates:platzi -- <carpeta>         escribe
 *
 * The folder holds the paginated JSON exactly as Platzi returns it
 * (`data.courses[]`). The date and the diploma URL come from there; the titles
 * do not, quite:
 *
 * - **Spanish** is Platzi's own title, cleaned of what is about Platzi's catalogue
 *   and not about the course: version years — «(2021)», «- (2022)», a stray
 *   «(2020=» — the word «Gratis», and doubled spaces.
 * - **English** is written here by hand, one line per course, and so is the
 *   category. A translation the build cannot check is a translation someone has
 *   to have written, and this file is where that is reviewable.
 *
 * Idempotent by **course id**, read from the credential URL: a diploma already in
 * the profile is the same course whatever its URL slug says, and its curated
 * title and category are kept. Only its date label is corrected to the official
 * approval year, which is what the export is the source of truth for.
 */
import fs from "node:fs";
import path from "node:path";
import { db } from "@nassican/db";
import { cacheTags } from "@nassican/shared";
import { revalidatePublicSite } from "../apps/admin/src/lib/revalidate";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const folder = args.find((a) => !a.startsWith("--"));

type Course = {
  id: number;
  title: string;
  progress: number;
  diploma?: { diploma_url?: string; approved_date?: string } | null;
};

type Category = "programming" | "languages" | "computing" | "mathematics" | "business";

const categories: Record<Category, { es: string; en: string }> = {
  // The two the profile already used, spelled the same so the site's filter
  // keeps one entry for each.
  programming: { es: "Programación", en: "Programming" },
  languages: { es: "Idiomas", en: "Languages" },
  computing: { es: "Informática", en: "Computing" },
  mathematics: { es: "Matemáticas", en: "Mathematics" },
  business: { es: "Negocios", en: "Business" },
};

/** Course id → English title and category. Every course in the export must be here. */
const catalogue: Record<number, { en: string; category: Category }> = {
  12654: { en: "Building Web Pages with v0", category: "programming" },
  11944: { en: "Basic English A1: The Verb To Be", category: "languages" },
  10629: { en: "English A1 Course for Beginners", category: "languages" },
  1758: { en: "Practical HTML and CSS Course", category: "programming" },
  2921: { en: "Basic English Vocabulary and Expressions", category: "languages" },
  2395: { en: "Basic English A1: Dates, Times and Simple Expressions", category: "languages" },
  3230: { en: "Practical English: Family Members", category: "languages" },
  2393: { en: "Basic English A1: Present Simple and Everyday Vocabulary", category: "languages" },
  3996: { en: "Practical English: Things at Work", category: "languages" },
  2005: { en: "Practical English: Describing People", category: "languages" },
  3093: { en: "Basic English for Beginners", category: "languages" },
  3639: { en: "Introduction to Excel for Beginners: Spreadsheet Basics and Formatting", category: "computing" },
  2477: { en: "Practical Frontend Developer Course", category: "programming" },
  2612: { en: "Basic Differential Calculus", category: "mathematics" },
  4261: { en: "Python: PIP and Virtual Environments", category: "programming" },
  4260: { en: "Python: Comprehensions, Functions and Error Handling", category: "programming" },
  2188: { en: "Introduction to Building Programming Languages", category: "programming" },
  1301: { en: "Regular Expressions Course", category: "programming" },
  4227: { en: "Python Fundamentals", category: "programming" },
  2467: { en: "Frontend Development Course", category: "programming" },
  2292: { en: "Introduction to the Terminal and the Command Line", category: "programming" },
  1557: { en: "Professional Git and GitHub Course", category: "programming" },
  6900: { en: "Setting Up a Development Environment on Windows", category: "programming" },
  3208: { en: "Basic Programming Course", category: "programming" },
  2329: { en: "History of Innovation and Entrepreneurship with Diana Uribe", category: "business" },
  2211: { en: "History of Programming: Languages and Paradigms", category: "programming" },
  1098: { en: "Software Engineering Fundamentals", category: "programming" },
  1957: { en: "Control Flow in C", category: "programming" },
  1936: { en: "Introduction to C", category: "programming" },
  2053: { en: "Introduction to the Web: How the Internet Works and Its History", category: "programming" },
  2383: { en: "Setting Up a Development Environment on Linux", category: "programming" },
  2214: { en: "Setting Up a Development Environment on macOS", category: "programming" },
  3222: { en: "Logical Thinking: Data Handling, Structures and Functions", category: "programming" },
  3223: { en: "Logical Thinking: Programming Languages", category: "programming" },
  3221: { en: "Logical Thinking: Algorithms and Flowcharts", category: "programming" },
  2042: { en: "Prework: Setting Up a Development Environment on Windows", category: "programming" },
  2793: { en: "Computer Basics Course", category: "computing" },
};

/** Platzi's title, minus what describes the catalogue rather than the course. */
function cleanTitle(title: string): string {
  return title
    .replace(/\s*-?\s*\(\d{4}[)=]\s*$/, "") // «(2021)», «- (2022)», «(2020=»
    .replace(/\s+\d{4}$/, "") // «Programación Básica 2022»
    .replace(/\bGratis\s+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const courseIdOf = (url: string) => Number(/\/curso\/(\d+)-/.exec(url)?.[1] ?? NaN);

async function main() {
  if (!folder) throw new Error("Falta la carpeta: npm run certificates:platzi -- <carpeta>");

  const courses: Course[] = fs
    .readdirSync(folder)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .flatMap((f) => (JSON.parse(fs.readFileSync(path.join(folder, f), "utf8")) as { data: { courses: Course[] } }).data.courses);

  const finished = courses.filter((c) => c.progress === 100 && c.diploma?.diploma_url && c.diploma.approved_date);
  const unmapped = finished.filter((c) => !catalogue[c.id]);
  if (unmapped.length > 0) {
    throw new Error(`Cursos sin traducción en el catálogo: ${unmapped.map((c) => `${c.id} ${c.title}`).join("; ")}`);
  }

  const existing = await db.certificate.findMany({ select: { id: true, credentialUrl: true, dateLabel: true } });
  const byCourse = new Map(existing.map((e) => [courseIdOf(e.credentialUrl), e]));

  // Newest first, which is the order the profile lists them in.
  finished.sort((a, b) => b.diploma!.approved_date!.localeCompare(a.diploma!.approved_date!));

  let created = 0;
  let corrected = 0;
  console.log(`\n${finished.length} diplomas en la exportación, ${existing.length} certificados en el perfil.\n`);

  for (const [position, course] of finished.entries()) {
    const year = course.diploma!.approved_date!.slice(0, 4);
    const known = byCourse.get(course.id);
    const { en, category } = catalogue[course.id];
    const es = cleanTitle(course.title);

    if (known) {
      const fix = known.dateLabel !== year;
      console.log(`  = ${es}${fix ? `  (fecha ${known.dateLabel} → ${year})` : ""}`);
      if (fix) corrected++;
      if (!dry) {
        await db.certificate.update({ where: { id: known.id }, data: { position, dateLabel: year } });
      }
      continue;
    }

    created++;
    console.log(`  + ${year}  ${es}\n           ${en} · ${categories[category].es}`);
    if (!dry) {
      await db.certificate.create({
        data: {
          provider: "Platzi",
          dateLabel: year,
          credentialUrl: course.diploma!.diploma_url!,
          position,
          translations: {
            create: [
              { locale: "es", title: es, category: categories[category].es },
              { locale: "en", title: en, category: categories[category].en },
            ],
          },
        },
      });
    }
  }

  console.log(`\n${dry ? "--dry: nada escrito. " : ""}${created} nuevos, ${corrected} fechas corregidas, ${finished.length - created} ya estaban.`);

  if (!dry) {
    const result = await revalidatePublicSite([cacheTags.certificates]);
    console.log(result.ok ? "El sitio público ya lo sabe." : `No se pudo avisar al sitio: ${result.reason}`);
  }
  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
