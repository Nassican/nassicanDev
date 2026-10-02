import "server-only";

import { draftMode } from "next/headers";

/**
 * Whether this request is rendering a preview.
 *
 * The point of the feature is that **the preview uses the site's own
 * renderer**. Rebuilding the article page inside the panel would be quicker and
 * would start lying the first time `Prose`, the typography or the theme
 * changed — and a preview that drifts from production is worse than none,
 * because it is trusted.
 *
 * So the data layer learns one new question, and everything downstream is the
 * real page.
 *
 * It is a single boolean rather than "which document": whoever has draft mode
 * on reached it by presenting a signed token from the panel, and the panel has
 * one operator. Pinning each link to one id would add a second cookie and a
 * matching step to defend against someone who, by then, is already the owner.
 */
export async function isPreview(): Promise<boolean> {
  return (await draftMode()).isEnabled;
}
