import type { Metadata } from "next";
import MediaLibrary from "@/components/MediaLibrary";
import { listFolders, listMedia, mediaTotals } from "@/lib/media-library";
import {
  createFolder,
  deleteFolder,
  deleteMedia,
  moveMedia,
  renameFolder,
  saveMediaText,
  trashMedia,
} from "./actions";

export const metadata: Metadata = { title: "Multimedia" };

export default async function MultimediaPage() {
  const [items, folders, totals] = await Promise.all([listMedia(), listFolders(), mediaTotals()]);

  return (
    <MediaLibrary
      items={items}
      folders={folders}
      totals={totals}
      actions={{
        saveText: saveMediaText,
        remove: deleteMedia,
        createFolder,
        renameFolder,
        deleteFolder,
        move: moveMedia,
        trash: trashMedia,
      }}
    />
  );
}
