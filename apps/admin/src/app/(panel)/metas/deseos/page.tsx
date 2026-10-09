import type { Metadata } from "next";
import WishlistModule from "@/components/WishlistModule";
import { getWishlist } from "@/lib/wishes";
import {
  buyWish,
  changeWishStatus,
  deleteWish,
  moveSavingsAction,
  removeSaving,
  saveMoney,
  saveWishAction,
} from "./actions";

export const metadata: Metadata = { title: "Lista de deseos" };

export default async function DeseosPage() {
  const view = await getWishlist();
  return (
    <WishlistModule
      view={view}
      actions={{
        save: saveWishAction,
        saveMoney,
        removeSaving,
        moveSavings: moveSavingsAction,
        buy: buyWish,
        setStatus: changeWishStatus,
        remove: deleteWish,
      }}
    />
  );
}
