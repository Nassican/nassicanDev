/**
 * The panel's module tree, as data.
 *
 * Grouped rather than flat: twelve entries in one column is a wall, and the
 * three groups are the three questions an operator arrives with - what does
 * the site say, how is it doing, and how is it set up.
 *
 * `icon` is a key and not a component so this stays a plain data module the
 * server can import. `PanelNav` maps the key to the drawing.
 *
 * `ready: false` renders an entry without linking it. Nothing uses it today -
 * every module exists - but it is what makes the next one visible from the day
 * it is planned rather than the day it works.
 */
export type NavIcon =
  | "dashboard"
  | "post"
  | "project"
  | "page"
  | "media"
  | "profile"
  | "analytics"
  | "stats"
  | "seo"
  | "settings"
  | "users"
  | "system";

export type NavEntry = {
  label: string;
  href: string;
  icon: NavIcon;
  ready: boolean;
};

export type NavSection = {
  /** Null for the first group, which needs no heading above one entry. */
  label: string | null;
  entries: NavEntry[];
};

export const navigation: NavSection[] = [
  {
    label: null,
    entries: [
      { label: "Dashboard", href: "/", icon: "dashboard", ready: true },
    ],
  },
  {
    label: "Contenido",
    entries: [
      { label: "Blogs", href: "/contenido/blogs", icon: "post", ready: true },
      { label: "Proyectos", href: "/contenido/proyectos", icon: "project", ready: true },
      { label: "Páginas", href: "/contenido/paginas", icon: "page", ready: true },
      { label: "Multimedia", href: "/contenido/multimedia", icon: "media", ready: true },
      { label: "Perfil", href: "/perfil", icon: "profile", ready: true },
    ],
  },
  {
    label: "Medición",
    entries: [
      { label: "Analítica", href: "/analitica", icon: "analytics", ready: true },
      { label: "Estadísticas", href: "/estadisticas", icon: "stats", ready: true },
      // SEO sits here rather than under administration: half of it edits
      // metadata, but what you open it for is the Search Console numbers.
      { label: "SEO", href: "/seo", icon: "seo", ready: true },
    ],
  },
  {
    label: "Administración",
    entries: [
      { label: "Configuración", href: "/configuracion", icon: "settings", ready: true },
      { label: "Usuarios", href: "/usuarios", icon: "users", ready: true },
      { label: "Sistema", href: "/sistema", icon: "system", ready: true },
    ],
  },
];

/**
 * Which entry a path belongs to.
 *
 * The dashboard is the only exact match; everything else owns its subtree, so
 * `/contenido/blogs/<id>` still lights up Blogs. Longest match wins, which is
 * what keeps a nested route from matching a shorter sibling by accident.
 */
export function activeHref(pathname: string): string | null {
  if (pathname === "/") return "/";

  const all = navigation.flatMap((section) => section.entries);
  const matches = all
    .filter((e) => e.href !== "/" && (pathname === e.href || pathname.startsWith(`${e.href}/`)))
    .sort((a, b) => b.href.length - a.href.length);

  return matches[0]?.href ?? null;
}
