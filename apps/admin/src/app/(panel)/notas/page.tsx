import type { Metadata } from "next";
import NotesModule from "@/components/NotesModule";
import { listNotes } from "@/lib/notes";
import { deleteNote, noteToArticle, pinNote, saveNoteAction } from "./actions";

export const metadata: Metadata = { title: "Notas" };

export default async function NotasPage() {
  const notes = await listNotes();
  return (
    <NotesModule
      notes={notes}
      actions={{ save: saveNoteAction, pin: pinNote, remove: deleteNote, toArticle: noteToArticle }}
    />
  );
}
