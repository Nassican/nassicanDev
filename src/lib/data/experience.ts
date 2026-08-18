export type ExperienceItem = {
  /** Human-readable range shown in the UI. */
  period: string;
  /** Machine-readable start/end for <time>; omit `end` while ongoing. */
  start: string;
  end?: string;
  title: string;
  org: string;
  desc: string;
  /** Names must match the keys in `skills.ts` so the icons resolve. */
  stack: string[];
};

/**
 * Work history only. The Systems Engineering degree lives in `education.ts`,
 * so it is not repeated here.
 */
export const experience: ExperienceItem[] = [
  {
    period: "ago. 2024 - dic. 2026",
    start: "2024-08",
    title: "Pasante",
    org: "Universidad de Nariño",
    desc: "Desarrollo de software como proyecto de grado: frontend con Next.js y backend con NestJS, integrando PostgreSQL.",
    stack: ["Next.js", "NestJS", "PostgreSQL", "TypeScript"],
  },
  {
    period: "nov. 2024 - dic. 2024",
    start: "2024-11",
    end: "2024-12",
    title: "IT Assistant",
    org: "CoPres - Gerencia de Obras de Construcción En Línea",
    desc: "Desarrollo de módulos para una plataforma unificada de componentes y visualización de gráficos estadísticos con Svelte; soporte técnico y atención de requerimientos.",
    stack: ["Svelte", "JavaScript", "CSS"],
  },
];
