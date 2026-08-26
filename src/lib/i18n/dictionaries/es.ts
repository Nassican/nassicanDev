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
      "Portafolio de Jesús David Benavides Chicaiza (Nassican), desarrollador web full stack, Colombia. Proyectos con Next.js, React, TypeScript, NestJS y PostgreSQL.",
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
    badge: "Desarrollador web full stack",
    description:
      "Soy ingeniero de sistemas, Colombia. Desarrollo aplicaciones con Next.js, React, TypeScript, NestJS y PostgreSQL.",
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
      "Desarrollo interfaces con React, Next.js y TypeScript. Organizo el trabajo en componentes reutilizables y cuido la navegación por teclado, la legibilidad, los estados de carga y el rendimiento.",
    backend:
      "Construyo APIs con NestJS y TypeScript, y trabajo con PostgreSQL y Prisma para modelar y consultar datos. Mantengo contratos claros entre frontend y backend, validación de entradas y una estructura fácil de mantener.",
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
      "Si quieres hablar sobre un proyecto o una oportunidad laboral, puedes escribirme por correo o LinkedIn.",
    email: "Correo",
    resumeTitle: "Currículum",
    resumeSubtitle: "Disponible en dos idiomas.",
    download: "Descargar",
  },

  footer: {
    tagline:
      "Desarrollo aplicaciones web y documento cómo las construyo.",
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
