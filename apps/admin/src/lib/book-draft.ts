import type { BookFormat, BookStatus } from "@nassican/db";
import { fieldProblems, parseNumber } from "@/lib/draft-fields";

/**
 * The shape a book has while it is being edited, and the rules that decide
 * whether it can be saved.
 *
 * Mirrors `game-draft.ts` on purpose — the two libraries are the same idea with
 * different nouns — and shares its field reading through `draft-fields.ts` so
 * there is one `parseNumber` in the panel and not two.
 */

export type BookDraft = {
  id: string;
  title: string;
  author: string;
  isbn: string;
  format: BookFormat;
  status: BookStatus;
  pages: string;
  pagesRead: string;
  price: string;
  purchasedAt: string;
  finishedAt: string;
  note: string;
};

export const formats: { value: BookFormat; label: string }[] = [
  { value: "physical", label: "Físico" },
  { value: "ebook", label: "Ebook" },
  { value: "audiobook", label: "Audiolibro" },
];

export const statuses: { value: BookStatus; label: string; hint: string }[] = [
  { value: "wishlist", label: "Lo quiero", hint: "Todavía no es tuyo" },
  { value: "backlog", label: "Sin empezar", hint: "Lo tienes y no lo has abierto" },
  { value: "reading", label: "Leyendo", hint: "En curso ahora mismo" },
  { value: "finished", label: "Terminado", hint: "Llegaste al final" },
  { value: "dropped", label: "Abandonado", hint: "Lo dejaste y no vas a volver" },
];

export const formatLabel = (f: BookFormat): string =>
  formats.find((x) => x.value === f)?.label ?? f;

export const statusLabel = (s: BookStatus): string =>
  statuses.find((x) => x.value === s)?.label ?? s;

export function emptyBook(): BookDraft {
  return {
    id: "",
    title: "",
    author: "",
    isbn: "",
    format: "physical",
    status: "backlog",
    pages: "",
    pagesRead: "",
    price: "",
    purchasedAt: "",
    finishedAt: "",
    note: "",
  };
}

/** Why a draft cannot be saved, in the words the panel shows. */
export function bookProblems(draft: BookDraft): string[] {
  const problems: string[] = [];

  if (!draft.title.trim()) problems.push("Falta el título.");

  if (draft.isbn.trim() && normaliseIsbn(draft.isbn) === null) {
    problems.push("El ISBN no cuadra: revisa los dígitos.");
  }

  problems.push(
    ...fieldProblems([
      { label: "compra", value: draft.purchasedAt, kind: "date" },
      { label: "fin", value: draft.finishedAt, kind: "date" },
      { label: "Las páginas", value: draft.pages, kind: "amount" },
      { label: "Las páginas leídas", value: draft.pagesRead, kind: "amount" },
      { label: "El precio", value: draft.price, kind: "amount" },
    ]),
  );

  /*
   * Read past the end is the one mistake that is a contradiction between two
   * fields rather than a typo in one. It usually means the total was typed into
   * the wrong box, so saying so is more useful than clamping it quietly.
   */
  const total = parseNumber(draft.pages);
  const read = parseNumber(draft.pagesRead);
  if (total !== null && read !== null && read > total) {
    problems.push(`Van ${read} páginas leídas de ${total} en total.`);
  }

  if (draft.finishedAt.trim() && draft.status === "backlog") {
    problems.push("Tiene fecha de fin pero está marcado como sin empezar.");
  }

  /*
   * An audiobook has no pages. Rejecting them would be pedantic — some people do
   * track the print length of what they listened to — so this only objects when
   * the two together would compute a progress bar nobody meant.
   */
  if (draft.format === "audiobook" && draft.pagesRead.trim() && !draft.pages.trim()) {
    problems.push("Un audiolibro con páginas leídas pero sin total no dice nada.");
  }

  return problems;
}

/** How far through, or null when there is nothing to divide. */
export function progressRatio(
  pages: number | null,
  pagesRead: number | null,
): number | null {
  if (pages === null || pagesRead === null || pages <= 0) return null;
  return Math.min(1, pagesRead / pages);
}

/**
 * An ISBN as typed — hyphens, spaces, an «ISBN-10:» label, either length — as
 * the ISBN-13 it names, or null when the check digit says it is not one.
 *
 * Normalised to thirteen because an ISBN-10 and its ISBN-13 are the same
 * edition, and two spellings would make one book look like two. The check
 * digit is verified rather than trusted: a mistyped ISBN is still thirteen
 * digits, and looking it up would fill the form with somebody else's book.
 */
export function normaliseIsbn(raw: string): string | null {
  const bare = raw
    .trim()
    // The label, including the «10» or «13» in it, which would otherwise be
    // read as the first two digits.
    .replace(/^isbn(?:[-\s]?1[03])?\s*:?\s*/i, "")
    .replace(/[\s-]/g, "")
    .toUpperCase();

  if (/^\d{13}$/.test(bare)) {
    const sum = [...bare].reduce((n, d, i) => n + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
    return sum % 10 === 0 ? bare : null;
  }

  if (/^\d{9}[\dX]$/.test(bare)) {
    const sum = [...bare].reduce((n, d, i) => n + (d === "X" ? 10 : Number(d)) * (10 - i), 0);
    if (sum % 11 !== 0) return null;

    const body = `978${bare.slice(0, 9)}`;
    const total = [...body].reduce((n, d, i) => n + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
    return `${body}${(10 - (total % 10)) % 10}`;
  }

  return null;
}

/** What a catalogue knows about an edition. Any of it may be missing. */
export type BookFacts = {
  title: string | null;
  author: string | null;
  pages: number | null;
  source: string;
};

const fieldNames = { title: "título", author: "autor", pages: "páginas" } as const;

/**
 * Fills the blank fields from a catalogue and leaves the rest alone.
 *
 * What the operator already typed wins, always: the catalogue's title for a
 * Spanish edition is often the English one, or carries a subtitle nobody says
 * out loud, and silently replacing a field someone chose is the one thing an
 * autofill must never do.
 */
export function fillFromFacts(
  draft: BookDraft,
  facts: BookFacts,
): { draft: BookDraft; filled: string[] } {
  const next = { ...draft };
  const filled: string[] = [];

  if (!draft.title.trim() && facts.title) {
    next.title = facts.title;
    filled.push(fieldNames.title);
  }
  if (!draft.author.trim() && facts.author) {
    next.author = facts.author;
    filled.push(fieldNames.author);
  }
  if (!draft.pages.trim() && facts.pages !== null && facts.pages > 0) {
    next.pages = String(facts.pages);
    filled.push(fieldNames.pages);
  }

  return { draft: next, filled };
}
