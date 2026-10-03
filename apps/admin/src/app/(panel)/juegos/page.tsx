import type { Metadata } from "next";
import GamesModule from "@/components/GamesModule";
import { getGames } from "@/lib/games";
import { addStore, deleteGame, deleteStore, saveGame, setGameStatus } from "./actions";

export const metadata: Metadata = { title: "Juegos" };

export default async function JuegosPage() {
  const summary = await getGames();

  return (
    <GamesModule
      summary={summary}
      actions={{
        save: saveGame,
        remove: deleteGame,
        setStatus: setGameStatus,
        addStore,
        removeStore: deleteStore,
      }}
    />
  );
}
