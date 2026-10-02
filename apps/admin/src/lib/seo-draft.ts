import type { Locale } from "@nassican/shared";

/** Shapes for the SEO module, free of database imports for the client editor. */
export type SeoSettingsDraft = {
  allowAiSearch: boolean;
  allowAiTraining: boolean;
  llmsEnabled: boolean;
  titleTemplate: string;
  googleSiteVerification: string;
  ga4MeasurementId: string;
  ga4PropertyId: string;
  gscSiteUrl: string;
  robotsExtra: string;
  defaultOgMediaId: string | null;
  defaultOgUrl: string | null;
  perLocale: Record<Locale, { defaultTitle: string; defaultDescription: string }>;
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

/**
 * The verification token, from whatever Google's page put on the clipboard.
 *
 * Next builds the element itself from `verification.google`, so this field wants
 * the token alone. But Search Console shows you the **whole tag** and tells you
 * to copy it, so pasting the tag is the natural thing to do — and the result was
 * a meta element nested inside its own content attribute:
 *
 *     <meta name="google-site-verification"
 *           content="&lt;meta name=&quot;google-site-verification&quot; …&gt;"/>
 *
 * Valid HTML, served for weeks, and verification never passed. Nothing could
 * have reported it: the field was filled in and the tag was present.
 *
 * So the field accepts either shape and keeps the token. Being lenient here is
 * not sloppiness — it is refusing to punish someone for following the
 * instructions on the other screen.
 */
export function extractVerificationToken(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  // A pasted tag, in either quote style, however the attributes are ordered.
  const fromTag = /<meta[^>]*\bcontent\s*=\s*("([^"]*)"|'([^']*)')/i.exec(trimmed);
  if (fromTag) return (fromTag[2] ?? fromTag[3] ?? "").trim();

  // Someone pasted just the attribute, or the `google-site-verification: x`
  // line from the HTML file. Keep what follows the separator.
  const fromPair = /^(?:content|google-site-verification)\s*[:=]\s*"?([^"\s]+)"?$/i.exec(
    trimmed,
  );
  if (fromPair) return fromPair[1];

  return trimmed;
}

/** Why the token cannot be stored, or null. */
export function verificationProblem(value: string): string | null {
  const token = extractVerificationToken(value);
  if (!token) return null;

  if (/[<>"']/.test(token)) {
    return "Eso sigue pareciendo HTML. Pega solo el valor de content, o la etiqueta entera y la recorto yo.";
  }
  if (/\s/.test(token)) {
    return "Un token de verificación no lleva espacios.";
  }
  return null;
}

export function redirectProblem(r: RedirectDraft): string | null {
  const source = normaliseSource(r.source);
  const destination = normaliseDestination(r.destination);

  if (!source) return "La dirección de origen no puede quedar vacía.";
  if (!destination) return "Falta el destino.";
  if (source === destination) return `"${source}" apunta a sí misma.`;
  return null;
}
