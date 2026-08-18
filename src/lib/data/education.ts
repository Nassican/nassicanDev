export type EducationItem = {
  /** Human-readable range shown in the UI. */
  period: string;
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
  title: string;
  org: string;
  desc: string;
  link?: string;
};

export const education: EducationItem[] = [
  {
    period: "2020 - 2026",
    start: "2020",
    end: "2026-09-25",
    status: "completed",
    title: "Ingeniería de Sistemas",
    org: "Universidad de Nariño",
    desc: "El programa de Ingeniería de Sistemas asume su compromiso de líder y gestor de desarrollo, integrándose a la solución real de los problemas que la región y el país le planteen, de acuerdo con los retos de la contemporaneidad.",
  },
  {
    period: "2023 - 2030",
    start: "2023",
    end: "2030",
    status: "in-progress",
    title: "Educación General Básica, Ingeniería de software",
    org: "Platzi",
    desc: "Plataforma educativa en línea que ofrece cursos en tecnología, diseño, negocios y marketing, con un enfoque en la educación flexible y bajo demanda. Enfoque en ruta de formación continua en desarrollo full‑stack y gestión de proyectos.",
    link: "https://platzi.com/p/nassican/",
  },
];
