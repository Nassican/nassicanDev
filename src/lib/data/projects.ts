import type { Localized } from "@/lib/i18n/config";
import type { ContentBlock } from "./content";

/**
 * Per-language copy for one project.
 *
 * Only `tagline` is required: a project can be listed with `comingSoon: true`
 * before its case study exists, rather than shipping placeholder prose.
 */
export type ProjectTranslation = {
  /** One line, used on cards, meta descriptions and the OG image. */
  tagline: string;
  /** What the project is, in two or three sentences. Opens the case study. */
  summary?: string;
  role?: string;
  /** Short bullets shown in the case study sidebar. */
  highlights?: string[];
  /** The case study itself. */
  body?: ContentBlock[];
};

export type ProjectItem = {
  /** URL segment: `/projects/<slug>` and `/en/projects/<slug>`. */
  slug: string;
  /** Product name; identical in both languages, so it is not translated. */
  title: string;
  /** Year or range shown next to the title. */
  year: string;
  /** Machine-readable date for `datePublished`. */
  date: string;
  /** Names must match the keys in `skills.ts` so the icons resolve. */
  stack: string[];
  demo: string;
  /** Omit when the repository is private. */
  repo?: string;
  /** Path under /public; omit to render the placeholder tile. */
  image?: string;
  /** Pinned to the homepage grid. */
  featured?: boolean;
  /**
   * The case study is not written yet. The detail page says so instead of
   * rendering an empty shell, and the card links to it as "coming soon".
   */
  comingSoon?: boolean;
  content: Localized<ProjectTranslation>;
};

export const projects: ProjectItem[] = [
  {
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
    content: {
      es: {
        tagline: "Aplicación web con enfoque en rendimiento y accesibilidad.",
      },
      en: {
        tagline: "Web application focused on performance and accessibility.",
      },
    },
  },
  {
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
    content: {
      es: {
        tagline:
          "Aplicación de escritorio para visualizar cursos descargados de forma local.",
        summary:
          "CursoVisor es una aplicación de escritorio construida con Electron y React que organiza y reproduce cursos guardados en el disco. Nació de un problema propio: carpetas con cientos de videos sueltos, sin progreso, sin orden y sin manera de retomar donde se quedó.",
        role: "Desarrollo y diseño de la aplicación",
        highlights: [
          "Lectura y organización automática de carpetas de curso",
          "Progreso de reproducción guardado de forma local",
          "Empaquetado y distribución mediante GitHub Releases",
          "Funciona sin conexión: todo el contenido vive en el equipo",
        ],
        body: [
          {
            type: "heading",
            text: "El problema",
          },
          {
            type: "paragraph",
            text: "Un curso descargado suele ser un árbol de carpetas con nombres inconsistentes. El reproductor del sistema no sabe qué módulo sigue, no recuerda el minuto en que quedaste y no distingue un video visto de uno pendiente.",
          },
          {
            type: "heading",
            text: "Cómo está construido",
          },
          {
            type: "paragraph",
            text: "La aplicación combina un proceso principal de Electron con acceso al sistema de archivos, un servidor Express local que sirve el contenido, y una interfaz en React. Separar el servidor del proceso de la ventana permitió reutilizar la misma lógica de catálogo si algún día se ejecuta en el navegador.",
          },
          {
            type: "list",
            items: [
              "Electron para el acceso nativo al disco y el empaquetado.",
              "Express para servir los archivos con soporte de rangos, necesario para adelantar y retroceder el video.",
              "React con TypeScript para la interfaz y el estado del reproductor.",
              "Persistencia local del progreso, sin cuentas ni servidor remoto.",
            ],
          },
          {
            type: "heading",
            text: "Qué aprendí",
          },
          {
            type: "paragraph",
            text: "Servir video local no es solo devolver un archivo: sin peticiones por rango, la barra de progreso no funciona. Fue el detalle que más tiempo tomó y el que más cambió la experiencia final.",
          },
        ],
      },
      en: {
        tagline: "Desktop app for watching downloaded courses locally.",
        summary:
          "CursoVisor is a desktop application built with Electron and React that organises and plays courses stored on disk. It came out of a problem of my own: folders holding hundreds of loose video files, with no progress tracking, no ordering and no way to pick up where you left off.",
        role: "Application development and design",
        highlights: [
          "Automatic reading and organisation of course folders",
          "Playback progress stored locally",
          "Packaged and distributed through GitHub Releases",
          "Works offline: all content stays on the machine",
        ],
        body: [
          {
            type: "heading",
            text: "The problem",
          },
          {
            type: "paragraph",
            text: "A downloaded course is usually a folder tree with inconsistent names. The system player does not know which module comes next, does not remember the timestamp you stopped at, and cannot tell a watched video from a pending one.",
          },
          {
            type: "heading",
            text: "How it is built",
          },
          {
            type: "paragraph",
            text: "The app pairs an Electron main process that reaches the file system with a local Express server that serves the content, and a React interface on top. Keeping the server separate from the window process meant the same catalogue logic could be reused if it ever runs in a browser.",
          },
          {
            type: "list",
            items: [
              "Electron for native disk access and packaging.",
              "Express to serve files with range request support, which the video scrubber depends on.",
              "React with TypeScript for the interface and player state.",
              "Local persistence for progress, with no accounts and no remote server.",
            ],
          },
          {
            type: "heading",
            text: "What I learned",
          },
          {
            type: "paragraph",
            text: "Serving local video is not just returning a file: without range requests the progress bar does not work at all. It was the detail that took the longest and changed the final experience the most.",
          },
        ],
      },
    },
  },
];

export function getProject(slug: string): ProjectItem | undefined {
  return projects.find((p) => p.slug === slug);
}

/** Newest first, which is the order both the grid and the sitemap use. */
export const projectsByDate = [...projects].sort((a, b) =>
  b.date.localeCompare(a.date),
);

export const featuredProjects = projectsByDate.filter((p) => p.featured !== false);
