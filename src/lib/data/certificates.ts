export type Certificate = {
  title: string;
  provider: string;
  category: string;
  date?: string;
  url: string;
};

export const certificates: Certificate[] = [
  {
    title: "Curso de Desarrollo Frontend",
    provider: "Platzi",
    category: "Programación",
    date: "2024",
    url: "https://platzi.com/p/nassican/curso/2467-frontend-developer/diploma/detalle/",
  },
  {
    title: "Curso Profesional de Git y GitHub",
    provider: "Platzi",
    category: "Programación",
    date: "2024",
    url: "https://platzi.com/p/nassican/curso/1557-git-github/diploma/detalle/",
  },
  {
    title: "Curso de Inglés A1 para principiantes",
    provider: "Platzi",
    category: "Idiomas",
    date: "2025",
    url: "https://platzi.com/p/nassican/curso/10629-ingles-a1-principiantes/diploma/detalle/",
  },
];
