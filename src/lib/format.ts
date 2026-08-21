import type { Locale } from "@/lib/i18n/config";

const dateLocales: Record<Locale, string> = {
  es: "es-CO",
  en: "en-US",
};

/**
 * Formats an ISO date for display. Forced to UTC so a date-only string like
 * "2026-08-20" never renders as the previous day for readers west of GMT.
 */
export function formatDate(locale: Locale, iso: string): string {
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(dateLocales[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
