import type { Metadata } from "next";
import EditorialModule from "@/components/EditorialModule";
import { getEditorial } from "@/lib/editorial";
import { deleteIdea, moveIdea, saveIdea, startWriting } from "./actions";

export const metadata: Metadata = { title: "Calendario editorial" };

/** The month lives in the URL, so a month is a link and «atrás» works. */
export default async function CalendarioPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const view = await getEditorial((await searchParams).mes);
  return (
    <EditorialModule
      view={view}
      actions={{ save: saveIdea, move: moveIdea, write: startWriting, remove: deleteIdea }}
    />
  );
}
