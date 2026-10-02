import { draftMode } from "next/headers";
import { redirect } from "next/navigation";

/** Leaves draft mode and returns to wherever the banner was shown. */
export async function GET(request: Request) {
  (await draftMode()).disable();
  const back = new URL(request.url).searchParams.get("back");
  // Only a path, never an absolute URL: an open redirect is a phishing tool.
  redirect(back?.startsWith("/") ? back : "/");
}
