import type { Metadata } from "next";
import Link from "next/link";
import { BsArrowRight } from "react-icons/bs";
import { getPersonalOverview } from "@/lib/personal";

export const metadata: Metadata = { title: "Personal" };

const money = (n: number) =>
  n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

const label = "font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500";

/**
 * The three personal modules at once.
 *
 * Each of them answers its own question well, and none answers the one you
 * arrive with — *¿cómo voy?* — because that is a comparison and lives between
 * them. Nothing here is editable on purpose: this is where you look before
 * deciding which module to open.
 */
export default async function PersonalPage() {
  const { games, books, money: wallet } = await getPersonalOverview();

  const wishlist = games.wishlist + books.wishlist;
  const backlogSpend = games.backlogSpend + books.backlogSpend;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Personal</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Lo que no es el sitio. Un vistazo a las tres cosas antes de abrir
          cualquiera.
        </p>
      </header>

      {/*
        Both piles together and above everything, because that is the figure the
        three modules were built to produce and the only one that crosses them.
      */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Sin empezar"
          value={String(games.backlog + books.backlog)}
          note={backlogSpend > 0 ? `${money(backlogSpend)} sin abrir` : undefined}
          tone={games.backlog + books.backlog > 0 ? "warn" : "plain"}
        />
        <Stat
          label="En curso"
          value={String(games.playing + books.reading)}
          note={`${games.playing} ${games.playing === 1 ? "juego" : "juegos"} · ${books.reading} ${books.reading === 1 ? "libro" : "libros"}`}
        />
        <Stat
          label="Terminados"
          value={String(games.finished + books.finished)}
          note={games.hours > 0 ? `${Math.round(games.hours)} h registradas` : undefined}
        />
        <Stat
          label="Lo quiero"
          value={String(wishlist)}
          note={wishlist === 0 ? "Nada pendiente de comprar" : "Todavía no son tuyos"}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Movimientos"
          href="/finanzas"
          action="Abrir"
          empty={wallet.balance === null}
          emptyNote="Wallet no se ha sincronizado todavía."
        >
          {/*
            Separated because the net figure alone was unreadable: it came out
            negative, which says «debes» when half of it is money sitting in
            Nequi. Two numbers answer two questions; one answers neither.
          */}
          <Line label="Lo que tengo" value={money(wallet.assets)} strong />
          <Line label="Lo que debo" value={money(wallet.debts)} strong tone="debt" />
          {wallet.balance !== null ? (
            <Line label="Diferencia" value={money(wallet.balance)} />
          ) : null}

          <div className="mt-2 border-t border-neutral-900 pt-2">
            <Line label={`Gastado en ${wallet.monthLabel}`} value={money(wallet.monthSpend)} />
          </div>

          {wallet.topCategories.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-1">
              {wallet.topCategories.map((c) => (
                <li key={c.name} className="flex justify-between gap-3 text-[11px]">
                  <span className="truncate text-neutral-500">{c.name}</span>
                  <span className="shrink-0 font-mono text-neutral-400">{money(c.total)}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {/*
            The debt figure inherits a known lie and has to say so. A card in
            `creditCardManual` mode with no starting balance is the plain sum of
            what has been written down since tracking began, so anything owed
            before that is in no part of the number — and it looks far too small
            with nothing explaining why. Already named per account in
            Movimientos; a total that absorbed it quietly would be the same
            problem one level up.
          */}
          {wallet.understated > 0 ? (
            <p className="mt-2 text-[11px] text-amber-500">
              Debes más: {wallet.understated}{" "}
              {wallet.understated === 1 ? "tarjeta no tiene" : "tarjetas no tienen"} saldo
              inicial, así que solo cuenta lo registrado desde el primer movimiento.
            </p>
          ) : null}

          {wallet.outsideStats !== 0 ? (
            <p className="mt-1 text-[10px] text-neutral-600">
              Incluye {money(wallet.outsideStats)} en cuentas que marcaste fuera de
              estadísticas en Wallet.
            </p>
          ) : null}

          {/*
            Said out loud because this mirror is the only one with no scheduler:
            a figure that has not moved in a week looks exactly like a quiet week.
          */}
          <p className="mt-1 text-[10px] text-neutral-600">
            {wallet.lastSync
              ? `Sincronizado ${wallet.lastSync.toLocaleDateString("es-CO")}. Wallet se actualiza a mano.`
              : "Wallet se sincroniza a mano desde Movimientos."}
          </p>
        </Panel>

        <Panel title="Juegos" href="/juegos" action="Abrir" empty={games.total === 0} emptyNote="Todavía no hay nada.">
          <Line label="En la biblioteca" value={String(games.total)} strong />
          <Line label="Sin empezar" value={String(games.backlog)} />
          <Line label="Jugando" value={String(games.playing)} />
          <Line label="Terminados" value={String(games.finished)} />
          {games.backlogSpend > 0 ? (
            <Line label="Comprado y sin abrir" value={money(games.backlogSpend)} />
          ) : null}
        </Panel>

        <Panel title="Libros" href="/libros" action="Abrir" empty={books.total === 0} emptyNote="Todavía no hay nada.">
          <Line label="En la estantería" value={String(books.total)} strong />
          <Line label="Sin empezar" value={String(books.backlog)} />
          <Line label="Leyendo" value={String(books.reading)} />
          <Line label="Terminados" value={String(books.finished)} />
          {books.backlogSpend > 0 ? (
            <Line label="Comprado y sin abrir" value={money(books.backlogSpend)} />
          ) : null}
        </Panel>
      </div>
    </div>
  );
}

function Stat({
  label: text,
  value,
  note,
  tone = "plain",
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "plain" | "warn";
}) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-lg border p-4 ${
        tone === "warn" ? "border-amber-900/50 bg-amber-950/15" : "border-neutral-900"
      }`}
    >
      <span className={label}>{text}</span>
      <span className="text-2xl font-semibold tracking-tight text-neutral-100">{value}</span>
      {note ? <span className="text-[11px] text-neutral-600">{note}</span> : null}
    </div>
  );
}

function Panel({
  title,
  href,
  action,
  empty,
  emptyNote,
  children,
}: {
  title: string;
  href: string;
  action: string;
  empty?: boolean;
  emptyNote?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-neutral-900 p-5">
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Link
          href={href}
          className="group inline-flex items-center gap-1 text-xs text-neutral-500 transition-colors hover:text-neutral-300"
        >
          {action}
          <BsArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </header>

      {empty ? (
        <p className="py-4 text-sm text-neutral-500">{emptyNote}</p>
      ) : (
        <div className="flex flex-col gap-1.5">{children}</div>
      )}
    </section>
  );
}

function Line({
  label: text,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "debt";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-neutral-500">{text}</span>
      <span
        className={`font-mono ${strong ? "text-sm" : "text-xs"} ${
          tone === "debt"
            ? "text-red-400"
            : strong
              ? "text-neutral-100"
              : "text-neutral-400"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
