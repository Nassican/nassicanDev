/**
 * Seeds the games library from the Wallet mirror, once.
 *
 * The library is **independent** of Wallet by design — a gift or an Epic giveaway
 * has no payment record, so deriving the list on every read would make «juegos
 * que no he abierto» wrong. But six years of purchase notes already name most of
 * the titles, and typing a hundred of them back in by hand would be work for
 * nothing. So this runs once, writes plain `games` rows, and is then irrelevant:
 * nothing reads Wallet afterwards.
 *
 *   npm run games:import -- --dry   informa sin escribir
 *   npm run games:import            escribe
 *
 * Idempotent by title, so running it twice adds nothing.
 */
import { db } from "@nassican/db";
import type { GamePlatform } from "@nassican/db";

const dry = process.argv.includes("--dry");

/** Accents stripped and case folded, so "Pokémon" and "pokemon" are one title. */
const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Lines that are not games.
 *
 * This category holds the subscriptions too — Claude, Netflix, Google One,
 * Duolingo, Hostinger — and a few bank labels that name no product at all. Two
 * naive groupings already produced confident wrong answers about these rows, so
 * nothing is guessed: the dry run prints both lists and the operator checks.
 */
const NOT_A_GAME = [
  // Services billed monthly that happen to land in this category.
  "netflix", "anthropic", "claude", "deepseek", "duolingo", "hostinger",
  "rappi", "meli+", "mercadolibre", "budgetbakers", "google", "hostinger",
  // Bank labels that name no product.
  "compra en", "servicios web",
  // Markers and gifts bought for other people: not this library.
  "[regalos]", "regalo enviado", "suscripcion", "suscripción",
];

/** Gifts, when the word is a suffix on an otherwise real title. */
const GIFT_SUFFIX = /\s+regalos?$/i;

/**
 * A line that is only an instalment marker names no product.
 *
 * The Hostinger charge is annotated «Diferido a 1 mes» and nothing else, so the
 * note-only check let it through and the dry run showed a game called «Diferido
 * a 1 mes». Two fixes: the vendor is now checked as well as the note, and a line
 * that is nothing but this phrase is skipped on its own.
 */
const ONLY_INSTALMENT = /^diferido a \d+ (mes|meses|cuotas?)$/i;

/** The shop sometimes says where it is played. Most rows say nothing. */
function platformFrom(counterParty: string | null): GamePlatform {
  const p = fold(counterParty ?? "");
  if (p.includes("steam")) return "steam";
  if (p.includes("ubisoft")) return "ubisoft";
  if (p.includes("gog")) return "gog";
  if (p.includes("epic")) return "epic";
  // Eneba resells keys for every launcher, so it says nothing about where the
  // game ends up. `other` is the honest answer, not a guess.
  return "other";
}

/** `Juego de MiSide` is a label around a title, not the title. */
const cleanTitle = (raw: string) =>
  raw.replace(/^juego de\s+/i, "").replace(/\s+/g, " ").trim();

async function main() {
  const records = await db.walletRecord.findMany({
    where: { categoryName: { contains: "game", mode: "insensitive" } },
    orderBy: { recordDate: "asc" },
    select: {
      recordDate: true,
      amount: true,
      counterParty: true,
      note: true,
    },
  });

  const existing = new Set(
    (await db.game.findMany({ select: { title: true } })).map((g) => fold(g.title)),
  );

  type Candidate = {
    title: string;
    platform: GamePlatform;
    price: number | null;
    purchasedAt: string;
    note: string | null;
  };

  const take: Candidate[] = [];
  const skip: { line: string; why: string }[] = [];
  const seen = new Set(existing);

  for (const record of records) {
    const lines = (record.note ?? "")
      .split(/\r?\n/)
      .map(cleanTitle)
      .filter(Boolean);

    if (lines.length === 0) {
      skip.push({ line: `(${record.recordDate.toISOString().slice(0, 10)})`, why: "sin nota" });
      continue;
    }

    const charge = Math.abs(Number(record.amount));
    const day = record.recordDate.toISOString().slice(0, 10);

    for (const line of lines) {
      const folded = fold(line);

      // The vendor counts as much as the note: a line can name no product at
      // all and still belong to a service, which is how «Diferido a 1 mes»
      // nearly became a game called that.
      const vendor = fold(record.counterParty ?? "");
      const deny = NOT_A_GAME.find(
        (word) => folded.includes(word) || (vendor !== "" && vendor.includes(word)),
      );
      if (deny) {
        skip.push({ line, why: `contiene «${deny}»` });
        continue;
      }
      if (ONLY_INSTALMENT.test(line)) {
        skip.push({ line, why: "solo dice que fue diferido" });
        continue;
      }
      if (GIFT_SUFFIX.test(line)) {
        skip.push({ line, why: "regalo para otra persona" });
        continue;
      }
      if (seen.has(folded)) {
        skip.push({ line, why: "ya está en la biblioteca" });
        continue;
      }
      seen.add(folded);

      /*
       * A charge covering several titles gets **no price at all**, and the total
       * goes in the note instead. Splitting 13.131 across seventeen Valve games
       * as 772 each would invent a precision nobody has, and the module's whole
       * contract is that an empty price means «no sé» rather than a number to be
       * trusted. One real figure or none.
       */
      const shared = lines.length > 1;

      take.push({
        title: line,
        platform: platformFrom(record.counterParty),
        price: shared ? null : charge,
        purchasedAt: day,
        note: shared
          ? `Parte de una compra de ${lines.length} títulos por ${charge.toLocaleString("es-CO")}`
          : null,
      });
    }
  }

  console.log(`movimientos leídos      : ${records.length}`);
  console.log(`títulos a importar      : ${take.length}`);
  console.log(`líneas descartadas      : ${skip.length}`);

  const byReason = new Map<string, number>();
  for (const s of skip) byReason.set(s.why, (byReason.get(s.why) ?? 0) + 1);
  console.log("\n--- por qué se descarta ---");
  for (const [why, n] of [...byReason].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${why}`);
  }

  console.log("\n--- descartadas, una por una (revísalas) ---");
  for (const s of skip) console.log(`  ${s.line.slice(0, 54).padEnd(55)} ${s.why}`);

  console.log("\n--- se importarían ---");
  for (const c of take) {
    console.log(
      `  ${c.purchasedAt}  ${c.platform.padEnd(8)} ${(c.price === null ? "—" : String(c.price)).padStart(7)}  ${c.title.slice(0, 52)}`,
    );
  }

  if (dry) {
    console.log("\n--dry: no se escribió nada.");
  } else {
    // Every row lands as `backlog`, which is the schema default and a lie worth
    // naming: nothing here knows what was played. It is the starting point the
    // operator corrects from the list, where the status is one select away.
    await db.game.createMany({
      data: take.map((c) => ({
        title: c.title,
        platform: c.platform,
        price: c.price,
        purchasedAt: c.purchasedAt,
        note: c.note,
      })),
    });
    console.log(`\nescritos ${take.length} juegos, todos como «sin empezar».`);
    console.log("Corrige el estado desde la lista: es un select por fila.");
  }

  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
