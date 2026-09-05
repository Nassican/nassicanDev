import type { Metadata } from "next";
import MediaLibrary from "@/components/MediaLibrary";
import { listMedia, mediaTotals } from "@/lib/media-library";
import { deleteMedia, saveMediaText } from "./actions";

export const metadata: Metadata = { title: "Multimedia" };

export default async function MultimediaPage() {
  const [items, totals] = await Promise.all([listMedia(), mediaTotals()]);

  return (
    <MediaLibrary
      items={items}
      totals={totals}
      actions={{ saveText: saveMediaText, remove: deleteMedia }}
    />
  );
}
