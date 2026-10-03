import "server-only";

import { db } from "@nassican/db";
import type { GamePlatform, GameStatus } from "@nassican/db";
import { blankToNull, parseNumber, type GameDraft } from "@/lib/game-draft";

/**
 * Reading and writing the games library.
 *
 * Everything the panel shows comes from one query. The list is a few hundred
 * rows at most and every figure on the page is a fold over it, so a second
 * round trip to count what is already in memory would be the whole cost of the
 * page for nothing — the rule that `getStats` had to learn the hard way.
 */

export type GameRow = {
  id: string;
  title: string;
  platform: GamePlatform;
  status: GameStatus;
  hours: number | null;
  price: number | null;
  purchasedAt: string | null;
  finishedAt: string | null;
  note: string | null;
};

export type GamesSummary = {
  games: GameRow[];
  counts: Record<GameStatus, number>;
  /** What the backlog cost: the number the module exists to show. */
  unplayedSpend: number;
  totalSpend: number;
  hoursPlayed: number;
  /** Only over games that have both a price and hours, or it means nothing. */
  costPerHour: number | null;
  byPlatform: { platform: GamePlatform; count: number }[];
};

export async function getGames(): Promise<GamesSummary> {
  const rows = await db.game.findMany({
    orderBy: [{ status: "asc" }, { title: "asc" }],
  });

  const games: GameRow[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    platform: row.platform,
    status: row.status,
    hours: row.hours,
    // Decimal does not survive the trip to a client component, so it becomes a
    // number here rather than in the component that renders it.
    price: row.price === null ? null : Number(row.price),
    purchasedAt: row.purchasedAt,
    finishedAt: row.finishedAt,
    note: row.note,
  }));

  const counts: Record<GameStatus, number> = {
    backlog: 0,
    playing: 0,
    finished: 0,
    dropped: 0,
  };

  let unplayedSpend = 0;
  let totalSpend = 0;
  let hoursPlayed = 0;
  let pricedHours = 0;
  let pricedSpend = 0;
  const platforms = new Map<GamePlatform, number>();

  for (const game of games) {
    counts[game.status] += 1;
    platforms.set(game.platform, (platforms.get(game.platform) ?? 0) + 1);

    if (game.price !== null) {
      totalSpend += game.price;
      if (game.status === "backlog") unplayedSpend += game.price;
    }

    if (game.hours !== null) {
      hoursPlayed += game.hours;
      /*
       * Cost per hour only counts games that have both numbers. Dividing total
       * spend by total hours would charge the games you did play for the ones
       * you never priced, and the answer would drift every time a row is half
       * filled in.
       */
      if (game.price !== null && game.hours > 0) {
        pricedHours += game.hours;
        pricedSpend += game.price;
      }
    }
  }

  return {
    games,
    counts,
    unplayedSpend,
    totalSpend,
    hoursPlayed,
    costPerHour: pricedHours > 0 ? pricedSpend / pricedHours : null,
    byPlatform: [...platforms.entries()]
      .map(([platform, count]) => ({ platform, count }))
      .sort((a, b) => b.count - a.count),
  };
}

/**
 * The values a draft turns into on the way to the database.
 *
 * Reads the numbers with the same `parseNumber` the form validates with. It had
 * its own copy of that logic for a while, which meant the thousands-separator
 * bug existed in two places and could have been fixed in only one.
 */
function toRow(draft: GameDraft) {
  return {
    title: draft.title.trim(),
    platform: draft.platform,
    status: draft.status,
    hours: parseNumber(draft.hours),
    price: parseNumber(draft.price),
    purchasedAt: blankToNull(draft.purchasedAt),
    finishedAt: blankToNull(draft.finishedAt),
    note: blankToNull(draft.note),
  };
}

export async function createGame(draft: GameDraft): Promise<string> {
  const game = await db.game.create({ data: toRow(draft) });
  return game.id;
}

export async function updateGame(draft: GameDraft): Promise<void> {
  await db.game.update({ where: { id: draft.id }, data: toRow(draft) });
}

export async function removeGame(id: string): Promise<void> {
  await db.game.delete({ where: { id } });
}

/**
 * Titles already in the library, folded for comparison.
 *
 * Used to warn before adding a duplicate rather than to refuse one: a remaster
 * and its original share a name often enough that blocking it would be wrong,
 * and two copies on different launchers is a real thing to record.
 */
export async function existingTitles(): Promise<string[]> {
  const rows = await db.game.findMany({ select: { title: true } });
  return rows.map((r) => r.title);
}

/**
 * Status alone, for the list.
 *
 * The field that changes most often, and the one change worth making without
 * opening the editor: marking three games as finished should not be three trips
 * through a form.
 */
export async function setStatus(id: string, status: GameStatus): Promise<string> {
  const game = await db.game.update({ where: { id }, data: { status } });
  return game.title;
}
