/**
 * Spanish dictionary. This file is the source of truth for the `Dictionary`
 * type: every key added here becomes required in `en.ts`, so a missing
 * translation is a build error rather than a string that silently ships in
 * the wrong language.
 */
export const es = {
  meta: {
    title: "Jesús David Benavides Chicaiza | Desarrollador Web Full Stack",
    description:
      "Portafolio de Jesús David Benavides Chicaiza (Nassican), desarrollador web full stack en Pasto, Colombia. Proyectos con Next.js, React, TypeScript, NestJS y PostgreSQL.",
    jobTitle: "Desarrollador Web Full Stack",
    keywords: [
      "Jesús David Benavides Chicaiza",
      "Nassican",
      "desarrollador web",
      "desarrollador full stack",
      "programador Colombia",
      "desarrollador Pasto",
      "Next.js",
      "React",
      "TypeScript",
      "NestJS",
      "PostgreSQL",
      "ingeniería de sistemas",
      "portafolio desarrollador",
    ],
  },

  nav: {
    portfolio: "Portafolio",
    navigation: "Navegación",
    openMenu: "Abrir menú",
    closeMenu: "Cerrar menú",
    about: "Sobre mí",
    skills: "Tecnologías",
    experience: "Experiencia",
    projects: "Proyectos",
    blog: "Blog",
    contact: "Contacto",
    previousSection: "Sección anterior",
    nextSection: "Siguiente sección",
  },

  theme: {
    toDark: "Activar modo oscuro",
    toLight: "Activar modo claro",
    dark: "Modo oscuro",
    light: "Modo claro",
  },

  language: {
    label: "Idioma",
    switchTo: "Ver esta página en",
  },

  hero: {
    badge: "Desarrollador",
    description:
      "Desarrollador web full stack e ingeniero de sistemas en Pasto, Colombia. Construyo aplicaciones con Next.js, React, TypeScript, NestJS y PostgreSQL.",
    viewProjects: "Ver Proyectos",
    contact: "Contactar",
    scroll: "Desplázate",
    scrollAria: "Desplazarse a Sobre mí",
  },

  about: {
    title: "Sobre mí",
    frontendLabel: "Frontend",
    backendLabel: "Backend",
    frontend:
      "Jesús David Benavides Chicaiza, estudiante de Ingeniería de Sistemas. Me enfoco en crear interfaces limpias, accesibles y de alto rendimiento. Trabajo con React y Next.js para construir experiencias rápidas y escalables, usando componentes reutilizables y un diseño monocromático que comunica modernidad y confianza. Cuido el detalle en UX/UI, estados de carga y transiciones CSS sutiles.",
    backend:
      "Diseño APIs robustas y mantenibles, con tipado estricto y validación consistente. Integro bases de datos y servicios externos cuidando la arquitectura, observabilidad y seguridad. Busco un backend predecible y escalable que sirva datos de forma eficiente para apps full‑stack, con foco en claridad, testing y despliegues confiables.",
  },

  skills: {
    title: "Tecnologías",
    marquee: "Carrusel",
    grid: "Cuadrícula",
    groups: {
      frontend: "Desarrollo Frontend",
      backend: "Desarrollo Backend",
      databases: "Bases de Datos",
      tools: "Herramientas y DevOps",
    },
  },

  experience: {
    title: "Experiencia",
    current: "Actual",
  },

  education: {
    title: "Educación",
    viewCertificates: "Ver certificados",
    completed: "Culminada",
    inProgress: "En curso",
    viewProfileAt: "Ver perfil en",
  },

  projects: {
    title: "Proyectos",
    demo: "Demo",
    code: "Código",
    private: "Privado",
    viewAll: "Ver todos los proyectos",
    caseStudy: "Ver caso de estudio",
    listTitle: "Proyectos",
    listDescription:
      "Casos de estudio de las aplicaciones que he construido: el problema, las decisiones técnicas y el resultado.",
    metaDescription:
      "Proyectos y casos de estudio de Jesús David Benavides Chicaiza: aplicaciones web y de escritorio construidas con Next.js, NestJS, React y TypeScript.",
    back: "Volver a proyectos",
    role: "Rol",
    year: "Año",
    stack: "Stack",
    highlights: "Lo más relevante",
    liveSite: "Sitio en vivo",
    sourceCode: "Código fuente",
    empty: "Todavía no hay proyectos publicados.",
    comingSoon: "Próximamente",
    comingSoonBody:
      "Estoy escribiendo el caso de estudio de este proyecto. Mientras tanto puedes visitar el sitio o revisar el código.",
  },

  blog: {
    title: "Blog",
    listDescription:
      "Notas técnicas sobre desarrollo web: Next.js, TypeScript, arquitectura de frontend y backend.",
    metaDescription:
      "Artículos de Jesús David Benavides Chicaiza sobre desarrollo web full stack: Next.js, React, TypeScript, NestJS y buenas prácticas.",
    back: "Volver al blog",
    readMore: "Leer artículo",
    readingTime: "min de lectura",
    published: "Publicado",
    updated: "Actualizado",
    empty: "Todavía no hay artículos publicados.",
    comingSoon: "Próximamente",
    comingSoonBody:
      "Estoy preparando los primeros artículos sobre desarrollo web, Next.js y TypeScript. Vuelve pronto.",
    latest: "Últimos artículos",
    viewAll: "Ver todos los artículos",
    tableOfContents: "Contenido",
  },

  certificates: {
    title: "Certificados y cursos",
    metaDescription:
      "Certificados y cursos completados por Jesús David Benavides Chicaiza en desarrollo web, Git, frontend e idiomas. Filtra por proveedor y categoría.",
    backToEducation: "Volver a Educación",
    searchPlaceholder: "Buscar por título, proveedor...",
    allProviders: "Todos los proveedores",
    allCategories: "Todas las categorías",
    clear: "Limpiar",
    resultOne: "resultado",
    resultMany: "resultados",
    noResults: "No hay certificados que coincidan.",
    view: "Ver",
  },

  contact: {
    title: "Contacto",
    intro:
      "¿Tienes un proyecto web, una vacante o una idea que quieras construir? Escríbeme y te respondo lo antes posible.",
    email: "Correo",
    resumeTitle: "Currículum",
    resumeSubtitle: "Disponible en dos idiomas.",
    download: "Descargar",
  },

  footer: {
    tagline:
      "Construyendo experiencias web con un enfoque en diseño monocromático, rendimiento y accesibilidad.",
    content: "Contenido",
    background: "Trayectoria",
    more: "Más",
    education: "Educación",
    certificates: "Certificados",
    cvEs: "CV (español)",
    cvEn: "CV (English)",
    rights: "Todos los derechos reservados.",
  },

  notFound: {
    title: "Página no encontrada",
    description: "La página que buscas no existe o cambió de dirección.",
    back: "Volver al inicio",
  },

  breadcrumb: {
    home: "Inicio",
  },
};

/** Shape every other dictionary must satisfy. */
export type Dictionary = typeof es;
