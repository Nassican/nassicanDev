import type { Dictionary } from "./es";

/**
 * English dictionary. Typed as `Dictionary`, so removing or renaming a key in
 * `es.ts` without doing the same here fails the build.
 */
export const en: Dictionary = {
  meta: {
    title: "Jesús David Benavides Chicaiza | Full Stack Web Developer",
    description:
      "Portfolio of Jesús David Benavides Chicaiza (Nassican), full stack web developer based in Pasto, Colombia. Projects built with Next.js, React, TypeScript, NestJS and PostgreSQL.",
    jobTitle: "Full Stack Web Developer",
    keywords: [
      "Jesús David Benavides Chicaiza",
      "Nassican",
      "web developer",
      "full stack developer",
      "developer Colombia",
      "remote developer",
      "Next.js",
      "React",
      "TypeScript",
      "NestJS",
      "PostgreSQL",
      "systems engineering",
      "developer portfolio",
    ],
  },

  nav: {
    portfolio: "Portfolio",
    navigation: "Navigation",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    about: "About",
    skills: "Tech stack",
    experience: "Experience",
    projects: "Projects",
    blog: "Blog",
    contact: "Contact",
    previousSection: "Previous section",
    nextSection: "Next section",
  },

  theme: {
    toDark: "Switch to dark mode",
    toLight: "Switch to light mode",
    dark: "Dark mode",
    light: "Light mode",
  },

  language: {
    label: "Language",
    switchTo: "View this page in",
  },

  hero: {
    badge: "Developer",
    description:
      "Full stack web developer and systems engineer based in Pasto, Colombia. I build applications with Next.js, React, TypeScript, NestJS and PostgreSQL.",
    viewProjects: "View Projects",
    contact: "Get in touch",
    scroll: "Scroll",
    scrollAria: "Scroll to About",
  },

  about: {
    title: "About me",
    frontendLabel: "Frontend",
    backendLabel: "Backend",
    frontend:
      "Jesús David Benavides Chicaiza, systems engineering student. I focus on building clean, accessible, high-performance interfaces. I work with React and Next.js to ship fast, scalable experiences using reusable components and a monochrome design language that reads as modern and trustworthy. I care about the details in UX/UI, loading states and subtle CSS transitions.",
    backend:
      "I design robust, maintainable APIs with strict typing and consistent validation. I integrate databases and third-party services with an eye on architecture, observability and security. The goal is a predictable, scalable backend that serves data efficiently to full-stack apps, with a focus on clarity, testing and reliable deployments.",
  },

  skills: {
    title: "Tech stack",
    marquee: "Carousel",
    grid: "Grid",
    groups: {
      frontend: "Frontend Development",
      backend: "Backend Development",
      databases: "Databases",
      tools: "Tooling & DevOps",
    },
  },

  experience: {
    title: "Experience",
    current: "Current",
  },

  education: {
    title: "Education",
    viewCertificates: "View certificates",
    completed: "Completed",
    inProgress: "In progress",
    viewProfileAt: "View profile on",
  },

  projects: {
    title: "Projects",
    demo: "Demo",
    code: "Code",
    private: "Private",
    viewAll: "View all projects",
    caseStudy: "Read the case study",
    listTitle: "Projects",
    listDescription:
      "Case studies of the applications I have built: the problem, the technical decisions and the outcome.",
    metaDescription:
      "Projects and case studies by Jesús David Benavides Chicaiza: web and desktop applications built with Next.js, NestJS, React and TypeScript.",
    back: "Back to projects",
    role: "Role",
    year: "Year",
    stack: "Stack",
    highlights: "Highlights",
    liveSite: "Live site",
    sourceCode: "Source code",
    empty: "No projects published yet.",
    comingSoon: "Coming soon",
    comingSoonBody:
      "I am still writing the case study for this project. In the meantime you can visit the site or browse the code.",
  },

  blog: {
    title: "Blog",
    listDescription:
      "Technical notes on web development: Next.js, TypeScript, frontend and backend architecture.",
    metaDescription:
      "Articles by Jesús David Benavides Chicaiza on full stack web development: Next.js, React, TypeScript, NestJS and best practices.",
    back: "Back to the blog",
    readMore: "Read article",
    readingTime: "min read",
    published: "Published",
    updated: "Updated",
    empty: "No articles published yet.",
    comingSoon: "Coming soon",
    comingSoonBody:
      "I am working on the first articles about web development, Next.js and TypeScript. Check back soon.",
    latest: "Latest articles",
    viewAll: "View all articles",
    tableOfContents: "Contents",
  },

  certificates: {
    title: "Certificates and courses",
    metaDescription:
      "Certificates and courses completed by Jesús David Benavides Chicaiza in web development, Git, frontend and languages. Filter by provider and category.",
    backToEducation: "Back to Education",
    searchPlaceholder: "Search by title, provider...",
    allProviders: "All providers",
    allCategories: "All categories",
    clear: "Clear",
    resultOne: "result",
    resultMany: "results",
    noResults: "No certificates match your filters.",
    view: "View",
  },

  contact: {
    title: "Contact",
    intro:
      "Have a web project, an open role or an idea you want to build? Send me a message and I will get back to you as soon as I can.",
    email: "Email",
    resumeTitle: "Resume",
    resumeSubtitle: "Available in two languages.",
    download: "Download",
  },

  footer: {
    tagline:
      "Building web experiences with a focus on monochrome design, performance and accessibility.",
    content: "Content",
    background: "Background",
    more: "More",
    education: "Education",
    certificates: "Certificates",
    cvEs: "Resume (Spanish)",
    cvEn: "Resume (English)",
    rights: "All rights reserved.",
  },

  notFound: {
    title: "Page not found",
    description: "The page you are looking for does not exist or has moved.",
    back: "Back to home",
  },

  breadcrumb: {
    home: "Home",
  },
};
