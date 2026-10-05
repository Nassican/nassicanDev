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
  | "system"
  | "finance"
  | "game"
  | "book"
  | "skills"
  | "backup"
  | "trash"
  | "subscription"
  | "journal"
  | "task"
  | "goal";

export type NavEntry = {
  label: string;
  href: string;
  icon: NavIcon;
  ready: boolean;
};

export type NavSection = {
  /** Null for the first group, which needs no heading above one entry. */
  label: string | null;
  /**
   * The section's own page, which also makes its heading a link.
   *
   * Only «Personal» has one, and that is the difference the flag describes:
   * «Contenido» and «Medición» are kinds of work, not places — there is nothing
   * to see *about* them. «Personal» is a set of things you own, so «¿cómo voy?»
   * is a real question with a real answer.
   */
  href?: string;
  /**
   * Folds away. On for «Personal» alone: everything else is what this panel is
   * *for*, and this is a separate life that happens to share the login. Hiding
   * the work would be hiding the point.
   */
  collapsible?: boolean;
  entries: NavEntry[];
};

export const navigation: NavSection[] = [
  {
    label: null,
    entries: [
      { label: "Dashboard", href: "/", icon: "dashboard", ready: true },
      { label: "Pendientes", href: "/pendientes", icon: "task", ready: true },
    ],
  },
  {
    label: "Contenido",
    entries: [
      { label: "Blogs", href: "/contenido/blogs", icon: "post", ready: true },
      { label: "Proyectos", href: "/contenido/proyectos", icon: "project", ready: true },
      { label: "Páginas", href: "/contenido/paginas", icon: "page", ready: true },
      { label: "Multimedia", href: "/contenido/multimedia", icon: "media", ready: true },
      { label: "Habilidades", href: "/habilidades", icon: "skills", ready: true },
      { label: "Perfil", href: "/perfil", icon: "profile", ready: true },
    ],
  },
  {
    label: "Personal",
    href: "/personal",
    collapsible: true,
    entries: [
      { label: "Movimientos", href: "/finanzas", icon: "finance", ready: true },
      { label: "Metas y hábitos", href: "/metas", icon: "goal", ready: true },
      { label: "Suscripciones", href: "/suscripciones", icon: "subscription", ready: true },
      { label: "Juegos", href: "/juegos", icon: "game", ready: true },
      { label: "Libros", href: "/libros", icon: "book", ready: true },
      { label: "Bitácora", href: "/bitacora", icon: "journal", ready: true },
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
      { label: "Copias de seguridad", href: "/copias", icon: "backup", ready: true },
      { label: "Papelera", href: "/papelera", icon: "trash", ready: true },
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

  /*
   * Section pages count too. «Personal» has one of its own, and it is not an
   * entry in any list, so matching only entries left `/personal` lighting up
   * nothing at all — the one route in the panel that highlighted no heading.
   */
  const all = [
    ...navigation.flatMap((section) => section.entries.map((e) => e.href)),
    ...navigation.map((section) => section.href).filter((href): href is string => !!href),
  ];

  const matches = all
    .filter((href) => href !== "/" && (pathname === href || pathname.startsWith(`${href}/`)))
    .sort((a, b) => b.length - a.length);

  return matches[0] ?? null;
}
