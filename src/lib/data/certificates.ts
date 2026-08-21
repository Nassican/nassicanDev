import type { Localized } from "@/lib/i18n/config";

export type Certificate = {
  title: Localized<string>;
  /** Provider name, kept as written in both languages. */
  provider: string;
  category: Localized<string>;
  date?: string;
  url: string;
};

export const certificates: Certificate[] = [
  {
    title: {
      es: "Curso de Desarrollo Frontend",
      en: "Frontend Development Course",
    },
    provider: "Platzi",
    category: { es: "Programación", en: "Programming" },
    date: "2024",
    url: "https://platzi.com/p/nassican/curso/2467-frontend-developer/diploma/detalle/",
  },
  {
    title: {
      es: "Curso Profesional de Git y GitHub",
      en: "Professional Git and GitHub Course",
    },
    provider: "Platzi",
    category: { es: "Programación", en: "Programming" },
    date: "2024",
    url: "https://platzi.com/p/nassican/curso/1557-git-github/diploma/detalle/",
  },
  {
    title: {
      es: "Curso de Inglés A1 para principiantes",
      en: "English A1 Course for Beginners",
    },
    provider: "Platzi",
    category: { es: "Idiomas", en: "Languages" },
    date: "2025",
    url: "https://platzi.com/p/nassican/curso/10629-ingles-a1-principiantes/diploma/detalle/",
  },
];
