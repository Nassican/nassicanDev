/**
 * Long-form body content, shared by blog posts and project case studies.
 *
 * Blocks instead of Markdown on purpose: a malformed block fails `tsc` rather
 * than rendering badly in production. Now that bodies are stored as `jsonb`,
 * this type is also what `packages/db` casts rows to on read - it is the
 * contract on both sides of the database.
 */
export type ContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "code"; language?: string; code: string }
  | { type: "quote"; text: string };

export const contentBlockTypes = [
  "paragraph",
  "heading",
  "list",
  "code",
  "quote",
] as const satisfies readonly ContentBlock["type"][];

/**
 * Structural check on a value coming out of a `jsonb` column.
 *
 * Prisma types Json as opaque, so something has to vouch for the shape. The
 * admin only ever writes bodies through typed helpers, which makes this a
 * guard against hand-written SQL and bad imports rather than untrusted input -
 * that is why it validates structure without pulling in a schema library.
 */
export function isContentBlock(value: unknown): value is ContentBlock {
  if (typeof value !== "object" || value === null) return false;
  const block = value as Record<string, unknown>;

  switch (block.type) {
    case "paragraph":
    case "heading":
    case "quote":
      return typeof block.text === "string";
    case "list":
      return (
        Array.isArray(block.items) &&
        block.items.every((item) => typeof item === "string")
      );
    case "code":
      return typeof block.code === "string";
    default:
      return false;
  }
}

export function isContentBody(value: unknown): value is ContentBlock[] {
  return Array.isArray(value) && value.every(isContentBlock);
}

/** Rough word count of a body, used for the reading-time estimate. */
export function wordCount(body: ContentBlock[]): number {
  return body.reduce((total, block) => {
    switch (block.type) {
      case "paragraph":
      case "heading":
      case "quote":
        return total + block.text.split(/\s+/).filter(Boolean).length;
      case "list":
        return (
          total +
          block.items.reduce(
            (n, item) => n + item.split(/\s+/).filter(Boolean).length,
            0,
          )
        );
      case "code":
        // Code is skimmed, not read; count it at a fraction of prose.
        return total + Math.round(block.code.split(/\s+/).filter(Boolean).length / 3);
    }
  }, 0);
}

/** Reading time in whole minutes, never below one. */
export function readingMinutes(body: ContentBlock[]): number {
  return Math.max(1, Math.round(wordCount(body) / 200));
}

/**
 * Stable id for a heading, used for anchors and the table of contents.
 * Strips accents so Spanish headings produce clean ASCII fragments.
 */
export function headingId(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Every URL referenced by a body, for the broken-link checker. */
export function extractLinks(body: ContentBlock[]): string[] {
  const pattern = /https?:\/\/[^\s)<>"']+/g;
  const found = new Set<string>();

  for (const block of body) {
    const text =
      block.type === "list"
        ? block.items.join(" ")
        : block.type === "code"
          ? ""
          : block.text;
    for (const match of text.matchAll(pattern)) found.add(match[0]);
  }

  return [...found];
}
