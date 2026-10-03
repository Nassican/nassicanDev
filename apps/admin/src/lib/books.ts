import "server-only";

import { db } from "@nassican/db";
import type { BookFormat, BookStatus } from "@nassican/db";
import { blankToNull, parseNumber } from "@/lib/draft-fields";
import type { BookDraft } from "@/lib/book-draft";

/**
 * Reading and writing the books library. Same shape as `games.ts`: one query,
 * every figure a fold over it.
 */

export type BookRow = {
  id: string;
  title: string;
  author: string | null;
  format: BookFormat;
  status: BookStatus;
  pages: number | null;
  pagesRead: number | null;
  price: number | null;
  purchasedAt: string | null;
  finishedAt: string | null;
  note: string | null;
};

export type BooksSummary = {
  books: BookRow[];
  counts: Record<BookStatus, number>;
  unreadSpend: number;
  totalSpend: number;
  pagesRead: number;
  /** Only over finished books with a page count, or the average means nothing. */
  averageLength: number | null;
  byAuthor: { author: string; count: number }[];
};

export async function getBooks(): Promise<BooksSummary> {
  const rows = await db.book.findMany({
    orderBy: [{ status: "asc" }, { title: "asc" }],
  });

  const books: BookRow[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    author: row.author,
    format: row.format,
    status: row.status,
    pages: row.pages,
    pagesRead: row.pagesRead,
    // Decimal does not survive the trip to a client component.
    price: row.price === null ? null : Number(row.price),
    purchasedAt: row.purchasedAt,
    finishedAt: row.finishedAt,
    note: row.note,
  }));

  const counts: Record<BookStatus, number> = {
    wishlist: 0,
    backlog: 0,
    reading: 0,
    finished: 0,
    dropped: 0,
  };

  let unreadSpend = 0;
  let totalSpend = 0;
  let pagesRead = 0;
  let finishedPages = 0;
  let finishedWithPages = 0;
  const authors = new Map<string, number>();

  for (const book of books) {
    counts[book.status] += 1;

    if (book.author?.trim()) {
      authors.set(book.author, (authors.get(book.author) ?? 0) + 1);
    }

    // A wishlist price is what you expect to pay, not what you paid.
    if (book.price !== null && book.status !== "wishlist") {
      totalSpend += book.price;
      if (book.status === "backlog") unreadSpend += book.price;
    }

    /*
     * A finished book counts its whole length, read or not: nobody updates
     * `pagesRead` on the last page, so trusting it would undercount every book
     * ever finished. For anything unfinished, what was recorded is what counts.
     */
    if (book.status === "finished" && book.pages !== null) {
      pagesRead += book.pages;
      finishedPages += book.pages;
      finishedWithPages += 1;
    } else if (book.pagesRead !== null) {
      pagesRead += book.pagesRead;
    }
  }

  return {
    books,
    counts,
    unreadSpend,
    totalSpend,
    pagesRead,
    averageLength: finishedWithPages > 0 ? finishedPages / finishedWithPages : null,
    byAuthor: [...authors.entries()]
      .map(([author, count]) => ({ author, count }))
      .filter((a) => a.count > 1)
      .sort((a, b) => b.count - a.count),
  };
}

function toRow(draft: BookDraft) {
  const whole = (value: string): number | null => {
    const n = parseNumber(value);
    return n === null ? null : Math.round(n);
  };

  return {
    title: draft.title.trim(),
    author: blankToNull(draft.author),
    format: draft.format,
    status: draft.status,
    pages: whole(draft.pages),
    pagesRead: whole(draft.pagesRead),
    price: parseNumber(draft.price),
    purchasedAt: blankToNull(draft.purchasedAt),
    finishedAt: blankToNull(draft.finishedAt),
    note: blankToNull(draft.note),
  };
}

export async function createBook(draft: BookDraft): Promise<string> {
  const book = await db.book.create({ data: toRow(draft) });
  return book.id;
}

export async function updateBook(draft: BookDraft): Promise<void> {
  await db.book.update({ where: { id: draft.id }, data: toRow(draft) });
}

export async function removeBook(id: string): Promise<void> {
  await db.book.delete({ where: { id } });
}

/** Status alone, for the list. */
export async function setStatus(id: string, status: BookStatus): Promise<string> {
  const book = await db.book.update({ where: { id }, data: { status } });
  return book.title;
}
