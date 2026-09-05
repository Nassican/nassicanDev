/**
 * Turns "PrismaClient is unable to run in this browser environment" - a
 * runtime error only visible once a page is opened - into a build error that
 * names the client component responsible. Anything a client component needs
 * (types, pure helpers) belongs somewhere else, not here.
 */
import "server-only";

import { PrismaClient, type Locale as DbLocale } from "../generated/prisma";
import {
  isContentBody,
  type ContentBlock,
  type Locale,
} from "@nassican/shared";

export * from "../generated/prisma";
export { prismaJson } from "./json";
export {
  readImageByChecksum,
  mediaPath,
  checksumFromFilename,
  type StoredImage,
} from "./media";

/**
 * Fails to compile if the Postgres `Locale` enum and the `locales` list in
 * `@nassican/shared` drift apart. Adding a language has to touch both.
 */
export type LocaleParity = [Locale] extends [DbLocale]
  ? [DbLocale] extends [Locale]
    ? true
    : never
  : never;

export const localeParity: LocaleParity = true;

/**
 * Malformed stored content is a bug, not user input: the admin only writes
 * bodies through typed helpers. Make it loud where it can be fixed, and
 * survivable where a thrown error would take the whole page down.
 */
function parseBody(value: unknown, where: string): ContentBlock[] {
  if (isContentBody(value)) return value;
  if (value === null || value === undefined) return [];

  const message = `Malformed ContentBlock[] in ${where}`;
  if (process.env.NODE_ENV !== "production") throw new Error(message);
  console.error(message, value);
  return [];
}

function parseNullableBody(value: unknown, where: string): ContentBlock[] | null {
  if (value === null || value === undefined) return null;
  return parseBody(value, where);
}

function parseStringArray(value: unknown): string[] | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
    return value as string[];
  }
  return null;
}

/**
 * Prisma types every `jsonb` column as opaque `JsonValue`. This extension is
 * the one sanctioned place where those columns are given back the types they
 * were written with, so no cast is needed at any call site.
 */
function createBaseClient() {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

function extend(base: PrismaClient) {
  return base.$extends({
    result: {
      postTranslation: {
        body: {
          needs: { body: true, postId: true, locale: true },
          compute: (t) => parseBody(t.body, `post ${t.postId} (${t.locale})`),
        },
      },
      projectTranslation: {
        body: {
          needs: { body: true, projectId: true, locale: true },
          compute: (t) =>
            parseNullableBody(t.body, `project ${t.projectId} (${t.locale})`),
        },
        highlights: {
          needs: { highlights: true },
          compute: (t) => parseStringArray(t.highlights),
        },
      },
      pageTranslation: {
        body: {
          needs: { body: true, pageId: true, locale: true },
          compute: (t) =>
            parseNullableBody(t.body, `page ${t.pageId} (${t.locale})`),
        },
        keywords: {
          needs: { keywords: true },
          compute: (t) => parseStringArray(t.keywords),
        },
      },
      profileTranslation: {
        bio: {
          needs: { bio: true },
          compute: (t) => parseStringArray(t.bio) ?? [],
        },
      },
      seoSettingsTranslation: {
        keywords: {
          needs: { keywords: true },
          compute: (t) => parseStringArray(t.keywords),
        },
      },
    },
  });
}

export type Db = ReturnType<typeof extend>;

/**
 * One client per process. Next's dev server re-evaluates modules on every
 * change, which would otherwise open a new connection pool each time.
 */
const globalForPrisma = globalThis as unknown as { nassicanDb?: PrismaClient };

const base: PrismaClient = globalForPrisma.nassicanDb ?? createBaseClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.nassicanDb = base;

/**
 * The unextended client, for libraries that introspect the model delegates
 * directly - Better Auth's Prisma adapter among them. `$extends` returns a new
 * client over the *same* connection pool, so exporting both costs nothing.
 * Application code should use `db`, which gives typed access to the jsonb
 * columns; `dbBase` is for adapters only.
 */
export const dbBase: PrismaClient = base;

export const db: Db = extend(base);
