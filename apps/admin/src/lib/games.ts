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

export type StoreRow = { id: string; key: string; name: string; uses: number };

export type GameRow = {
  id: string;
  title: string;
  platform: GamePlatform;
  storeId: string | null;
  storeName: string | null;
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
  /** The shops, so the editor and the filter read the same list. */
  stores: StoreRow[];
};

export async function getGames(): Promise<GamesSummary> {
  // One Promise.all: the shops do not depend on the games, so asking after
  // would cost a whole round trip for a list of four rows.
  const [rows, stores] = await Promise.all([
    db.game.findMany({
      orderBy: [{ status: "asc" }, { title: "asc" }],
      include: { store: { select: { name: true } } },
    }),
    listStores(),
  ]);

  const games: GameRow[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    platform: row.platform,
    storeId: row.storeId,
    storeName: row.store?.name ?? null,
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
    wishlist: 0,
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

    /*
     * A wishlist price is what you expect to pay, not what you paid. Letting it
     * into either total would report money spent that still sits in the bank —
     * the one way these figures could lie without looking wrong.
     */
    if (game.price !== null && game.status !== "wishlist") {
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
    stores,
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
    storeId: draft.store === "" ? null : draft.store,
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

export async function listStores(): Promise<StoreRow[]> {
  const rows = await db.gameStore.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: { _count: { select: { games: true } } },
  });
  return rows.map((r) => ({ id: r.id, key: r.key, name: r.name, uses: r._count.games }));
}

/**
 * A new shop.
 *
 * The key is derived from the name rather than asked for: it exists so an import
 * can match, and making the operator invent one is asking for a decision they
 * have no information to make.
 */
export async function createStore(
  name: string,
): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  const clean = name.trim();
  if (!clean) return { ok: false, reason: "Falta el nombre." };

  const key = clean
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const existing = await db.gameStore.findUnique({ where: { key } });
  if (existing) return { ok: false, reason: `Ya existe «${existing.name}».` };

  const last = await db.gameStore.findFirst({
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const row = await db.gameStore.create({
    data: { key, name: clean, position: (last?.position ?? -1) + 1 },
  });
  return { ok: true, id: row.id };
}

/**
 * Deleting a shop does not delete the games bought there.
 *
 * The foreign key is `SetNull`, so they keep their launcher and lose only the
 * answer to "where did this come from" — which is already optional, and is the
 * mild outcome. Refusing instead would mean a shop that closed can never be
 * tidied away.
 */
export async function removeStore(id: string): Promise<{ name: string; orphaned: number }> {
  const row = await db.gameStore.findUnique({
    where: { id },
    select: { name: true, _count: { select: { games: true } } },
  });
  if (!row) return { name: "", orphaned: 0 };

  await db.gameStore.delete({ where: { id } });
  return { name: row.name, orphaned: row._count.games };
}
