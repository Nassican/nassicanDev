import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, locales } from "@/lib/i18n/config";

/**
 * Locale routing. Named `middleware.ts` rather than the newer `proxy.ts`:
 * Next 16.0.0 does not pick the latter up under Turbopack.
 *
 * Pages are generated under the `[locale]` segment, but the default language
 * is served from the root of the site: `/blog`, not `/es/blog`. This proxy
 * bridges the two:
 *
 *   - `/es/*`  -> permanent redirect to `/*`, so each page has exactly one
 *                 indexable URL and `/es/...` never competes with the root.
 *   - `/en/*`  -> passed through; the prefix already matches the segment.
 *   - `/*`     -> rewritten to `/es/*` without changing the visible URL.
 */
const prefixedLocales = locales.filter((l) => l !== defaultLocale);

function hasPrefix(pathname: string, locale: string) {
  return pathname === `/${locale}` || pathname.startsWith(`/${locale}/`);
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (hasPrefix(pathname, defaultLocale)) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(defaultLocale.length + 1) || "/";
    return NextResponse.redirect(url, 308);
  }

  if (prefixedLocales.some((locale) => hasPrefix(pathname, locale))) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${defaultLocale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  /**
   * Everything except Next internals, /sitemap.xml, /robots.txt, the manifest
   * and any file in /public — all matched by the dot in their name.
   *
   * `/llms.txt` is the exception: it is a real localized route living under
   * `[locale]`, so it is listed explicitly to opt back into the rewrite. The
   * prefixed `/en/llms.txt` needs no rule, since an unmatched path reaches
   * the router unchanged.
   */
  matcher: [
    "/((?!api/|_next/|_vercel/|.*\\..*).*)",
    "/llms.txt",
    "/es/llms.txt",
  ],
};
