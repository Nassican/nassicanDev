/**
 * The curated purchase list, merged into the library the Wallet seed created.
 *
 * Two records of the same six years, at different granularities. The seed read
 * bank annotations and split every pack into its games — seventeen Valve titles,
 * three Outlast — but guessed the launcher from the merchant and got `other` for
 * almost everything. This list knows the **store** for every purchase, and the
 * store is not the launcher: most of the Ubisoft catalogue here was bought on
 * Steam and opens Ubisoft Connect.
 *
 *   npm run games:list -- --dry   informa sin escribir
 *   npm run games:list            escribe
 *
 * **The mapping is written out by hand, not matched by similarity.** «Assassins
 * Creed Origins» and «Assassin's Creed Origins - Standard Edition» are the same
 * purchase; «Half-Life 2» and «Half-Life 2: Episode One» are not. A fuzzy match
 * would be right most of the time, and this data has already produced two
 * confident wrong answers. Explicit is reviewable; clever is not.
 */
import { db } from "@nassican/db";
import type { GamePlatform } from "@nassican/db";

const dry = process.argv.includes("--dry");

type Purchase = {
  /** As the operator wrote it, for the report. */
  label: string;
  date: string;
  price: number;
  store: GamePlatform;
  /** Where it runs, when that differs from where it was bought. */
  platform?: GamePlatform;
  /** The rows in the library this purchase covers, by their exact titles. */
  covers: string[];
  /** Titles to create because the purchase is newer than the last Wallet sync. */
  creates?: string[];
};

const VALVE = [
  "Half-Life", "Half-Life: Opposing Force", "Half-Life: Blue Shift",
  "Half-Life 1: Source", "Half-Life 2", "Half-Life 2: Episode One",
  "Half-Life 2: Episode Two", "Portal", "Portal 2", "Counter-Strike: Source",
  "Condition Zero", "Day of Defeat", "Day of Defeat: Source",
  "Deathmatch Classic", "Team Fortress Classic", "Ricochet",
  "The Lab (Bundle-only)",
];

const PURCHASES: Purchase[] = [
  // ------------------------------------------------------------------ Steam
  { label: "Alien Isolation", date: "2020-04-26", price: 3750, store: "steam", covers: ["Alien: Isolation"] },
  { label: "Wallpaper Engine", date: "2020-04-26", price: 9500, store: "steam", covers: ["Wallpaper Engine"] },
  { label: "Black Desert Online", date: "2020-07-06", price: 8949, store: "steam", covers: ["Black Desert Online"] },
  { label: "Sleeping Dogs: Definitive Edition", date: "2020-08-04", price: 8235, store: "steam", covers: ["Sleeping Dogs: Definitive Edition"] },
  { label: "Fall Guys", date: "2020-08-21", price: 31000, store: "steam", covers: ["Fall Guys"] },
  { label: "Human Fall Flat x3", date: "2020-11-19", price: 38400, store: "steam", covers: ["Human Fall Flat"] },
  { label: "Assassins Creed Origins", date: "2020-12-23", price: 35980, store: "steam", platform: "ubisoft", covers: ["Assassin's Creed Origins - Standard Edition"] },
  { label: "PayDay 2 + Left4Dead 1 y 2", date: "2020-12-29", price: 7549, store: "steam", covers: ["PAYDAY 2", "Left 4 Dead", "Left 4 Dead 2"] },
  { label: "Metal Gear Solid V: Definitive Experience", date: "2022-09-16", price: 29750, store: "steam", covers: ["METAL GEAR SOLID V: The Definitive Experience"] },
  { label: "Pack Valve Half Life", date: "2022-11-24", price: 13131, store: "steam", covers: VALVE },
  { label: "The Forest", date: "2022-11-26", price: 7130, store: "steam", covers: ["The Forest"] },
  { label: "Outlast Pack", date: "2022-12-22", price: 10440, store: "steam", covers: ["Outlast", "Outlast 2", "Outlast: Whistleblower DLC"] },
  { label: "SubNautica", date: "2023-01-03", price: 13430, store: "steam", covers: ["Subnautica"] },
  { label: "Kingdom Come: Deliverance Royal Edition", date: "2023-03-23", price: 13625, store: "steam", covers: ["Kingdom Come: Deliverance Royal Edition"] },
  { label: "Dead Island", date: "2023-05-10", price: 6000, store: "steam", covers: ["Dead Island Definitive Edition"] },
  { label: "Assassins Creed Odyssey", date: "2023-06-30", price: 35980, store: "steam", platform: "ubisoft", covers: ["Assassin's Creed Odyssey - Standard Edition"] },
  { label: "The Walking Dead: The Telltale Definitive Series", date: "2023-10-23", price: 17125, store: "steam", covers: ["The Walking Dead: The Telltale Definitive Series"] },
  { label: "Red Dead Redemption 2", date: "2023-11-21", price: 65967, store: "steam", covers: ["Red Dead Redemption 2"] },
  { label: "Undertale", date: "2023-11-21", price: 7050, store: "steam", covers: ["Undertale"] },
  { label: "Pack (Alice Madness Returns, Mirror's Edge, Murdered Soul Suspect, DOOM)", date: "2023-11-27", price: 28859, store: "steam", covers: ["Alice Madness Returns", "Mirror's Edge™ Catalyst", "Murdered: Soul Suspect ROW", "DOOM"] },
  { label: "Hellblade Senuas Sacrifice", date: "2023-12-10", price: 9000, store: "steam", covers: ["Hellblade: Senua's Sacrifice Launch"] },
  { label: "Middle Earth Shadow of Mordor", date: "2023-12-11", price: 4037, store: "steam", covers: ["Middle-earth: Shadow of Mordor - Game of the Year Edition"] },
  { label: "Alan Wake Bundle", date: "2023-12-21", price: 8375, store: "steam", covers: ["Alan Wake Origins Bundle"] },
  { label: "Geometry Dash", date: "2023-12-21", price: 4000, store: "steam", covers: ["Geometry Dash"] },
  { label: "Lego Star Wars The Force Awakens", date: "2024-01-22", price: 3932, store: "steam", covers: ["LEGO Star Wars: The Force Awakens"] },
  { label: "Devil May Cry 5", date: "2024-03-05", price: 26301, store: "steam", covers: ["Devil May Cry 5 + Vergil"] },
  { label: "Far Cry 5", date: "2024-03-14", price: 26985, store: "steam", platform: "ubisoft", covers: ["Far Cry 5 - Standard Edition"] },
  { label: "The Crew 2", date: "2024-09-10", price: 3198, store: "steam", platform: "ubisoft", covers: ["The Crew 2 - Standard Edition"] },
  { label: "Resident Evil 7", date: "2024-09-26", price: 21360, store: "steam", covers: ["RESIDENT EVIL 7"] },
  { label: "StarWars The Force Unleashed", date: "2024-10-06", price: 8151, store: "steam", covers: ["Star Wars - The Force Unleashed Ultimate Sith Edition"] },
  { label: "Beyond: Two Souls", date: "2024-11-18", price: 14975, store: "steam", covers: ["Beyond: Two Souls"] },
  { label: "Batman Arkham Origins, The Bible", date: "2024-12-27", price: 9199, store: "steam", covers: ["Batman Arkham Origins", "The Bible"] },
  { label: "Batman Arkham Collection", date: "2024-12-29", price: 31499, store: "steam", covers: ["Batman Arkham Collection"] },
  { label: "Devil May Cry 4 + HD Collection", date: "2025-04-13", price: 37097, store: "steam", covers: ["Devil May Cry 4: Special Edition", "Devil May Cry HD Collection"] },
  { label: "DMC: Devil May Cry", date: "2025-04-14", price: 19925, store: "steam", covers: ["DmC: Devil May Cry (ROW)"] },
  { label: "Ac Origins DLC 1", date: "2025-06-27", price: 8970, store: "steam", platform: "ubisoft", covers: ["Assassin's Creed® Origins - The Hidden Ones"] },
  { label: "Ac Origins DLC 2 + BlackMesa", date: "2025-06-30", price: 22720, store: "steam", covers: ["Assassin's Creed® Origins - The Curse Of The Pharaohs", "Black Mesa"] },
  { label: "Blasphemous", date: "2025-07-05", price: 6400, store: "steam", covers: ["Blasphemous"] },
  { label: "No Man's Sky", date: "2025-07-05", price: 52000, store: "steam", covers: ["No Man's Sky"] },
  { label: "Hogwarts Legacy", date: "2025-08-31", price: 37999, store: "steam", covers: ["Hogwarts Legacy"] },
  { label: "Assassin's Creed - Rogue Deluxe", date: "2025-09-10", price: 13485, store: "steam", platform: "ubisoft", covers: ["Assassin's Creed - Rogue Deluxe"] },
  { label: "Assassins Creed liberation", date: "2025-10-05", price: 9975, store: "steam", platform: "ubisoft", covers: ["Assassin's Creed Liberation Release"] },
  { label: "AC Odyssey: Fate of Atlantis + Legacy of the First Blade", date: "2026-06-28", price: 23970, store: "steam", platform: "ubisoft", covers: ["Assassin's Creed Odyssey - The Fate of Atlantis", "Assassin's Creed Odyssey - Legacy of the First Blade"] },
  { label: "Ryse + The Invincible + I Am Jesus Christ + Out of Reach", date: "2026-07-09", price: 34225, store: "steam", covers: ["Ryse: Son of Rome", "The Invincible", "I Am Jesus Christ", "Out of Reach: Treasure Royale"] },
  { label: "MiSide", date: "2026-09-08", price: 30000, store: "steam", covers: ["MiSide"] },
  // Newer than the last Wallet sync, so nothing to merge with.
  {
    label: "Skyrim SE + Ori and the Will of the Wisps + Detroit: Become Human",
    date: "2026-10-02", price: 37979, store: "steam", covers: [],
    creates: ["The Elder Scrolls V: Skyrim Special Edition", "Ori and the Will of the Wisps", "Detroit: Become Human"],
  },

  // ---------------------------------------------------------------- Ubisoft
  { label: "Assassins Creed Unity", date: "2020-12-23", price: 8985, store: "ubisoft", covers: ["Assassin's Creed Unity"] },
  { label: "FarCry 4", date: "2021-05-25", price: 14384, store: "ubisoft", covers: ["Far Cry 4"] },
  { label: "Assassin's Creed: Director's Cut", date: "2022-03-11", price: 14911, store: "ubisoft", covers: ["Assassin's Creed: Director's Cut Edition"] },
  { label: "FarCry Primal", date: "2022-05-24", price: 24975, store: "ubisoft", covers: ["Far Cry Primal - Apex Edition"] },
  { label: "Assassins Creed Revelations", date: "2022-07-02", price: 15813, store: "ubisoft", covers: ["Assassin's Creed Revelations"] },
  { label: "Assassins Creed Brotherhood", date: "2022-07-02", price: 15813, store: "ubisoft", covers: ["Assassin's Creed Brotherhood"] },
  { label: "Assassins Creed IV Black Flag", date: "2023-03-26", price: 15813, store: "ubisoft", covers: ["Assassin's Creed IV Black Flag"] },

  // ------------------------------------------------------------------ Otros
  { label: "The Witcher 3 Wild Hunt", date: "2020-10-02", price: 21141, store: "gog", covers: ["The Witcher 3: Wild Hunt - Complete Edition"] },
  { label: "The Witcher 2", date: "2020-10-02", price: 11577, store: "gog", covers: ["The Witcher 2: Assassins of Kings Enchanced Edition"] },
  { label: "Minecraft", date: "2020-09-15", price: 99270, store: "microsoft", covers: ["Minecraft: Java and Bedrock Edition"] },
];

async function main() {
  const existing = await db.game.findMany({
    select: { id: true, title: true, platform: true, store: true, price: true, purchasedAt: true },
  });
  const byTitle = new Map(existing.map((g) => [g.title, g]));

  const plan: { id: string; title: string; from: string; to: string }[] = [];
  const missing: { purchase: string; title: string }[] = [];
  const creating: { title: string; purchase: Purchase }[] = [];
  const touched = new Set<string>();

  for (const purchase of PURCHASES) {
    const platform = purchase.platform ?? purchase.store;

    for (const title of purchase.covers) {
      const row = byTitle.get(title);
      if (!row) {
        missing.push({ purchase: purchase.label, title });
        continue;
      }
      touched.add(row.id);

      /*
       * A pack's price stays off its members, which is the rule the first import
       * set and the reason it is worth keeping: 13.131 split across seventeen
       * Valve games as 772 each would be a number nobody measured. One real
       * figure or none.
       */
      const single = purchase.covers.length === 1 && !purchase.creates;
      const price = single ? purchase.price : null;

      const from = `${row.platform}/${row.store ?? "—"} ${row.purchasedAt ?? "—"} ${row.price ?? "—"}`;
      const to = `${platform}/${purchase.store} ${purchase.date} ${price ?? "—"}`;
      if (from !== to) plan.push({ id: row.id, title, from, to });
    }

    /*
     * Checked against what is there, like every other row. Without this the
     * second run creates the same three titles again — the dry run said «se
     * crean: 3» after they had already been written, which is the whole reason
     * these scripts print before they act.
     */
    for (const title of purchase.creates ?? []) {
      const row = byTitle.get(title);
      if (row) {
        touched.add(row.id);
        continue;
      }
      creating.push({ title, purchase });
    }
  }

  const untouched = existing.filter((g) => !touched.has(g.id));

  console.log(`compras en la lista : ${PURCHASES.length}`);
  console.log(`filas que cubren    : ${touched.size} de ${existing.length}`);
  console.log(`se corrigen         : ${plan.length}`);
  console.log(`se crean            : ${creating.length}`);
  console.log(`sin mapear          : ${missing.length}`);
  console.log(`no cubiertas        : ${untouched.length} (se dejan como están)`);

  if (missing.length > 0) {
    console.log("\n--- !! en la lista y no en la base (revisa el mapeo) ---");
    for (const m of missing) console.log(`  ${m.purchase.slice(0, 34).padEnd(35)} → ${m.title}`);
  }

  console.log("\n--- se crean ---");
  for (const c of creating) console.log(`  ${c.purchase.date}  ${c.title}`);

  console.log("\n--- se corrigen ---");
  for (const p of plan) console.log(`  ${p.title.slice(0, 44).padEnd(45)} ${p.from}  →  ${p.to}`);

  console.log("\n--- no cubiertas por tu lista ---");
  for (const g of untouched) console.log(`  ${g.purchasedAt ?? "—"}  ${g.title}`);

  if (dry) {
    console.log("\n--dry: no se escribió nada.");
    await db.$disconnect();
    return;
  }

  for (const purchase of PURCHASES) {
    const platform = purchase.platform ?? purchase.store;
    const single = purchase.covers.length === 1 && !purchase.creates;

    for (const title of purchase.covers) {
      const row = byTitle.get(title);
      if (!row) continue;
      await db.game.update({
        where: { id: row.id },
        data: {
          platform,
          store: purchase.store,
          purchasedAt: purchase.date,
          price: single ? purchase.price : null,
          ...(single
            ? {}
            : { note: `Parte de «${purchase.label}» por ${purchase.price.toLocaleString("es-CO")}` }),
        },
      });
    }

    for (const title of purchase.creates ?? []) {
      if (byTitle.has(title)) continue;
      await db.game.create({
        data: {
          title,
          platform,
          store: purchase.store,
          purchasedAt: purchase.date,
          note: `Parte de «${purchase.label}» por ${purchase.price.toLocaleString("es-CO")}`,
        },
      });
    }
  }

  console.log(`\nescritos: ${plan.length} corregidos, ${creating.length} creados.`);
  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
