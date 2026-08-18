export type ProjectItem = {
  title: string;
  description: string;
  /** Names must match the keys in `skills.ts` so the icons resolve. */
  stack: string[];
  demo: string;
  /** Omit when the repository is private. */
  repo?: string;
  /** Path under /public; omit to render the placeholder tile. */
  image?: string;
};

export const projects: ProjectItem[] = [
  {
    title: "Strategix",
    description: "Aplicación web con enfoque en rendimiento y accesibilidad.",
    stack: [
      "Next.js",
      "TypeScript",
      "Tailwind CSS",
      "NestJS",
      "Prisma",
      "Git",
      "HTML",
      "CSS",
    ],
    demo: "https://strategix.nassican.com",
    repo: "https://github.com/Nassican/strategix",
    image: "/projects/StrategixLogin.png",
  },
  {
    title: "CursoVisor",
    description:
      "Aplicación de escritorio para visualización de cursos de manera local.",
    stack: [
      "Node.js",
      "Express",
      "React",
      "Electron",
      "TypeScript",
      "Tailwind CSS",
      "Git",
      "HTML",
      "CSS",
      "JavaScript",
    ],
    demo: "https://github.com/Nassican/AppDesktopCursoVisor/releases/tag/v2.0.0",
    repo: "https://github.com/Nassican/AppDesktopCursoVisor",
    image: "/projects/CursoVisorDesktop.png",
  },
];
