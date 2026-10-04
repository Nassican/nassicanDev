import "server-only";

import type { BookFacts } from "@/lib/book-draft";

/**
 * Looks an edition up by ISBN-13 in Open Library, and nowhere else.
 *
 * Google Books was the fallback and was taken out on purpose. Without a key it
 * answered 429 to every request — the anonymous quota is shared and spent — and
 * with one it is another Cloud project and another bill to watch for a lookup
 * that, in practice, draws on the same catalogues: when Open Library did not
 * know an edition, Google did not either. One source that answers beats two
 * where the second only adds a way to fail.
 *
 * From the server, not the browser: one place to set a timeout and a
 * User-Agent.
 */

export type LookupResult =
  | { ok: true; facts: BookFacts }
  | { ok: false; message: string };

const TIMEOUT_MS = 6000;

type Json = unknown;

const record = (value: Json): Record<string, Json> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, Json>)
    : null;

const string = (value: Json): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const count = (value: Json): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : null;

/**
 * «Not in the catalogue» and «the catalogue failed» are different answers, and
 * the message keeps them apart: the first means typing it by hand, the second
 * may mean trying again in a minute.
 */
export async function lookupIsbn(isbn: string): Promise<LookupResult> {
  let edition: Record<string, Json> | null;

  try {
    const response = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`,
      {
        headers: {
          // Open Library asks heavy clients to identify themselves; this is not
          // one, but saying who is calling costs nothing.
          "User-Agent": "App Nassican (https://nassican.com)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    if (!response.ok) {
      return { ok: false, message: `Open Library respondió ${response.status}. Prueba de nuevo en un rato.` };
    }
    edition = record(record(await response.json())?.[`ISBN:${isbn}`]);
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error && error.name === "TimeoutError"
          ? "Open Library no respondió a tiempo. Prueba de nuevo en un rato."
          : "No se pudo contactar con Open Library.",
    };
  }

  const authors = (Array.isArray(edition?.authors) ? edition.authors : [])
    .map((a) => string(record(a)?.name))
    .filter((a): a is string => a !== null);

  const main = string(edition?.title);
  const sub = string(edition?.subtitle);

  const facts: BookFacts = {
    // «Title: Subtitle», the way the cover prints it.
    title: main && sub ? `${main}: ${sub}` : main,
    author: authors.length > 0 ? authors.join(", ") : null,
    pages: count(edition?.number_of_pages),
    source: "Open Library",
  };

  if (!facts.title && !facts.author && !facts.pages) {
    return { ok: false, message: "Open Library no conoce ese ISBN. Toca escribirlo a mano." };
  }

  return { ok: true, facts };
}
