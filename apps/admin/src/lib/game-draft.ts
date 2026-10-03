import type { GamePlatform, GameStatus } from "@nassican/db";
import { fieldProblems } from "@/lib/draft-fields";

/**
 * Re-exported so the games module and its tests keep importing from one place.
 * The implementations moved to `draft-fields.ts` when Libros needed them too.
 */
export { blankToNull, isPartialDate, parseNumber } from "@/lib/draft-fields";

/**
 * The shape a game has while it is being edited, and the rules that decide
 * whether it can be saved.
 *
 * Separate from `games.ts` for the reason CLAUDE.md gives: the editor is a client
 * component, so anything it imports must not reach Prisma. The enums arrive
 * through `import type`, which is erased at compile time.
 */

export type GameDraft = {
  id: string;
  title: string;
  platform: GamePlatform;
  /** The store row id. Empty when you no longer remember, which is fine. */
  store: string;
  status: GameStatus;
  /** Kept as the typed string so an empty field is not silently a zero. */
  hours: string;
  price: string;
  purchasedAt: string;
  finishedAt: string;
  note: string;
};

export const platforms: { value: GamePlatform; label: string }[] = [
  { value: "ubisoft", label: "Ubisoft Connect" },
  { value: "gog", label: "GOG" },
  { value: "steam", label: "Steam" },
  { value: "epic", label: "Epic" },
  { value: "xbox", label: "Xbox" },
  { value: "playstation", label: "PlayStation" },
  { value: "microsoft", label: "Microsoft / Mojang" },
  { value: "other", label: "Otra" },
];

export const statuses: { value: GameStatus; label: string; hint: string }[] = [
  { value: "wishlist", label: "Lo quiero", hint: "Todavía no es tuyo" },
  { value: "backlog", label: "Sin empezar", hint: "Comprado y nunca abierto" },
  { value: "playing", label: "Jugando", hint: "En curso ahora mismo" },
  { value: "finished", label: "Terminado", hint: "Llegaste al final" },
  { value: "dropped", label: "Abandonado", hint: "Lo dejaste y no vas a volver" },
];

export const platformLabel = (p: GamePlatform): string =>
  platforms.find((x) => x.value === p)?.label ?? p;

export const statusLabel = (s: GameStatus): string =>
  statuses.find((x) => x.value === s)?.label ?? s;

export function emptyGame(): GameDraft {
  return {
    id: "",
    title: "",
    platform: "other",
    store: "",
    status: "backlog",
    hours: "",
    price: "",
    purchasedAt: "",
    finishedAt: "",
    note: "",
  };
}

/**
 * Why a draft cannot be saved, in the words the panel shows.
 *
 * Returns every problem rather than the first: a form that reveals its
 * objections one at a time makes you submit four times to learn four things.
 */
export function gameProblems(draft: GameDraft): string[] {
  const problems: string[] = [];

  if (!draft.title.trim()) problems.push("Falta el título.");

  problems.push(
    ...fieldProblems([
      { label: "compra", value: draft.purchasedAt, kind: "date" },
      { label: "fin", value: draft.finishedAt, kind: "date" },
      { label: "Las horas", value: draft.hours, kind: "amount" },
      { label: "El precio", value: draft.price, kind: "amount" },
    ]),
  );

  /*
   * A finish date on something you never started is the one combination that is
   * not a typo in one field but a contradiction between two, so it is worth
   * naming instead of saving quietly.
   */
  if (draft.finishedAt.trim() && draft.status === "backlog") {
    problems.push("Tiene fecha de fin pero está marcado como sin empezar.");
  }

  return problems;
}
