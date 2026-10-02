import { NextResponse } from "next/server";
import { isPreviewKind } from "@nassican/shared/preview";
import { locales, type Locale } from "@nassican/shared";
import { previewUrl } from "@/lib/preview";
import { currentSession } from "@/lib/session";

/**
 * Mints a preview link and redirects to it.
 *
 * The token lasts five minutes, and that is deliberate — it opens an
 * unpublished document to anyone holding it. But it means the link **cannot be
 * minted when the editor page renders**: an editing session lasts longer than
 * five minutes, so the button would be dead by the time it is pressed, and
 * dead in a way nobody would connect to how long they had been typing.
 *
 * So the button points here instead, with a stable href that never goes stale,
 * and the token is minted on the click. This hop is behind the panel session,
 * which is also what stops it being an open token vending machine.
 */
export async function GET(request: Request) {
  const session = await currentSession();
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const params = new URL(request.url).searchParams;
  const kind = params.get("kind");
  const id = params.get("id");
  const asked = params.get("locale");
  const locale: Locale = locales.includes(asked as Locale)
    ? (asked as Locale)
    : "es";

  if (!isPreviewKind(kind) || !id) {
    return NextResponse.json({ error: "faltan parámetros" }, { status: 400 });
  }

  const href = previewUrl(kind, id, locale);
  if (!href) {
    return NextResponse.json(
      { error: "falta PUBLIC_SITE_URL o REVALIDATE_SECRET" },
      { status: 503 },
    );
  }

  return NextResponse.redirect(href);
}
