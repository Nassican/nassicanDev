import "server-only";

import { createPreviewToken, type PreviewKind } from "@nassican/shared/preview";
import type { Locale } from "@nassican/shared";

/**
 * A link that opens an unpublished document on the public site.
 *
 * Built on the server so `REVALIDATE_SECRET` never reaches the browser: the
 * secret signs, and only the signature travels. The link is spent in five
 * minutes, and opens exactly one document.
 *
 * Returns null when the pieces are missing rather than a broken link — the
 * button is hidden instead of failing when pressed.
 */
export function previewUrl(
  kind: PreviewKind,
  id: string,
  locale: Locale = "es",
): string | null {
  const site = process.env.PUBLIC_SITE_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (!site || !secret) return null;

  const token = createPreviewToken({ kind, id }, secret);
  const url = new URL("/api/preview", site);
  url.searchParams.set("token", token);
  url.searchParams.set("locale", locale);
  return url.toString();
}
