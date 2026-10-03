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
