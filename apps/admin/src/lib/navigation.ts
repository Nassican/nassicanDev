/**
 * The panel's module tree. `ready: false` renders the entry but does not link
 * it - showing the whole map from day one makes it obvious what exists and
 * what does not, which a hidden menu does not.
 */
export type NavEntry = {
  label: string;
  href: string;
  ready: boolean;
  children?: NavEntry[];
};

export const navigation: NavEntry[] = [
  { label: "Dashboard", href: "/", ready: true },
  {
    label: "Contenido",
    href: "/contenido/blogs",
    ready: true,
    children: [
      { label: "Blogs", href: "/contenido/blogs", ready: true },
      { label: "Proyectos", href: "/contenido/proyectos", ready: true },
      { label: "Páginas", href: "/contenido/paginas", ready: true },
      { label: "Multimedia", href: "/contenido/multimedia", ready: true },
    ],
  },
  { label: "Perfil", href: "/perfil", ready: true },
  { label: "SEO", href: "/seo", ready: true },
  { label: "Analítica", href: "/analitica", ready: true },
  { label: "Estadísticas", href: "/estadisticas", ready: true },
  { label: "Configuración", href: "/configuracion", ready: true },
  { label: "Usuarios", href: "/usuarios", ready: false },
  { label: "Sistema", href: "/sistema", ready: false },
];
