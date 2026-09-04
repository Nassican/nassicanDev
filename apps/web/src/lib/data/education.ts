import type { Localized } from "@/lib/i18n/config";

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

export const education: EducationItem[] = [
  {
    period: { es: "2020 - 2026", en: "2020 - 2026" },
    start: "2020",
    end: "2026-09-25",
    status: "completed",
    title: { es: "Ingeniería de Sistemas", en: "Systems Engineering" },
    org: "Universidad de Nariño",
    desc: {
      es: "El programa de Ingeniería de Sistemas asume su compromiso de líder y gestor de desarrollo, integrándose a la solución real de los problemas que la región y el país le planteen, de acuerdo con los retos de la contemporaneidad.",
      en: "The Systems Engineering programme takes on the role of leading and driving development, engaging with the real problems the region and the country face, in line with the challenges of the present day.",
    },
  },
  {
    period: { es: "2023 - 2030", en: "2023 - 2030" },
    start: "2023",
    end: "2030",
    status: "in-progress",
    title: {
      es: "Educación General Básica, Ingeniería de software",
      en: "General Studies, Software Engineering",
    },
    org: "Platzi",
    desc: {
      es: "Plataforma educativa en línea que ofrece cursos en tecnología, diseño, negocios y marketing, con un enfoque en la educación flexible y bajo demanda. Enfoque en ruta de formación continua en desarrollo full‑stack y gestión de proyectos.",
      en: "Online learning platform offering courses in technology, design, business and marketing, built around flexible, on-demand study. Following a continuous learning track in full-stack development and project management.",
    },
    link: "https://platzi.com/p/nassican/",
  },
];
