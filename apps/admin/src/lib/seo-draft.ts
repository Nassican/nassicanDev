import type { Locale } from "@nassican/shared";

/** Shapes for the SEO module, free of database imports for the client editor. */
export type SeoSettingsDraft = {
  titleTemplate: string;
  googleSiteVerification: string;
  ga4MeasurementId: string;
  ga4PropertyId: string;
  gscSiteUrl: string;
  robotsExtra: string;
  defaultOgMediaId: string | null;
  defaultOgUrl: string | null;
  perLocale: Record<
    Locale,
    { defaultTitle: string; defaultDescription: string; keywords: string[] }
  >;
};

export type RedirectDraft = {
  id: string | null;
  source: string;
  destination: string;
  statusCode: number;
  isEnabled: boolean;
  hits: number;
  lastHitAt: string | null;
};

/**
 * A source must be a site path. An absolute URL would never match, because the
 * lookup happens against the path the visitor asked for.
 */
export function normaliseSource(value: string): string {
  const trimmed = value.trim().replace(/^https?:\/\/[^/]+/, "");
  if (!trimmed || trimmed === "/") return "";
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withSlash.replace(/\/+$/, "") || "/";
}

/** The destination may be a path or an external address. */
export function normaliseDestination(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//.test(trimmed)) return trimmed;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function redirectProblem(r: RedirectDraft): string | null {
  const source = normaliseSource(r.source);
  const destination = normaliseDestination(r.destination);

  if (!source) return "La dirección de origen no puede quedar vacía.";
  if (!destination) return "Falta el destino.";
  if (source === destination) return `"${source}" apunta a sí misma.`;
  return null;
}
