/**
 * Long-form body content, shared by blog posts and project case studies.
 *
 * Blocks instead of Markdown on purpose: the content lives in typed modules
 * next to the rest of the data, so a translation that is missing or a block
 * that is malformed fails `tsc` rather than rendering badly in production.
 * Swapping this for MDX later only means replacing `Prose`.
 */
export type ContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "code"; language?: string; code: string }
  | { type: "quote"; text: string };

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
