import type { Metadata } from "next";
import BooksModule from "@/components/BooksModule";
import { getBooks } from "@/lib/books";
import { deleteBook, saveBook, setBookStatus } from "./actions";

export const metadata: Metadata = { title: "Libros" };

export default async function LibrosPage() {
  const summary = await getBooks();

  return (
    <BooksModule
      summary={summary}
      actions={{ save: saveBook, remove: deleteBook, setStatus: setBookStatus }}
    />
  );
}
