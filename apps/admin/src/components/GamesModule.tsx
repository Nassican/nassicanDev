"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BsPencil, BsPlus, BsTrash } from "react-icons/bs";
import Toast from "@/components/Toast";
import Unsaved from "@/components/Unsaved";
import { fold } from "@/lib/list-filters";
import {
  emptyGame,
  gameProblems,
  platformLabel,
  platforms,
  statuses,
  type GameDraft,
} from "@/lib/game-draft";
import { isDirty, useUnsavedChanges } from "@/lib/use-unsaved";
import type { GamesSummary } from "@/lib/games";
import type { ActionResult } from "@/app/(panel)/juegos/actions";

const field =
  "rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none";
const label = "font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500";
const button =
  "inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm transition-colors disabled:opacity-50";

const money = (n: number) =>
  n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

/**
 * The games library, typed in by hand.
 *
 * **Not derived from the Wallet mirror**, although the purchase notes there name
 * most of them. A library is not a payment log: a free Epic giveaway has no
 * record in Wallet at all, so deriving the list would make «juegos que no he
 * abierto» — the one figure here worth having — wrong from the first row.
 */
export default function GamesModule({
  summary,
  actions,
}: {
  summary: GamesSummary;
  actions: {
    save: (draft: GameDraft) => Promise<ActionResult>;
    remove: (id: string, title: string) => Promise<ActionResult>;
    setStatus: (id: string, status: GameDraft["status"]) => Promise<ActionResult>;
    addStore: (name: string) => Promise<ActionResult>;
    removeStore: (id: string) => Promise<ActionResult>;
  };
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<GameDraft | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [onlyStatus, setOnlyStatus] = useState<GameDraft["status"] | "">("");
  const [onlyStore, setOnlyStore] = useState("");
  const [onlyPlatform, setOnlyPlatform] = useState("");
  const [onlyPrice, setOnlyPrice] = useState<"" | "missing" | "set">("");
  const [managing, setManaging] = useState(false);
  const [newStore, setNewStore] = useState("");

  const stores = summary.stores;

  const dirty = draft !== null && isDirty(baselineFor(draft, summary), draft);
  useUnsavedChanges(dirty);

  const problems = draft ? gameProblems(draft) : [];

  function run(action: () => Promise<ActionResult>, onOk?: () => void) {
    setResult(null);
    startTransition(async () => {
      const outcome = await action();
      setResult(outcome);
      if (outcome.ok) {
        onOk?.();
        router.refresh();
      }
    });
  }

  const shown = useMemo(() => {
    const needle = fold(query);
    return summary.games.filter((game) => {
      if (onlyStatus && game.status !== onlyStatus) return false;
      if (onlyStore && game.storeId !== onlyStore) return false;
      if (onlyPlatform && game.platform !== onlyPlatform) return false;
      if (onlyPrice === "missing" && game.price !== null) return false;
      if (onlyPrice === "set" && game.price === null) return false;
      if (!needle) return true;
      return (
        fold(game.title).includes(needle) ||
        fold(platformLabel(game.platform)).includes(needle) ||
        fold(game.note ?? "").includes(needle)
      );
    });
  }, [summary.games, query, onlyStatus, onlyStore, onlyPlatform, onlyPrice]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Juegos</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Se añaden a mano, aparte de Wallet: un juego regalado o de Epic no
            tiene movimiento, y sin él la biblioteca estaría incompleta.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setDraft(emptyGame())}
          className={`${button} border-neutral-700 text-neutral-200 hover:border-neutral-500`}
        >
          <BsPlus className="h-4 w-4" aria-hidden />
          Añadir
        </button>
      </header>

      {/* ------------------------------- cifras ------------------------------ */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Sin empezar"
          value={String(summary.counts.backlog)}
          note={
            summary.unplayedSpend > 0
              ? `${money(summary.unplayedSpend)} sin abrir`
              : "Nada comprado sin abrir"
          }
          tone={summary.counts.backlog > 0 ? "warn" : "plain"}
        />
        <Stat label="Jugando" value={String(summary.counts.playing)} />
        <Stat
          label="Terminados"
          value={String(summary.counts.finished)}
          note={`${summary.counts.dropped} abandonados`}
        />
        <Stat
          label="Horas registradas"
          value={summary.hoursPlayed > 0 ? summary.hoursPlayed.toFixed(0) : "—"}
          note={
            summary.costPerHour !== null
              ? `${money(summary.costPerHour)} por hora`
              : "Faltan precios u horas para el coste por hora"
          }
        />
      </section>

      {/* ------------------------------ el editor ---------------------------- */}
      {draft ? (
        <section className="flex flex-col gap-4 rounded-lg border border-neutral-800 bg-neutral-950 p-5">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">
              {draft.id ? `Editar «${draft.title || "sin título"}»` : "Añadir un juego"}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {dirty ? <Unsaved /> : null}
              <button
                type="button"
                disabled={pending || problems.length > 0}
                title={problems.join(" ") || undefined}
                onClick={() => run(() => actions.save(draft), () => setDraft(null))}
                className={`${button} border-green-800 bg-green-950/60 text-green-300 hover:border-green-600`}
              >
                {pending ? "Guardando…" : "Guardar"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setDraft(null)}
                className={`${button} border-neutral-800 text-neutral-400 hover:border-neutral-600`}
              >
                Cancelar
              </button>
            </div>
          </header>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Labelled label="Título" className="sm:col-span-2">
              <input
                className={field}
                value={draft.title}
                autoFocus
                placeholder="Assassin's Creed Odyssey"
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </Labelled>

            <Labelled label="Dónde se juega">
              <select
                className={field}
                value={draft.platform}
                onChange={(e) =>
                  setDraft({ ...draft, platform: e.target.value as GameDraft["platform"] })
                }
              >
                {platforms.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Labelled>

            <Labelled label="Dónde se compró">
              <select
                className={field}
                value={draft.store}
                onChange={(e) =>
                  setDraft({ ...draft, store: e.target.value as GameDraft["store"] })
                }
              >
                <option value="">No lo recuerdo</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Labelled>

            <Labelled label="Estado">
              <select
                className={field}
                value={draft.status}
                onChange={(e) =>
                  setDraft({ ...draft, status: e.target.value as GameDraft["status"] })
                }
              >
                {statuses.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label} — {s.hint}
                  </option>
                ))}
              </select>
            </Labelled>

            <Labelled label="Horas">
              <input
                className={field}
                value={draft.hours}
                placeholder="vacío = sin registrar"
                onChange={(e) => setDraft({ ...draft, hours: e.target.value })}
              />
            </Labelled>

            <Labelled label="Precio (COP)">
              <input
                className={field}
                value={draft.price}
                placeholder="vacío = regalo o desconocido"
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              />
            </Labelled>

            <Labelled label="Comprado">
              <input
                className={field}
                value={draft.purchasedAt}
                placeholder="2024 · 2024-08 · 2024-08-13"
                onChange={(e) => setDraft({ ...draft, purchasedAt: e.target.value })}
              />
            </Labelled>

            <Labelled label="Terminado">
              <input
                className={field}
                value={draft.finishedAt}
                placeholder="2024 · 2024-08 · 2024-08-13"
                onChange={(e) => setDraft({ ...draft, finishedAt: e.target.value })}
              />
            </Labelled>

            <Labelled label="Nota" className="sm:col-span-2 lg:col-span-3">
              <input
                className={field}
                value={draft.note}
                placeholder="Edición, DLC, con quién lo jugaste…"
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              />
            </Labelled>
          </div>

          {problems.length > 0 ? (
            <ul className="flex flex-col gap-1 text-[11px] text-amber-500">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {/* ------------------------------- la lista ---------------------------- */}
      {summary.games.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setQuery("");
                setOnlyStatus("");
                setOnlyStore("");
                setOnlyPlatform("");
                setOnlyPrice("");
              }
            }}
            placeholder="Buscar por título, plataforma o nota…"
            className={`${field} min-w-56 flex-1`}
          />
          <select
            className={field}
            value={onlyStatus}
            onChange={(e) => setOnlyStatus(e.target.value as typeof onlyStatus)}
          >
            <option value="">Todos los estados</option>
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label} ({summary.counts[s.value]})
              </option>
            ))}
          </select>

          {/*
            Two filters and not one, for the same reason there are two fields:
            «lo compré en Steam» and «se abre en Ubisoft» are different questions
            and 9 of these games answer them differently.
          */}
          <select
            className={field}
            value={onlyPlatform}
            onChange={(e) => setOnlyPlatform(e.target.value)}
          >
            <option value="">Cualquier lanzador</option>
            {summary.byPlatform.map((p) => (
              <option key={p.platform} value={p.platform}>
                {platformLabel(p.platform)} ({p.count})
              </option>
            ))}
          </select>

          {/*
            «Sin precio» means `null`, never zero: the module keeps those apart
            on purpose — empty is «no lo sé», zero would claim it was free — so
            this finds exactly the rows still waiting to be filled in, and a gift
            recorded at 0 is not one of them.
          */}
          <select
            className={field}
            value={onlyPrice}
            onChange={(e) => setOnlyPrice(e.target.value as typeof onlyPrice)}
          >
            <option value="">Cualquier precio</option>
            <option value="missing">
              Sin precio ({summary.games.filter((g) => g.price === null).length})
            </option>
            <option value="set">
              Con precio ({summary.games.filter((g) => g.price !== null).length})
            </option>
          </select>

          {stores.length > 0 ? (
            <select
              className={field}
              value={onlyStore}
              onChange={(e) => setOnlyStore(e.target.value)}
            >
              <option value="">Cualquier tienda</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.uses})
                </option>
              ))}
            </select>
          ) : null}

          <button
            type="button"
            onClick={() => setManaging((v) => !v)}
            className="rounded border border-neutral-800 px-2.5 py-1.5 text-[11px] text-neutral-500 transition-colors hover:border-neutral-600 hover:text-neutral-300"
          >
            {managing ? "Ocultar tiendas" : "Tiendas"}
          </button>

          {shown.length !== summary.games.length ? (
            <span className="text-[11px] text-neutral-600">
              {shown.length} de {summary.games.length}
            </span>
          ) : null}
        </div>
      ) : null}

      {managing ? (
        <section className="flex flex-col gap-3 rounded-lg border border-neutral-800 bg-neutral-950 p-4">
          <h2 className={label}>Dónde se compra</h2>

          <ul className="flex flex-wrap gap-2">
            {stores.map((s) => (
              <li
                key={s.id}
                className="inline-flex items-center gap-2 rounded-full border border-neutral-800 px-3 py-1 text-xs text-neutral-300"
              >
                {s.name}
                <span className="font-mono text-[10px] text-neutral-600">{s.uses}</span>
                <button
                  type="button"
                  aria-label={`Eliminar ${s.name}`}
                  disabled={pending}
                  onClick={() => {
                    const warning =
                      s.uses > 0
                        ? `«${s.name}» está en ${s.uses} ${s.uses === 1 ? "juego" : "juegos"}. Se quedarán sin tienda, pero conservan todo lo demás. ¿Seguir?`
                        : `¿Eliminar «${s.name}»?`;
                    if (!confirm(warning)) return;
                    run(() => actions.removeStore(s.id));
                  }}
                  className="text-neutral-600 transition-colors hover:text-red-400"
                >
                  <BsTrash className="h-3 w-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-2">
            <input
              className={`${field} min-w-48`}
              value={newStore}
              placeholder="Eneba, Humble Bundle, Instant Gaming…"
              onChange={(e) => setNewStore(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newStore.trim()) {
                  run(() => actions.addStore(newStore.trim()), () => setNewStore(""));
                }
              }}
            />
            <button
              type="button"
              disabled={pending || !newStore.trim()}
              onClick={() =>
                run(() => actions.addStore(newStore.trim()), () => setNewStore(""))
              }
              className={`${button} border-neutral-700 text-neutral-200 hover:border-neutral-500`}
            >
              Añadir tienda
            </button>
          </div>

          {/*
            Deleting a shop does not delete its games: the foreign key is
            `SetNull`, so they keep their launcher and lose only the answer to
            «de dónde salió». Refusing instead would mean a shop that closed can
            never be tidied away.
          */}
          <p className="text-[11px] text-neutral-600">
            El lanzador es una lista cerrada —no te inventas uno—, pero las
            tiendas no: aparece una nueva cada temporada. Borrar una deja sus
            juegos sin tienda y no les quita nada más.
          </p>
        </section>
      ) : null}

      {summary.games.length === 0 ? (
        <p className="rounded border border-dashed border-neutral-800 px-6 py-12 text-center text-sm text-neutral-500">
          Todavía no hay nada. Añade el primero — y si no recuerdas el precio,
          déjalo vacío: en blanco significa «no sé», y un cero diría «gratis».
        </p>
      ) : shown.length === 0 ? (
        <p className="rounded border border-dashed border-neutral-800 px-6 py-12 text-center text-sm text-neutral-500">
          Ningún juego coincide con el filtro.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-900 border-y border-neutral-900">
          {shown.map((game) => (
            <li
              key={game.id}
              className="flex flex-wrap items-center gap-3 py-3 sm:flex-nowrap"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-neutral-200">
                  {game.title}
                </span>
                <span className="block truncate text-[11px] text-neutral-600">
                  {[
                    platformLabel(game.platform),
                    // Only worth saying when the two differ, which is the case
                    // this field exists for.
                    // Only worth saying when the two differ, which is the case
                    // this field exists for.
                    game.storeName && game.storeName !== platformLabel(game.platform)
                      ? `comprado en ${game.storeName}`
                      : null,
                    game.purchasedAt,
                    game.price !== null ? money(game.price) : null,
                    game.hours !== null ? `${game.hours} h` : null,
                    game.note,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>

              {/*
                Status changes from the list, not from the editor: it is the
                field that moves most, and opening a form to change one select
                is three clicks for one decision.
              */}
              <select
                className={`${field} shrink-0`}
                value={game.status}
                disabled={pending}
                onChange={(e) =>
                  run(() =>
                    actions.setStatus(game.id, e.target.value as GameDraft["status"]),
                  )
                }
              >
                {statuses.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>

              <span className="flex shrink-0 gap-1">
                <button
                  type="button"
                  aria-label={`Editar ${game.title}`}
                  onClick={() =>
                    setDraft({
                      id: game.id,
                      title: game.title,
                      platform: game.platform,
                      store: game.storeId ?? "",
                      status: game.status,
                      hours: game.hours === null ? "" : String(game.hours),
                      price: game.price === null ? "" : String(game.price),
                      purchasedAt: game.purchasedAt ?? "",
                      finishedAt: game.finishedAt ?? "",
                      note: game.note ?? "",
                    })
                  }
                  className="rounded p-1.5 text-neutral-500 transition-colors hover:text-neutral-200"
                >
                  <BsPencil className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`Eliminar ${game.title}`}
                  disabled={pending}
                  onClick={() => {
                    if (!confirm(`¿Eliminar «${game.title}»? No se puede deshacer.`)) return;
                    run(() => actions.remove(game.id, game.title));
                  }}
                  className="rounded p-1.5 text-neutral-600 transition-colors hover:text-red-400"
                >
                  <BsTrash className="h-3.5 w-3.5" aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {summary.byPlatform.length > 1 ? (
        <p className="text-[11px] text-neutral-600">
          {summary.byPlatform
            .map((p) => `${platformLabel(p.platform)}: ${p.count}`)
            .join(" · ")}
          {summary.totalSpend > 0 ? ` · ${money(summary.totalSpend)} en total` : ""}
        </p>
      ) : null}

      <Toast result={result} onDismiss={() => setResult(null)} />
    </div>
  );
}

/**
 * What the draft looked like when the editor opened.
 *
 * Derived from the row rather than stored alongside it: the editor is opened from
 * the list, so the row *is* the baseline, and keeping a second copy in state
 * would be one more thing that can disagree with it.
 */
function baselineFor(draft: GameDraft, summary: GamesSummary): GameDraft {
  if (!draft.id) return emptyGame();

  const row = summary.games.find((g) => g.id === draft.id);
  if (!row) return draft;

  return {
    id: row.id,
    title: row.title,
    platform: row.platform,
    store: row.storeId ?? "",
    status: row.status,
    hours: row.hours === null ? "" : String(row.hours),
    price: row.price === null ? "" : String(row.price),
    purchasedAt: row.purchasedAt ?? "",
    finishedAt: row.finishedAt ?? "",
    note: row.note ?? "",
  };
}

function Labelled({
  label: text,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <span className={label}>{text}</span>
      {children}
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
      <span className="text-2xl font-semibold tracking-tight text-neutral-100">
        {value}
      </span>
      {note ? <span className="text-[11px] text-neutral-600">{note}</span> : null}
    </div>
  );
}
