/**
 * Body content types and helpers.
 *
 * These moved to `@nassican/shared` when the admin appeared: the panel writes
 * the same blocks this app renders, and `packages/db` uses the type to check
 * what comes back out of a `jsonb` column. Re-exported from here so every
 * existing import in this app keeps working, and because `Prose.tsx` remains
 * the only place that knows how a block is drawn.
 */
export {
  contentBlockTypes,
  isContentBlock,
  isContentBody,
  wordCount,
  readingMinutes,
  headingId,
  extractLinks,
  type ContentBlock,
} from "@nassican/shared";
