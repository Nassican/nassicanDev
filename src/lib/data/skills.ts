export interface SkillConfig {
  name: string;
  hex: string;
  text?: string;
  bg?: string;
  border?: string;
  glow?: string;
  glowOpacity?: number;
}

export const skillsRegistry: Record<string, SkillConfig> = {
  React: { name: "React", hex: "#61dafb" },
  "Next.js": { name: "Next.js", hex: "#ffffff", text: "currentColor", glowOpacity: 0.15 },
  TypeScript: { name: "TypeScript", hex: "#3178c6" },
  "Tailwind CSS": { name: "Tailwind CSS", hex: "#38bdf8" },
  Redux: { name: "Redux", hex: "#764abc" },
  Vite: { name: "Vite", hex: "#646cff", text: "#ffd700" },
  HTML: { name: "HTML", hex: "#e34f26" },
  CSS: { name: "CSS", hex: "#1572b6" },
  JavaScript: { name: "JavaScript", hex: "#f7df1e" },
  Svelte: { name: "Svelte", hex: "#ff3e00" },
  "Node.js": { name: "Node.js", hex: "#339933" },
  Express: { name: "Express", hex: "#808080", text: "currentColor", glowOpacity: 0.15 },
  Prisma: { name: "Prisma", hex: "#5ac5cb", bg: "#2d3748" },
  Docker: { name: "Docker", hex: "#2496ed" },
  Git: { name: "Git", hex: "#f05032" },
  NestJS: { name: "NestJS", hex: "#e0234e" },
  Python: { name: "Python", hex: "#3776ab", text: "#ffd43b" },
  PostgreSQL: { name: "PostgreSQL", hex: "#4169e1" },
  MySQL: { name: "MySQL", hex: "#4479a1", text: "#e48e24" },
  SQLite: { name: "SQLite", hex: "#003b57", text: "#0f80e4" },
  MongoDB: { name: "MongoDB", hex: "#47a248" },
  Redis: { name: "Redis", hex: "#dc382d" },
  ESLint: { name: "ESLint", hex: "#4b32c3", text: "#8d7aff" },
  Prettier: { name: "Prettier", hex: "#f7b93e" },
  Electron: { name: "Electron", hex: "#47848f", text: "#80daeb" },
};

export const skills = {
  frontend: [
    "React",
    "Next.js",
    "TypeScript",
    "Tailwind CSS",
    "Redux",
    "Vite",
    "HTML",
    "CSS",
    "JavaScript",
    "Svelte",
  ],
  backend: [
    "Node.js",
    "Express",
    "Prisma",
    "Docker",
    "Git",
    "NestJS",
    "Python",
  ],
  tools: ["Git", "ESLint", "Prettier", "Docker"],
  databases: ["PostgreSQL", "MySQL", "SQLite", "MongoDB", "Redis"],
};
