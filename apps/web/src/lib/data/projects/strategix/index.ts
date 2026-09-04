import type { ProjectItem } from "../types";
import { es } from "./es";
import { en } from "./en";

export const project: ProjectItem = {
  slug: "strategix",
  title: "Strategix",
  year: "2025",
  date: "2025-01-01",
  stack: [
    "Next.js",
    "TypeScript",
    "Tailwind CSS",
    "NestJS",
    "Prisma",
    "PostgreSQL",
    "Git",
    "HTML",
    "CSS",
  ],
  demo: "https://strategix.nassican.com",
  repo: "https://github.com/Nassican/strategix",
  image: "/projects/StrategixLogin.png",
  featured: true,
  comingSoon: true,
  content: { es, en },
};
