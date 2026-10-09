"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  BsArrowCounterclockwise,
  BsBoxArrowUpRight,
  BsChevronDown,
  BsPencil,
  BsPlus,
  BsTrash,
  BsX,
} from "react-icons/bs";
import type { Currency, WishPriority } from "@nassican/db";
import DateField from "@/components/DateField";
import GoalsTabs from "@/components/GoalsTabs";
import Toast from "@/components/Toast";
import Unsaved from "@/components/Unsaved";
import type { ActionResult } from "@/app/(panel)/metas/deseos/actions";
import { formatPartialDate } from "@/lib/draft-fields";
import { isDirty, useUnsavedChanges } from "@/lib/use-unsaved";
import { emptyWish, priorities, priorityLabel, wishProblems, type WishDraft } from "@/lib/wish-draft";
import type { WishRow, WishlistView } from "@/lib/wishes";

/*
 * The look of a field, without a width. `field` is the full-width one; a
 * narrow field builds on `fieldBase` instead of adding `w-24` to `field`:
 * both would be in the class list, and `w-full` wins in the stylesheet.
 */
const fieldBase =
  "rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none";
const field = `w-full ${fieldBase}`;
const labelClass = "font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500";
/*
 * The same for buttons and their colour: a green or red variant is its own
 * class built on the shape, never `small` plus a second border colour — the
 * neutral one wins in the stylesheet and the button stays grey.
 */
const smallShape = "inline-flex items-center gap-1 rounded border px-2 py-1 text-xs transition-colors disabled:opacity-40";
const small = `${smallShape} border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-100`;
const smallStrong = `${smallShape} border-neutral-700 text-neutral-200 hover:border-neutral-600 hover:text-neutral-100`;
const smallGood = `${smallShape} border-green-800 text-green-300 hover:border-green-600`;
const smallDanger = `${smallShape} border-neutral-800 text-neutral-400 hover:border-red-900 hover:text-red-400`;
const iconButton = "rounded p-1.5 text-neutral-500 transition-colors hover:text-neutral-200";
const primary =
  "rounded border border-neutral-600 bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-950 transition-colors hover:bg-white disabled:opacity-40";

type Actions = {
  save: (draft: WishDraft) => Promise<ActionResult>;
  saveMoney: (id: string, entry: { amount: string; at: string; note: string }) => Promise<ActionResult>;
  removeSaving: (savingId: string) => Promise<ActionResult>;
  moveSavings: (fromId: string, toId: string) => Promise<ActionResult>;
  buy: (id: string, purchase: { at: string; paid: string }) => Promise<ActionResult>;
  setStatus: (id: string, status: "wanted" | "dropped") => Promise<ActionResult>;
  remove: (id: string, title: string) => Promise<ActionResult>;
};

// Pesos have no cents worth showing; dollars and euros do.
const money = (amount: number, currency: Currency) =>
  amount.toLocaleString("es-CO", { style: "currency", currency, maximumFractionDigits: currency === "COP" ? 0 : 2 });

/** Grouped the way it is read — «4.500.000» — and the way the field reads it back. */
const grouped = (amount: number | null) =>
  amount === null ? "" : amount.toLocaleString("es-CO", { maximumFractionDigits: 2 });

function toDraft(w: WishRow): WishDraft {
  return {
    id: w.id,
    title: w.title,
    url: w.url ?? "",
    note: w.note ?? "",
    priority: w.priority,
    status: w.status,
    price: grouped(w.price),
    currency: w.currency,
    targetDate: w.targetDate ?? "",
    boughtAt: w.boughtAt ?? "",
    paid: grouped(w.paid),
  };
}

function Labelled({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

/**
 * Things to get, what each costs, and what has been set aside for it.
 *
 * A card per wish, most important first. Setting money aside is one field on
 * the card itself: a saving that costs opening an editor is a saving that goes
 * unrecorded, and then the bar is wrong.
 */
export default function WishlistModule({ view, actions }: { view: WishlistView; actions: Actions }) {
  const router = useRouter();
  const [draft, setDraft] = useState<WishDraft | null>(null);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [showBought, setShowBought] = useState(false);
  const [showDropped, setShowDropped] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const baseline = draft?.id ? view.rows.find((r) => r.id === draft.id) : null;
  const dirty = draft !== null && isDirty(baseline ? toDraft(baseline) : emptyWish(), draft);
  useUnsavedChanges(dirty);
  const problems = draft ? wishProblems(draft) : [];

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

  const wanted = view.rows.filter((r) => r.status === "wanted");
  const bought = view.rows.filter((r) => r.status === "bought");
  const dropped = view.rows.filter((r) => r.status === "dropped");
  const { summary } = view;

  /** Where savings can go: still wanted, another wish, the same currency. */
  const targetsFor = (row: WishRow) => wanted.filter((r) => r.id !== row.id && r.currency === row.currency);

  const figure = (key: "cost" | "saved" | "missing") =>
    summary.cop
      ? money(summary.cop[key], "COP")
      : summary.totals.length > 0
        ? summary.totals.map((t) => money(t[key], t.currency)).join(" + ")
        : "—";
  const foreign = summary.totals.some((t) => t.currency !== "COP");
  const percent = summary.cop && summary.cop.cost > 0 ? Math.round((summary.cop.saved / summary.cop.cost) * 100) : null;

  const trash = (row: WishRow) => {
    if (!confirm(`¿Mover «${row.title}» a la papelera, con lo que tenía ahorrado? Se puede restaurar durante 30 días.`)) return;
    run(() => actions.remove(row.id, row.title), () => setOpenRow(null));
  };

  return (
    <div className="flex flex-col gap-6">
      <GoalsTabs current="wishes" />

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Lista de deseos</h1>
          <p className="mt-1 max-w-prose text-sm text-neutral-500">
            Lo que quieres conseguir, cuánto cuesta y cuánto llevas apartado para cada cosa.
          </p>
        </div>
        <button type="button" className={smallStrong} onClick={() => setDraft(emptyWish())}>
          <BsPlus className="h-4 w-4" aria-hidden />
          Añadir deseo
        </button>
      </header>

      {summary.wanted > 0 ? (
        <section className="flex flex-col gap-2" aria-label="Resumen">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile
              label="En la lista"
              value={String(summary.wanted)}
              note={
                summary.ready > 0
                  ? `${summary.ready} ya ${summary.ready === 1 ? "se puede" : "se pueden"} comprar`
                  : summary.unpriced > 0
                    ? `${summary.unpriced} sin precio todavía`
                    : undefined
              }
              tone={summary.ready > 0 ? "good" : "plain"}
            />
            <Tile label="Cuestan" value={figure("cost")} />
            <Tile label="Ahorrado" value={figure("saved")} note={percent !== null ? `${percent} % del total` : undefined} />
            <Tile label="Falta" value={figure("missing")} />
          </div>
          <p className="text-[11px] text-neutral-500">
            Lo ahorrado es lo que anotas haber apartado: no sale de Wallet ni mueve dinero.
            {foreign && summary.cop && summary.trm
              ? ` Convertido a pesos con la TRM de ${summary.trm.value.toLocaleString("es-CO")}.`
              : foreign && !summary.cop
                ? " Sin tasa para convertir, cada moneda va por separado."
                : ""}
            {summary.unpriced > 0 && summary.ready > 0
              ? ` ${summary.unpriced} ${summary.unpriced === 1 ? "deseo sin precio no entra" : "deseos sin precio no entran"} en las cifras.`
              : ""}
          </p>
        </section>
      ) : null}

      {draft ? (
        <section className="flex flex-col gap-4 rounded-lg border border-neutral-800 p-5" aria-label="Editar deseo">
          <header className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">{draft.id ? "Editar deseo" : "Nuevo deseo"}</h2>
            {dirty ? <Unsaved /> : null}
          </header>
          <div className="grid gap-3 sm:grid-cols-6">
            <Labelled label="Qué quieres" className="sm:col-span-4">
              <input
                className={field}
                value={draft.title}
                autoFocus
                placeholder="Laptop · Disco SSD de 1 TB · Mouse"
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </Labelled>
            <Labelled label="Prioridad" className="sm:col-span-2">
              <select
                className={field}
                value={draft.priority}
                onChange={(e) => setDraft({ ...draft, priority: e.target.value as WishPriority })}
              >
                {priorities.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Labelled>
            <Labelled label="Precio estimado" className="sm:col-span-2">
              <input
                className={field}
                inputMode="decimal"
                value={draft.price}
                placeholder="4.500.000"
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              />
            </Labelled>
            <Labelled label="Moneda" className="sm:col-span-1">
              <select
                className={field}
                value={draft.currency}
                // Savings are kept in the wish's currency, so it is fixed once there are any.
                disabled={!!baseline && baseline.savings.length > 0}
                title={baseline && baseline.savings.length > 0 ? "Ya tiene ahorro anotado en esta moneda" : undefined}
                onChange={(e) => setDraft({ ...draft, currency: e.target.value as Currency })}
              >
                <option value="COP">COP</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </Labelled>
            <Labelled label="Para cuándo (opcional)" className="sm:col-span-3">
              <DateField label="objetivo" value={draft.targetDate} onChange={(v) => setDraft({ ...draft, targetDate: v })} />
            </Labelled>
            <Labelled label="Enlace (tienda, reseña…)" className="sm:col-span-6">
              <input className={field} value={draft.url} placeholder="https://" onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
            </Labelled>
            <Labelled label="Nota" className="sm:col-span-6">
              <textarea
                className={`${field} min-h-16`}
                value={draft.note}
                placeholder="Modelo, por qué este, qué esperar a que baje"
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              />
            </Labelled>
            {draft.status === "bought" ? (
              <>
                <Labelled label="Comprado el" className="sm:col-span-3">
                  <DateField label="de compra" value={draft.boughtAt} onChange={(v) => setDraft({ ...draft, boughtAt: v })} />
                </Labelled>
                <Labelled label="Lo que pagaste" className="sm:col-span-3">
                  <input className={field} inputMode="decimal" value={draft.paid} onChange={(e) => setDraft({ ...draft, paid: e.target.value })} />
                </Labelled>
              </>
            ) : null}
          </div>
          {problems.length > 0 ? (
            <ul className="flex flex-col gap-1 text-[11px] text-amber-500">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              className={primary}
              disabled={pending || problems.length > 0}
              onClick={() => run(() => actions.save(draft), () => setDraft(null))}
            >
              {pending ? "Guardando…" : "Guardar"}
            </button>
            <button type="button" className={small} onClick={() => setDraft(null)}>
              Cancelar
            </button>
          </div>
        </section>
      ) : null}

      {view.rows.length === 0 && !draft ? (
        <p className="rounded border border-dashed border-neutral-800 px-6 py-12 text-center text-sm text-neutral-500">
          Nada en la lista todavía. Apunta lo que quieres conseguir —una laptop, un disco, un mouse— con su precio, y ve
          anotando lo que apartas para cada cosa.
        </p>
      ) : null}

      {wanted.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {wanted.map((row) => (
            <WishCard
              key={row.id}
              row={row}
              today={view.today}
              pending={pending}
              expanded={openRow === row.id}
              buying={buying === row.id}
              targets={targetsFor(row)}
              onToggle={() => setOpenRow(openRow === row.id ? null : row.id)}
              onEdit={() => setDraft(toDraft(row))}
              onSave={(entry, done) => run(() => actions.saveMoney(row.id, entry), done)}
              onRemoveSaving={(id) => run(() => actions.removeSaving(id))}
              onMove={(toId) => run(() => actions.moveSavings(row.id, toId))}
              onAskBuy={() => setBuying(row.id)}
              onCancelBuy={() => setBuying(null)}
              onBuy={(purchase) => run(() => actions.buy(row.id, purchase), () => setBuying(null))}
              onDrop={() => run(() => actions.setStatus(row.id, "dropped"), () => setOpenRow(null))}
              onRemove={() => trash(row)}
            />
          ))}
        </div>
      ) : view.rows.length > 0 ? (
        <p className="rounded border border-dashed border-neutral-800 px-6 py-8 text-center text-sm text-neutral-500">
          Nada pendiente en la lista.
        </p>
      ) : null}

      {bought.length > 0 ? (
        <section className="flex flex-col gap-2">
          <button type="button" className={`${small} w-fit`} aria-expanded={showBought} onClick={() => setShowBought((v) => !v)}>
            {showBought ? "Ocultar comprados" : `Ver comprados (${bought.length})`}
          </button>
          {showBought ? (
            <ul className="flex flex-col divide-y divide-neutral-900 rounded-lg border border-neutral-900">
              {bought.map((row) => (
                <ClosedRow
                  key={row.id}
                  row={row}
                  pending={pending}
                  onEdit={() => setDraft(toDraft(row))}
                  onReopen={() => run(() => actions.setStatus(row.id, "wanted"))}
                  onRemove={() => trash(row)}
                >
                  <span>
                    {row.boughtAt ? `comprado ${formatPartialDate(row.boughtAt)}` : "comprado"}
                    {row.paid !== null ? ` · pagaste ${money(row.paid, row.currency)}` : ""}
                    {row.paid !== null && row.price !== null && row.paid !== row.price
                      ? ` (calculabas ${money(row.price, row.currency)})`
                      : ""}
                  </span>
                </ClosedRow>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {dropped.length > 0 ? (
        <section className="flex flex-col gap-2">
          <button type="button" className={`${small} w-fit`} aria-expanded={showDropped} onClick={() => setShowDropped((v) => !v)}>
            {showDropped ? "Ocultar descartados" : `Ver descartados (${dropped.length})`}
          </button>
          {showDropped ? (
            <ul className="flex flex-col divide-y divide-neutral-900 rounded-lg border border-neutral-900">
              {dropped.map((row) => (
                <ClosedRow
                  key={row.id}
                  row={row}
                  pending={pending}
                  onEdit={() => setDraft(toDraft(row))}
                  onReopen={() => run(() => actions.setStatus(row.id, "wanted"))}
                  onRemove={() => trash(row)}
                >
                  {row.saved > 0 ? (
                    <>
                      <span className="text-amber-500">{money(row.saved, row.currency)} ahorrados sin destino</span>
                      <MoveSavings targets={targetsFor(row)} pending={pending} onMove={(toId) => run(() => actions.moveSavings(row.id, toId))} />
                    </>
                  ) : (
                    <span>descartado</span>
                  )}
                </ClosedRow>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <Toast result={result} onDismiss={() => setResult(null)} />
    </div>
  );
}

function Tile({ label, value, note, tone = "plain" }: { label: string; value: string; note?: string; tone?: "plain" | "good" }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-neutral-900 p-4">
      <span className={labelClass}>{label}</span>
      <span className="break-words text-xl font-semibold tabular-nums tracking-tight text-neutral-100">{value}</span>
      {note ? <span className={`text-[11px] ${tone === "good" ? "text-green-400" : "text-neutral-500"}`}>{note}</span> : null}
    </div>
  );
}

function WishCard({
  row,
  today,
  pending,
  expanded,
  buying,
  targets,
  onToggle,
  onEdit,
  onSave,
  onRemoveSaving,
  onMove,
  onAskBuy,
  onCancelBuy,
  onBuy,
  onDrop,
  onRemove,
}: {
  row: WishRow;
  today: string;
  pending: boolean;
  expanded: boolean;
  buying: boolean;
  targets: WishRow[];
  onToggle: () => void;
  onEdit: () => void;
  onSave: (entry: { amount: string; at: string; note: string }, done: () => void) => void;
  onRemoveSaving: (id: string) => void;
  onMove: (toId: string) => void;
  onAskBuy: () => void;
  onCancelBuy: () => void;
  onBuy: (purchase: { at: string; paid: string }) => void;
  onDrop: () => void;
  onRemove: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [at, setAt] = useState(today);
  const [note, setNote] = useState("");

  return (
    <article className={`flex flex-col gap-3 rounded-lg border p-4 ${row.ready ? "border-green-900" : "border-neutral-900"}`}>
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-sm font-semibold text-neutral-100">{row.title}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-neutral-500">
            <span>Prioridad {priorityLabel(row.priority).toLowerCase()}</span>
            {row.targetDate ? (
              <span className={row.pastTarget ? "text-amber-500" : ""}>
                {row.pastTarget ? "se pasó la fecha:" : "para"} {formatPartialDate(row.targetDate)}
              </span>
            ) : null}
            {row.url ? (
              <a className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-neutral-200" href={row.url} target="_blank" rel="noreferrer">
                Ver <BsBoxArrowUpRight className="h-2.5 w-2.5" aria-hidden />
              </a>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0">
          <button type="button" className={iconButton} aria-label={`Editar ${row.title}`} onClick={onEdit}>
            <BsPencil className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            className={iconButton}
            aria-expanded={expanded}
            aria-label={expanded ? `Cerrar ${row.title}` : `Abrir ${row.title}`}
            onClick={onToggle}
          >
            <BsChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden />
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="text-xs text-neutral-500">
            <span className="text-base font-semibold tabular-nums text-neutral-100">{money(row.saved, row.currency)}</span>
            {row.price !== null ? ` de ${money(row.price, row.currency)}` : " ahorrados · sin precio todavía"}
          </span>
          {row.ratio !== null ? <span className="text-xs tabular-nums text-neutral-500">{Math.round(row.ratio * 100)} %</span> : null}
        </div>
        {row.ratio !== null ? (
          <div className="h-1.5 overflow-hidden rounded-full bg-neutral-900" aria-hidden>
            <div
              className={`h-full rounded-full ${row.ready ? "bg-green-500" : "bg-neutral-400"}`}
              style={{ width: `${row.ratio * 100}%` }}
            />
          </div>
        ) : null}
        {row.ready ? (
          <p className="text-xs text-green-400">Ya te alcanza: lo ahorrado cubre el precio.</p>
        ) : row.missing !== null ? (
          <p className="text-xs text-neutral-400">
            Faltan <span className="tabular-nums text-neutral-200">{money(row.missing, row.currency)}</span>
            {row.monthly ? (
              <span className="text-neutral-500">
                {" · "}
                {money(row.monthly.amount, row.currency)} al mes para llegar en {formatPartialDate(row.targetDate)}
                {row.monthly.months > 1 ? ` (${row.monthly.months} meses)` : " (este mes)"}
              </span>
            ) : null}
          </p>
        ) : null}
      </div>

      {buying ? (
        <BuyForm row={row} today={today} pending={pending} onBuy={onBuy} onCancel={onCancelBuy} />
      ) : (
        <form
          className="flex flex-wrap items-start gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSave({ amount, at: expanded ? at : today, note: expanded ? note : "" }, () => {
              setAmount("");
              setNote("");
            });
          }}
        >
          {expanded ? (
            <div className="w-44">
              <DateField label="del ahorro" value={at} onChange={setAt} />
            </div>
          ) : null}
          <input
            className={`${fieldBase} min-w-28 flex-1`}
            inputMode="decimal"
            value={amount}
            placeholder="Cuánto apartas"
            aria-label={`Cuánto apartas para ${row.title}`}
            onChange={(e) => setAmount(e.target.value)}
          />
          {expanded ? (
            <input
              className={`${fieldBase} min-w-0 basis-full`}
              value={note}
              placeholder="Nota (opcional): de la prima, de un trabajo…"
              aria-label="Nota del ahorro"
              onChange={(e) => setNote(e.target.value)}
            />
          ) : null}
          <button type="submit" className={`${small} h-[34px]`} disabled={pending || !amount.trim()}>
            Apartar
          </button>
          <button type="button" className={`${smallGood} h-[34px]`} disabled={pending} onClick={onAskBuy}>
            Comprado
          </button>
        </form>
      )}

      {expanded ? (
        <div className="flex flex-col gap-3 border-t border-neutral-900 pt-3">
          {row.note ? <p className="whitespace-pre-line text-xs text-neutral-300">{row.note}</p> : null}

          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>Lo apartado</span>
            {row.savings.length > 0 ? (
              <ol className="flex flex-col gap-1.5 border-l border-neutral-800 pl-3">
                {row.savings.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                    <span className="w-24 shrink-0 font-mono text-[11px] text-neutral-500">{formatPartialDate(s.at)}</span>
                    <span className={`shrink-0 tabular-nums ${s.amount < 0 ? "text-neutral-400" : "text-neutral-200"}`}>
                      {s.amount < 0 ? "− " : "+ "}
                      {money(Math.abs(s.amount), row.currency)}
                    </span>
                    {s.note ? <span className="min-w-0 flex-1 break-words text-neutral-500">{s.note}</span> : null}
                    <button
                      type="button"
                      aria-label="Borrar este movimiento del ahorro"
                      className="ml-auto rounded p-1 text-neutral-600 hover:text-red-400"
                      onClick={() => {
                        if (confirm("¿Borrar este movimiento? Lo ahorrado se recalcula sin él.")) onRemoveSaving(s.id);
                      }}
                    >
                      <BsX className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[11px] text-neutral-500">Nada apartado todavía.</p>
            )}
            <p className="text-[11px] text-neutral-600">Para retirar, escribe la cantidad con un − delante.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {row.saved > 0 ? <MoveSavings targets={targets} pending={pending} onMove={onMove} /> : null}
            <button type="button" className={small} disabled={pending} onClick={onDrop}>
              Ya no lo quiero
            </button>
            <button type="button" className={smallDanger} onClick={onRemove}>
              <BsTrash className="h-3 w-3" aria-hidden />
              Mover a la papelera
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

/**
 * «¿Cuándo y por cuánto?» — asked at the moment of ticking it off, because
 * that is when both are known. The day is not stamped silently: catching up on
 * something bought last year is the other reason to press «Comprado».
 */
function BuyForm({
  row,
  today,
  pending,
  onBuy,
  onCancel,
}: {
  row: WishRow;
  today: string;
  pending: boolean;
  onBuy: (purchase: { at: string; paid: string }) => void;
  onCancel: () => void;
}) {
  const [at, setAt] = useState(today);
  const [paid, setPaid] = useState(grouped(row.price));

  return (
    <form
      className="flex flex-col gap-2 rounded border border-neutral-800 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        onBuy({ at, paid });
      }}
    >
      <span className={labelClass}>¿Cuándo lo compraste y por cuánto?</span>
      <div className="flex flex-wrap items-start gap-2">
        <div className="w-44">
          <DateField label="de compra" value={at} onChange={setAt} />
        </div>
        <input
          className={`${fieldBase} min-w-28 flex-1`}
          inputMode="decimal"
          value={paid}
          placeholder="Lo que pagaste"
          aria-label="Lo que pagaste"
          onChange={(e) => setPaid(e.target.value)}
        />
        <button type="submit" className={`${smallGood} h-[34px]`} disabled={pending}>
          Confirmar
        </button>
        <button type="button" className={`${small} h-[34px]`} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

/** Sends everything saved for one wish to another in the same currency. */
function MoveSavings({ targets, pending, onMove }: { targets: WishRow[]; pending: boolean; onMove: (toId: string) => void }) {
  const [to, setTo] = useState("");
  if (targets.length === 0) return null;

  return (
    <span className="flex min-w-0 items-center gap-1">
      <select className={`${fieldBase} min-w-0 max-w-56 py-1 text-xs`} value={to} aria-label="Pasar lo ahorrado a otro deseo" onChange={(e) => setTo(e.target.value)}>
        <option value="">Pasar lo ahorrado a…</option>
        {targets.map((t) => (
          <option key={t.id} value={t.id}>
            {t.title}
          </option>
        ))}
      </select>
      <button type="button" className={small} disabled={pending || !to} onClick={() => onMove(to)}>
        Pasar
      </button>
    </span>
  );
}

function ClosedRow({
  row,
  pending,
  onEdit,
  onReopen,
  onRemove,
  children,
}: {
  row: WishRow;
  pending: boolean;
  onEdit: () => void;
  onReopen: () => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    // Stacked on a phone: beside the details, the title was the part that gave way.
    <li className="flex flex-col gap-1.5 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-3">
      <span className="min-w-0 truncate text-sm text-neutral-300 sm:flex-1">{row.title}</span>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
        {children}
        <span className="ml-auto flex shrink-0 sm:ml-0">
          <button type="button" className={iconButton} aria-label={`Editar ${row.title}`} onClick={onEdit}>
            <BsPencil className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            className={iconButton}
            aria-label={`Devolver ${row.title} a la lista`}
            title="Devolver a la lista"
            disabled={pending}
            onClick={onReopen}
          >
            <BsArrowCounterclockwise className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button type="button" className={`${iconButton} hover:text-red-400`} aria-label={`Mover ${row.title} a la papelera`} onClick={onRemove}>
            <BsTrash className="h-3.5 w-3.5" aria-hidden />
          </button>
        </span>
      </span>
    </li>
  );
}
