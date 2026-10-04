import type { Prisma } from "../generated/prisma";
import type { ContentBlock } from "@nassican/shared";
import type { Snapshot } from "./backup";

/**
 * Typed entry points for the `jsonb` columns.
 *
 * Reads are handled by the client extension in `index.ts`; writes go through
 * here. Between the two, the only way a malformed body reaches the database is
 * hand-written SQL - which is exactly the guarantee `Localized<T>` and
 * `ContentBlock[]` gave while the content lived in TypeScript modules.
 */
export const prismaJson = {
  body(blocks: ContentBlock[]): Prisma.InputJsonValue {
    return blocks as unknown as Prisma.InputJsonValue;
  },

  strings(values: string[]): Prisma.InputJsonValue {
    return values as unknown as Prisma.InputJsonValue;
  },

  /** A trash payload; `index.ts` gives it back its type on the way out. */
  snapshot(value: Snapshot): Prisma.InputJsonValue {
    return value as unknown as Prisma.InputJsonValue;
  },

  record(value: Record<string, unknown>): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  },
};
