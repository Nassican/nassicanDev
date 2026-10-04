import type { Metadata } from "next";
import TrashModule from "@/components/TrashModule";
import { TRASH_DAYS, kindLabels, listTrash } from "@/lib/trash";
import { destroyItem, restoreItem } from "./actions";

export const metadata: Metadata = { title: "Papelera" };

export default async function PapeleraPage() {
  const entries = await listTrash();

  return (
    <TrashModule
      days={TRASH_DAYS}
      entries={entries.map((e) => ({
        ...e,
        kindLabel: kindLabels[e.kind],
        deletedAt: e.deletedAt.toISOString(),
        expiresAt: e.expiresAt.toISOString(),
      }))}
      actions={{ restoreItem, destroyItem }}
    />
  );
}
