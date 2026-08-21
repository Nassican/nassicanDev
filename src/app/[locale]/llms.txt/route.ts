import {
  certificates,
  education,
  experience,
  profile,
  projectsByDate,
  publishedPosts,
  skills,
} from "@/lib/data";
import { absoluteUrl, localeUrl } from "@/lib/seo";
import { getDictionary } from "@/lib/i18n";
import {
  defaultLocale,
  isLocale,
  locales,
  localeNames,
  type Locale,
} from "@/lib/i18n/config";

/**
 * /llms.txt — the llmstxt.org convention: a plain-text brief that AI assistants
 * (ChatGPT, Claude, Perplexity) read to get a clean summary of the site without
 * parsing the rendered HTML. Built from the same data as the pages so it can
 * never drift out of date, and emitted once per language.
 */
export const dynamic = "force-static";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

const list = (lines: string[]) => lines.join("\n");

/** Section headings, kept next to the builder rather than in the UI dictionary. */
const copy: Record<Locale, Record<string, string>> = {
  es: {
    alsoKnown: "También conocido como Nassican",
    locatedIn: "Ubicado en",
    speaks: "Habla español e inglés",
    contact: "Contacto",
    pages: "Páginas",
    portfolio: "Portafolio",
    portfolioDesc: "perfil, experiencia, proyectos y formas de contacto.",
    projects: "Proyectos",
    projectsDesc: "casos de estudio de cada proyecto.",
    blog: "Blog",
    blogDesc: "artículos técnicos sobre desarrollo web.",
    certificates: "Certificados",
    certificatesDesc: "listado completo de cursos y certificaciones.",
    experience: "Experiencia",
    at: "en",
    stack: "Stack",
    code: "Código",
    education: "Formación",
    completed: "finalizado",
    ongoing: "en curso",
    skills: "Tecnologías",
    articles: "Artículos",
    resume: "Currículum",
    links: "Enlaces",
    otherLanguages: "Otros idiomas",
  },
  en: {
    alsoKnown: "Also known as Nassican",
    locatedIn: "Based in",
    speaks: "Speaks Spanish and English",
    contact: "Contact",
    pages: "Pages",
    portfolio: "Portfolio",
    portfolioDesc: "profile, experience, projects and contact details.",
    projects: "Projects",
    projectsDesc: "case studies for every project.",
    blog: "Blog",
    blogDesc: "technical articles about web development.",
    certificates: "Certificates",
    certificatesDesc: "full list of courses and certifications.",
    experience: "Experience",
    at: "at",
    stack: "Stack",
    code: "Source",
    education: "Education",
    completed: "completed",
    ongoing: "in progress",
    skills: "Tech stack",
    articles: "Articles",
    resume: "Resume",
    links: "Links",
    otherLanguages: "Other languages",
  },
};

function build(locale: Locale): string {
  const t = getDictionary(locale);
  const c = copy[locale];
  const url = (path: string) => localeUrl(locale, path);

  const skillLines = Object.entries(skills).map(
    ([group, names]) =>
      `- ${group[0].toUpperCase()}${group.slice(1)}: ${names.join(", ")}`,
  );

  const experienceLines = experience.map(
    (e) =>
      `- ${e.title[locale]} ${c.at} ${e.org} (${e.period[locale]}) - ${e.desc[locale]} ${c.stack}: ${e.stack.join(", ")}.`,
  );

  const educationLines = education.map(
    (e) =>
      `- ${e.title[locale]} - ${e.org} (${e.period[locale]}, ${
        e.status === "completed" ? c.completed : c.ongoing
      })`,
  );

  const projectLines = projectsByDate.map((p) => {
    const pc = p.content[locale];
    return `- [${p.title}](${url(`/projects/${p.slug}`)}): ${pc.tagline} ${c.stack}: ${p.stack.join(", ")}.${
      p.repo ? ` ${c.code}: ${p.repo}` : ""
    }`;
  });

  const postLines = publishedPosts.map((p) => {
    const pc = p.content[locale];
    return `- [${pc.title}](${url(`/blog/${p.slug}`)}) (${p.date}): ${pc.description}`;
  });

  const certificateLines = certificates.map(
    (cert) =>
      `- [${cert.title[locale]}](${cert.url}) - ${cert.provider}${
        cert.date ? `, ${cert.date}` : ""
      }`,
  );

  const socialLines = profile.socials.map((s) => `- [${s.label}](${s.href})`);

  const cvLines = profile.cv.map(
    (file) => `- [${file.label[locale]}](${absoluteUrl(file.href)}) (PDF)`,
  );

  const otherLanguageLines = locales
    .filter((l) => l !== locale)
    .map(
      (l) =>
        `- [${localeNames[l]}](${localeUrl(l, "/")}) - llms.txt: ${localeUrl(l, "/llms.txt")}`,
    );

  return list([
    `# ${profile.name}`,
    "",
    `> ${t.meta.description}`,
    "",
    `${c.alsoKnown}. ${t.meta.title}. ${c.locatedIn} ${profile.location.city}, ${profile.location.region}, Colombia. ${c.speaks}. ${c.contact}: ${profile.email}.`,
    "",
    `## ${c.pages}`,
    "",
    `- [${c.portfolio}](${url("/")}): ${c.portfolioDesc}`,
    `- [${c.projects}](${url("/projects")}): ${c.projectsDesc}`,
    `- [${c.blog}](${url("/blog")}): ${c.blogDesc}`,
    `- [${c.certificates}](${url("/certificates")}): ${c.certificatesDesc}`,
    "",
    `## ${c.experience}`,
    "",
    list(experienceLines),
    "",
    `## ${c.education}`,
    "",
    list(educationLines),
    "",
    `## ${c.skills}`,
    "",
    list(skillLines),
    "",
    `## ${c.projects}`,
    "",
    list(projectLines),
    "",
    `## ${c.articles}`,
    "",
    postLines.length ? list(postLines) : `- ${t.blog.empty}`,
    "",
    `## ${c.certificates}`,
    "",
    list(certificateLines),
    "",
    `## ${c.resume}`,
    "",
    list(cvLines),
    "",
    `## ${c.links}`,
    "",
    list(socialLines),
    "",
    `## ${c.otherLanguages}`,
    "",
    list(otherLanguageLines),
    "",
  ]);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  const body = build(isLocale(locale) ? locale : defaultLocale);

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=86400, stale-while-revalidate",
    },
  });
}
