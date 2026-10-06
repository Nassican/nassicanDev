/**
 * PageSpeed Insights, the part that needs no network: which pages, how to read
 * a Lighthouse response, and what counts as a drop worth saying.
 */

export type Strategy = "mobile" | "desktop";

/**
 * The pages measured. Mobile for all of them, because that is how Google ranks
 * and where a portfolio is opened from a link; desktop for the home page only,
 * as the reference the mobile numbers are read against. Five runs a day, inside
 * any quota, and each one is 10 to 30 seconds of Google's time, not ours.
 */
export const PAGESPEED_TARGETS: { path: string; label: string; strategy: Strategy }[] = [
  { path: "/", label: "Portada", strategy: "mobile" },
  { path: "/projects", label: "Proyectos", strategy: "mobile" },
  { path: "/blog", label: "Blog", strategy: "mobile" },
  { path: "/certificates", label: "Certificados", strategy: "mobile" },
  { path: "/", label: "Portada", strategy: "desktop" },
];

export type PageSpeedMetrics = {
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
  lcpMs: number | null;
  fcpMs: number | null;
  tbtMs: number | null;
  cls: number | null;
  fieldCategory: string | null;
};

type Json = Record<string, unknown>;
const obj = (v: unknown): Json | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * Reads the parts of a `runPagespeed` response the module keeps.
 *
 * Scores arrive as 0–1 and are stored as the 0–100 everyone quotes. A category
 * that did not run is null, never zero: zero is a real, terrible score.
 */
export function parseLighthouse(response: unknown): PageSpeedMetrics {
  const root = obj(response);
  const lighthouse = obj(root?.lighthouseResult);
  if (!lighthouse) throw new Error("La respuesta no trae lighthouseResult.");

  const categories = obj(lighthouse.categories) ?? {};
  const audits = obj(lighthouse.audits) ?? {};
  const score = (key: string) => {
    const value = num(obj(categories[key])?.score);
    return value === null ? null : Math.round(value * 100);
  };
  const metric = (key: string) => num(obj(audits[key])?.numericValue);
  const ms = (key: string) => {
    const value = metric(key);
    return value === null ? null : Math.round(value);
  };
  const cls = metric("cumulative-layout-shift");

  const field = obj(root?.loadingExperience);
  const category = field?.overall_category;

  return {
    performance: score("performance"),
    accessibility: score("accessibility"),
    bestPractices: score("best-practices"),
    seo: score("seo"),
    lcpMs: ms("largest-contentful-paint"),
    fcpMs: ms("first-contentful-paint"),
    tbtMs: ms("total-blocking-time"),
    cls: cls === null ? null : Math.round(cls * 1000) / 1000,
    fieldCategory: typeof category === "string" && category !== "NONE" ? category : null,
  };
}

/**
 * Google's own explanation, in words the operator can act on. The two cases
 * that matter were both met while building this: the API not enabled on the
 * project, and the anonymous quota that every keyless caller shares.
 */
export function explainError(status: number, message: string): string {
  if (/has not been used in project|is disabled/i.test(message)) {
    const project = /project (\d+)/.exec(message)?.[1];
    return `La API de PageSpeed Insights no está activada en Google Cloud${project ? ` (proyecto ${project})` : ""}. Actívala en console.cloud.google.com/apis/library/pagespeedonline.googleapis.com — es gratis y no pide facturación.`;
  }
  if (status === 429) {
    return "Google limitó las consultas: sin credenciales se comparte una cuota anónima que suele estar gastada.";
  }
  if (/insufficient authentication scopes/i.test(message)) {
    return "El token de Google no sirve para PageSpeed (permiso insuficiente).";
  }
  return `PageSpeed respondió ${status}: ${message.slice(0, 160)}`;
}

export type Tone = "good" | "average" | "poor";

/** Lighthouse's own bands: 90 and up is good, under 50 is poor. */
export function scoreTone(score: number | null): Tone | null {
  if (score === null) return null;
  return score >= 90 ? "good" : score >= 50 ? "average" : "poor";
}

/** Core Web Vitals thresholds, as Google publishes them for the lab metrics. */
const limits = {
  lcpMs: [2500, 4000],
  fcpMs: [1800, 3000],
  tbtMs: [200, 600],
  cls: [0.1, 0.25],
} as const;

export function metricTone(metric: keyof typeof limits, value: number | null): Tone | null {
  if (value === null) return null;
  const [good, poor] = limits[metric];
  return value <= good ? "good" : value > poor ? "poor" : "average";
}

export function formatMs(ms: number | null): string {
  if (ms === null) return "—";
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
}

/**
 * A drop worth an alert: ten points or more since the previous measurement, or
 * falling under 50.
 *
 * Lighthouse varies a few points from run to run with nothing changed — the
 * machine Google lent that minute, the network. Warning on every wobble is how a
 * warning learns to be ignored; ten points is a change, not noise.
 */
export const DROP_POINTS = 10;

export function isRegression(current: number | null, previous: number | null): boolean {
  if (current === null) return false;
  if (current < 50 && (previous === null || previous >= 50)) return true;
  return previous !== null && previous - current >= DROP_POINTS;
}
