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
      { label: "Proyectos", href: "/contenido/proyectos", ready: false },
      { label: "Páginas", href: "/contenido/paginas", ready: false },
      { label: "Multimedia", href: "/contenido/multimedia", ready: false },
    ],
  },
  { label: "SEO", href: "/seo", ready: false },
  { label: "Analítica", href: "/analitica", ready: false },
  { label: "Estadísticas", href: "/estadisticas", ready: false },
  { label: "Configuración", href: "/configuracion", ready: false },
  { label: "Usuarios", href: "/usuarios", ready: false },
  { label: "Sistema", href: "/sistema", ready: false },
];
