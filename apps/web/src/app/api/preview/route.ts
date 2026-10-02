import { draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@nassican/db";
import { verifyPreviewToken } from "@nassican/shared/preview";
import { localePath, type Locale } from "@/lib/i18n/config";

/**
 * The door into draft mode.
 *
 * It takes a signed token rather than a shared secret, because a preview link
 * is a browser navigation: whatever it carries lands in history, in `Referer`
 * headers and in logs. `REVALIDATE_SECRET` signs and never travels.
 *
 * Everything it cannot verify is refused. The opposite of `isCanonicalHost`,
 * which fails open — there the bad outcome is de-indexing the real site, here
 * it is serving drafts to whoever asks.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const locale = (url.searchParams.get("locale") ?? "es") as Locale;

  const check = verifyPreviewToken(token, process.env.REVALIDATE_SECRET);
  if (!check.ok) {
    return new Response(`Vista previa rechazada: ${check.reason}`, {
      status: 401,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const { kind, id } = check.claim;

  // The token carries an id, not a path: a slug can change while editing, and
  // a link that 404s after a rename is a link nobody trusts again.
  const target = await resolvePath(kind, id, locale);
  if (!target) {
    return new Response("Ese contenido ya no existe.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  (await draftMode()).enable();
  redirect(target);
}

async function resolvePath(
  kind: "post" | "project" | "page",
  id: string,
  locale: Locale,
): Promise<string | null> {
  if (kind === "post") {
    const row = await db.post.findUnique({ where: { id }, select: { slug: true } });
    return row ? localePath(locale, `/blog/${row.slug}`) : null;
  }

  if (kind === "project") {
    const row = await db.project.findUnique({ where: { id }, select: { slug: true } });
    return row ? localePath(locale, `/projects/${row.slug}`) : null;
  }

  const row = await db.page.findUnique({ where: { id }, select: { route: true } });
  return row ? localePath(locale, row.route) : null;
}
