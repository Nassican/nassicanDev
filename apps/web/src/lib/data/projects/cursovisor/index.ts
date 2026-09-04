import type { ProjectItem } from "../types";
import { es } from "./es";
import { en } from "./en";

export const project: ProjectItem = {
  slug: "cursovisor",
  title: "CursoVisor",
  year: "2024",
  date: "2024-06-01",
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
  featured: true,
  content: { es, en },
};
