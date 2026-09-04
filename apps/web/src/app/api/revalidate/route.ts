import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Lets the admin invalidate this site's cached content.
 *
 * The panel and the site are separate deployments, so `revalidateTag` called
 * in the admin cannot reach this app's cache. This endpoint is the bridge:
 * the admin posts the tags it changed, authenticated with a shared secret.
 *
 * It sits under /api, which `middleware.ts` excludes from locale rewriting.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;

  // Without a configured secret the endpoint stays closed rather than open.
  if (!secret) {
    return NextResponse.json(
      { error: "revalidation is not configured" },
      { status: 503 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let tags: unknown;
  try {
    ({ tags } = await request.json());
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== "string")) {
    return NextResponse.json(
      { error: "tags must be an array of strings" },
      { status: 400 },
    );
  }

  // { expire: 0 } purges every entry carrying the tag immediately, rather
  // than only those older than a named cache profile.
  for (const tag of tags as string[]) revalidateTag(tag, { expire: 0 });

  return NextResponse.json({ revalidated: tags, at: Date.now() });
}
