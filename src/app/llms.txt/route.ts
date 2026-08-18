import {
  certificates,
  education,
  experience,
  profile,
  projects,
  skills,
} from "@/lib/data";
import { absoluteUrl, defaultDescription, defaultTitle } from "@/lib/seo";

/**
 * /llms.txt — the llmstxt.org convention: a plain-text brief that AI assistants
 * (ChatGPT, Claude, Perplexity) read to get a clean summary of the site without
 * parsing the rendered HTML. Built from the same data as the pages so it can
 * never drift out of date.
 */
export const dynamic = "force-static";

const list = (lines: string[]) => lines.join("\n");

function build(): string {
  const skillLines = Object.entries(skills).map(
    ([group, names]) =>
      `- ${group[0].toUpperCase()}${group.slice(1)}: ${names.join(", ")}`,
  );

  const experienceLines = experience.map(
    (e) => `- ${e.title} en ${e.org} (${e.period}) - ${e.desc} Stack: ${e.stack.join(", ")}.`,
  );

  const educationLines = education.map(
    (e) =>
      `- ${e.title} - ${e.org} (${e.period}, ${
        e.status === "completed" ? "finalizado" : "en curso"
      })`,
  );

  const projectLines = projects.map(
    (p) =>
      `- [${p.title}](${p.demo}): ${p.description} Stack: ${p.stack.join(", ")}.${
        p.repo ? ` Código: ${p.repo}` : ""
      }`,
  );

  const certificateLines = certificates.map(
    (c) =>
      `- [${c.title}](${c.url}) - ${c.provider}${c.date ? `, ${c.date}` : ""}`,
  );

  const socialLines = profile.socials.map((s) => `- [${s.label}](${s.href})`);

  const cvLines = profile.cv.map(
    (c) => `- [${c.label}](${absoluteUrl(c.href)}) (PDF)`,
  );

  return list([
    `# ${profile.name}`,
    "",
    `> ${defaultDescription}`,
    "",
    `También conocido como Nassican. ${defaultTitle}. Ubicado en Pasto, Nariño, Colombia. Habla español e inglés. Contacto: ${profile.email}.`,
    "",
    "## Páginas",
    "",
    `- [Portafolio](${absoluteUrl("/")}): perfil, experiencia, proyectos y formas de contacto.`,
    `- [Certificados](${absoluteUrl("/certificates")}): listado completo de cursos y certificaciones.`,
    "",
    "## Experiencia",
    "",
    list(experienceLines),
    "",
    "## Formación",
    "",
    list(educationLines),
    "",
    "## Tecnologías",
    "",
    list(skillLines),
    "",
    "## Proyectos",
    "",
    list(projectLines),
    "",
    "## Certificados",
    "",
    list(certificateLines),
    "",
    "## Currículum",
    "",
    list(cvLines),
    "",
    "## Enlaces",
    "",
    list(socialLines),
    "",
  ]);
}

export function GET() {
  return new Response(build(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=86400, stale-while-revalidate",
    },
  });
}
