export const profile = {
  name: "Jesús David Benavides Chicaiza",
  title: "Estudiante de Ingeniería de Sistemas",
  email: "contacto@nassican.com",
  socials: [
    { label: "GitHub", href: "https://github.com/Nassican" },
    {
      label: "LinkedIn",
      href: "https://www.linkedin.com/in/jesusbenavidesmark/",
    },
  ],
  cvPath: "/cv.pdf",
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

export const experience = [
  {
    period: "ago. 2024 – actualidad",
    title: "Pasante",
    org: "Universidad de Nariño",
    desc: "Desarrollo de software como proyecto de grado: frontend con Next.js y backend con NestJS, integrando PostgreSQL.",
  },
  {
    period: "nov. 2024 – dic. 2024",
    title: "IT Assistant",
    org: "CoPres – Gerencia de Obras de Construcción En Línea",
    desc: "Desarrollo de módulos para una plataforma unificada de componentes y visualización de gráficos estadísticos con Svelte; soporte técnico y atención de requerimientos.",
  },
  {
    period: "2020 - Presente",
    title: "Ingeniería de Sistemas (en curso)",
    org: "Universidad de Nariño",
    desc: "Formación en fundamentos de computación, desarrollo de software y arquitectura.",
  },
];

export const projects = [
  {
    title: "Strategix",
    description: "Aplicación web con enfoque en rendimiento y accesibilidad.",
    stack: ["Next.js", "TypeScript", "Tailwind CSS", "NestJS", "Prisma", "Git", "HTML", "CSS"],
    demo: "https://strategix.nassican.com/login",
    repo: "#",
    image: "/projects/StrategixLogin.png"
  },
  {
    title: "CursoVisor",
    description: "Aplicación de escritorio para visualización de cursos de manera local.",
    stack: ["Node.js", "Express", "React", "Electron", "TypeScript", "Tailwind CSS", "Git", "HTML", "CSS", "JavaScript"],
    demo: "https://github.com/Nassican/AppDesktopCursoVisor/releases/tag/v2.0.0",
    repo: "https://github.com/Nassican/AppDesktopCursoVisor",
    image: "/projects/CursoVisorDesktop.png",
  },
];

export type EducationItem = {
  period: string;
  title: string;
  org: string;
  desc: string;
  link?: string;
};

export const education: EducationItem[] = [
  {
    period: "2020 – Presente",
    title: "Ingeniería de Sistemas",
    org: "Universidad de Nariño",
    desc: "Programa en curso. El programa de Ingeniería de Sistemas asume su compromiso de líder y gestor de desarrollo, integrándose a la solución real de los problemas que la región y el país le planteen, de acuerdo con los retos de la contemporaneidad.",
  },
  {
    period: "2023 – 2030",
    title: "Educación General Básica, Ingeniería de software",
    org: "Platzi",
    desc: "Plataforma educativa en línea que ofrece cursos en tecnología, diseño, negocios y marketing, con un enfoque en la educación flexible y bajo demanda. Enfoque en ruta de formación continua en desarrollo full‑stack y gestión de proyectos.",
    link: "https://platzi.com/p/nassicand/",
  },
];

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
    url: "https://platzi.com/p/nassicand/curso/2467-frontend-developer/diploma/detalle/"
  },
  {
    title: "Curso Profesional de Git y GitHub",
    provider: "Platzi",
    category: "Programación",
    date: "2024",
    url: "https://platzi.com/p/nassicand/curso/1557-git-github/diploma/detalle/"
  },
  {
    title: "Curso de Inglés A1 para principiantes",
    provider: "Platzi",
    category: "Idiomas",
    date: "2025",
    url: "https://platzi.com/p/nassicand/curso/10629-ingles-a1-principiantes/diploma/detalle/"
  },
];
