import type { ComponentType } from "react";
import { 
  SiReact,
  SiNextdotjs,
  SiTypescript,
  SiTailwindcss,
  SiNodedotjs,
  SiExpress,
  SiGraphql,
  SiPrisma,
  SiDocker,
  SiGit,
  SiRedux,
  SiVite,
  SiPostgresql,
  SiMysql,
  SiSqlite,
  SiMongodb,
  SiRedis,
  SiHtml5,
  SiCss3,
  SiJavascript,
  SiCodepen,
  SiNestjs,
  SiPython,
  SiPrettier,
  SiEslint,
  SiSvelte,
  SiElectron
} from "react-icons/si";

const iconMap: Record<string, ComponentType<{ className?: string }>> = {
  React: SiReact,
  "Next.js": SiNextdotjs,
  TypeScript: SiTypescript,
  "Tailwind CSS": SiTailwindcss,
  "Node.js": SiNodedotjs,
  Express: SiExpress,
  GraphQL: SiGraphql,
  Prisma: SiPrisma,
  Docker: SiDocker,
  Git: SiGit,
  Redux: SiRedux,
  Vite: SiVite,
  PostgreSQL: SiPostgresql,
  MySQL: SiMysql,
  SQLite: SiSqlite,
  MongoDB: SiMongodb,
  Redis: SiRedis,
  HTML: SiHtml5,
  CSS: SiCss3,
  JavaScript: SiJavascript,
  Svelte: SiSvelte,
  NestJS: SiNestjs,
  Python: SiPython,
  Prettier: SiPrettier,
  ESLint: SiEslint,
  Electron: SiElectron,
} as const;

type IconName = keyof typeof iconMap | string;

export default function SkillIcon({ name, className = "w-6 h-6" }: { name: IconName; className?: string }) {
  const Comp = iconMap[name as string];
  if (Comp) return <Comp className={className} />;
  return <SiCodepen className={className} />;
}
