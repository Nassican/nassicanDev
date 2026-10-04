import type { Metadata } from "next";
import JournalModule from "@/components/JournalModule";
import { getWeek } from "@/lib/journal";
import { addEntry, deleteEntry, saveWeekNote, updateEntry } from "./actions";

export const metadata: Metadata = { title: "Bitácora" };

/** The week lives in the URL, so a past week is a link and «atrás» works. */
export default async function BitacoraPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>;
}) {
  const view = await getWeek((await searchParams).semana);

  return (
    <JournalModule
      key={view.monday}
      view={view}
      actions={{ add: addEntry, update: updateEntry, remove: deleteEntry, saveWeek: saveWeekNote }}
    />
  );
}
