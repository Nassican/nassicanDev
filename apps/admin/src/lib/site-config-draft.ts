import {
  anchoredSectionKeys,
  locales,
  type HomeSectionKey,
  type Locale,
  type NavKind,
  type SiteSettings,
} from "@nassican/shared";

/** Shapes for the Configuración module, free of database imports. */

export type NavArea = "header" | "header_cta" | "footer";

export type NavItemDraft = {
  id: string;
  area: NavArea;
  /** Null for a top-level item; the column's id for a footer link. */
  parentId: string | null;
  kind: NavKind;
  /** A section key, a site path, a page id, or an absolute URL. */
  target: string;
  position: number;
  isVisible: boolean;
  labels: Record<Locale, string>;
};

export type NavColumnDraft = {
  column: NavItemDraft;
  items: NavItemDraft[];
};

export type NavDraft = {
  header: NavItemDraft[];
  cta: NavItemDraft | null;
  footer: NavColumnDraft[];
};

export type SectionDraft = {
  key: HomeSectionKey;
  position: number;
  isVisible: boolean;
};

export type ConfigDraft = {
  settings: SiteSettings;
  nav: NavDraft;
  sections: SectionDraft[];
  /** Custom pages, so a `page` link can be picked instead of typed. */
  pages: { id: string; route: string; label: string }[];
};

/** What each section is called in the panel. The panel is Spanish-only. */
export const sectionLabels: Record<HomeSectionKey, string> = {
  hero: "Portada",
  about: "Sobre mí",
  skills: "Tecnologías",
  experience: "Experiencia",
  education: "Formación",
  projects: "Proyectos",
  blog: "Últimos artículos",
  contact: "Contacto",
};

export const kindLabels: Record<NavKind, string> = {
  section: "Sección de la portada",
  route: "Ruta del sitio",
  page: "Página propia",
  external: "Enlace externo",
};

export const timezones = [
  "America/Bogota",
  "America/Mexico_City",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/Madrid",
  "UTC",
];

/** A route must be a site path; the locale prefix is added at render time. */
export function normaliseTarget(kind: NavKind, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  switch (kind) {
    case "external":
      return trimmed;
    case "section":
      return trimmed.replace(/^#/, "");
    case "page":
      return trimmed;
    default:
      return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  }
}

/**
 * Why an item cannot be saved, or null.
 *
 * Both labels are required rather than optional-with-a-fallback: the site is
 * bilingual, and a menu entry that exists in one language and not the other is
 * a hole a visitor walks into, not a detail to fill in later.
 */
export function navItemProblem(item: NavItemDraft): string | null {
  const target = normaliseTarget(item.kind, item.target);

  const missing = locales.filter((locale) => !item.labels[locale]?.trim());
  if (missing.length > 0) {
    return `Falta el texto en ${missing.join(" y ")}.`;
  }

  // A column heading is a label and nothing else.
  if (item.area === "footer" && item.parentId === null) return null;

  if (!target) return "Falta el destino.";

  if (item.kind === "section" && !anchoredSectionKeys.includes(target as never)) {
    return `"${target}" no es una sección de la portada.`;
  }

  if (item.kind === "external" && !/^https?:\/\//i.test(target)) {
    return "Un enlace externo tiene que empezar por http:// o https://.";
  }

  return null;
}

/**
 * The rule that makes the two halves of this module one module: hiding a
 * section that the menu points at leaves a link that scrolls nowhere.
 *
 * Reported rather than silently corrected - which link should give way is the
 * operator's call, not the panel's.
 */
export function danglingSectionLinks(
  nav: NavDraft,
  sections: SectionDraft[],
): { section: HomeSectionKey; labels: string[] }[] {
  const hidden = new Set(
    sections.filter((s) => !s.isVisible).map((s) => s.key as string),
  );
  if (hidden.size === 0) return [];

  const all = [
    ...nav.header,
    ...(nav.cta ? [nav.cta] : []),
    ...nav.footer.flatMap((column) => column.items),
  ];

  const bySection = new Map<string, string[]>();
  for (const item of all) {
    if (item.kind !== "section" || !item.isVisible) continue;
    if (!hidden.has(item.target)) continue;
    bySection.set(item.target, [
      ...(bySection.get(item.target) ?? []),
      item.labels.es || item.labels.en || item.target,
    ]);
  }

  return [...bySection.entries()].map(([section, labels]) => ({
    section: section as HomeSectionKey,
    labels,
  }));
}

export function settingsProblem(settings: SiteSettings): string | null {
  if (!settings.brandLine.trim()) return "La línea de marca no puede quedar vacía.";
  if (!settings.copyrightName.trim()) return "El nombre del copyright no puede quedar vacío.";
  if (!Number.isInteger(settings.latestPostsCount) || settings.latestPostsCount < 0) {
    return "El número de artículos en la portada tiene que ser un entero positivo.";
  }
  if (settings.latestPostsCount > 12) {
    return "Doce artículos ya no son un adelanto; enlaza al blog.";
  }
  if (!settings.timezone.trim()) return "Falta la zona horaria.";
  return null;
}
