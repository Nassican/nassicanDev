import type { Localized } from "@/lib/i18n/config";

export type ExperienceItem = {
  /** Human-readable range shown in the UI, per language. */
  period: Localized<string>;
  /** Machine-readable start/end for <time>; omit `end` while ongoing. */
  start: string;
  end?: string;
  title: Localized<string>;
  /** Organisation name, kept as written in both languages. */
  org: string;
  desc: Localized<string>;
  /** Names must match the keys in `skills.ts` so the icons resolve. */
  stack: string[];
};

/**
 * Work history only. The Systems Engineering degree lives in `education.ts`,
 * so it is not repeated here.
 */
export const experience: ExperienceItem[] = [
  {
    period: { es: "ago. 2024 - dic. 2026", en: "Aug 2024 - Dec 2026" },
    start: "2024-08",
    title: { es: "Pasante", en: "Intern" },
    org: "Universidad de Nariño",
    desc: {
      es: "Desarrollo de software como proyecto de grado: frontend con Next.js y backend con NestJS, integrando PostgreSQL.",
      en: "Software development as a degree project: a Next.js frontend and a NestJS backend, integrated with PostgreSQL.",
    },
    stack: ["Next.js", "NestJS", "PostgreSQL", "TypeScript"],
  },
  {
    period: { es: "nov. 2024 - dic. 2024", en: "Nov 2024 - Dec 2024" },
    start: "2024-11",
    end: "2024-12",
    title: { es: "IT Assistant", en: "IT Assistant" },
    org: "CoPres - Gerencia de Obras de Construcción En Línea",
    desc: {
      es: "Desarrollo de módulos para una plataforma unificada de componentes y visualización de gráficos estadísticos con Svelte; soporte técnico y atención de requerimientos.",
      en: "Built modules for a unified component platform and statistical chart views with Svelte; technical support and requirement handling.",
    },
    stack: ["Svelte", "JavaScript", "CSS"],
  },
];
