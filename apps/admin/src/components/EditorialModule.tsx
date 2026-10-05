"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BsChevronLeft, BsChevronRight, BsPencil, BsTrash } from "react-icons/bs";
import DateField from "@/components/DateField";
import Toast from "@/components/Toast";
import { formatPartialDate } from "@/lib/draft-fields";
import {
  columnOf,
  columns,
  ideaProblems,
  isLate,
  monthGrid,
  monthLabel,
  placeInMonth,
  shiftMonth,
  type BoardItem,
  type ColumnKey,
} from "@/lib/editorial-draft";
import type { EditorialView } from "@/lib/editorial";
import { WEEKDAYS } from "@/lib/habit-draft";
import { useUnsavedChanges } from "@/lib/use-unsaved";
import type { ActionResult } from "@/app/(panel)/contenido/calendario/actions";

const field =
  "rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none";
const small =
  "inline-flex items-center gap-1 rounded border border-neutral-800 px-2 py-1 text-xs text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-100 disabled:opacity-40";
const iconButton = "rounded p-1 text-neutral-500 transition-colors hover:text-neutral-200";

/** One colour per column, so a dot on the calendar says where a piece stands. */
const tones: Record<ColumnKey, string> = {
  idea: "bg-neutral-500",
  research: "bg-sky-500",
  writing: "bg-amber-500",
  scheduled: "bg-violet-500",
  published: "bg-green-500",
};

type Actions = {
  save: (id: string | null, fields: { title: string; targetDate: string; note: string }) => Promise<ActionResult>;
  move: (id: string, stage: "idea" | "research") => Promise<ActionResult>;
  write: (id: string) => Promise<ActionResult>;
  remove: (id: string) => Promise<ActionResult>;
};

/**
 * What comes out, and when.
 *
 * The board answers «what is in the pipe»; the month answers «when does it come
 * out». Both read the same pieces, so an idea dated for the 15th is a card in
 * «Ideas» and a dot on the 15th at once — two views of one thing, never two
 * lists to keep in step.
 */
export default function EditorialModule({ view, actions }: { view: EditorialView; actions: Actions }) {
  const router = useRouter();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState({ title: "", targetDate: "", note: "" });
  const [editing, setEditing] = useState<{ id: string; title: string; targetDate: string; note: string } | null>(null);
  // The server's clock, not the browser's: the two can disagree, and a post
  // published an hour ago must not read as scheduled on a slow clock.
  const now = new Date(view.now);

  useUnsavedChanges(draft.title.trim() !== "" || editing !== null);

  function run(action: () => Promise<ActionResult>, onOk?: (r: ActionResult & { ok: true }) => void) {
    setResult(null);
    startTransition(async () => {
      const outcome = await action();
      setResult(outcome);
      if (outcome.ok) {
        onOk?.(outcome);
        router.refresh();
      }
    });
  }

  const placed = view.items.map((item) => ({ item, column: columnOf(item, now) }));
  const { byDay, monthOnly } = placeInMonth(view.items, view.month);
  const columnFor = (item: BoardItem) => columnOf(item, now);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Calendario editorial</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Ideas con fecha, borradores en marcha y lo que sale cuándo. Una idea sin
          fecha no avanza: dásela.
        </p>
        <p className={`mt-2 text-xs ${view.cadence.last30 === 0 ? "text-amber-500" : "text-neutral-400"}`}>
          {view.cadence.last30 === 0
            ? "Ningún artículo publicado en los últimos 30 días."
            : `${view.cadence.last30} ${view.cadence.last30 === 1 ? "artículo publicado" : "artículos publicados"} en los últimos 30 días.`}
          {view.cadence.lastPublished ? ` El último, el ${formatPartialDate(view.cadence.lastPublished)}.` : ""}
        </p>
      </header>

      {/* ------------------------------ apuntar ------------------------------ */}
      <section className="flex flex-col gap-2 rounded-lg border border-neutral-800 p-4">
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_16rem_auto]">
          <input
            className={field}
            value={draft.title}
            placeholder="Una idea de artículo…"
            aria-label="Título de la idea"
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter" && draft.title.trim()) {
                e.preventDefault();
                run(() => actions.save(null, draft), () => setDraft({ title: "", targetDate: "", note: "" }));
              }
            }}
          />
          <DateField label="objetivo" placeholder="Para cuándo: 2026-11" value={draft.targetDate} onChange={(v) => setDraft({ ...draft, targetDate: v })} />
          <button
            type="button"
            disabled={pending || ideaProblems(draft).length > 0}
            onClick={() => run(() => actions.save(null, draft), () => setDraft({ title: "", targetDate: "", note: "" }))}
            className="rounded border border-neutral-600 bg-neutral-100 px-4 py-1.5 text-sm font-medium text-neutral-950 transition-colors hover:bg-white disabled:opacity-40"
          >
            Apuntar
          </button>
        </div>
      </section>

      {/* ------------------------------- tablero ------------------------------- */}
      {/* Sideways on a phone: five columns side by side do not fit, and stacked
          they would push the calendar three screens down. */}
      <section className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
        {columns.map((column) => {
          const items = placed.filter((p) => p.column === column.key).map((p) => p.item);
          return (
            <div key={column.key} className="flex w-64 shrink-0 snap-start flex-col gap-2 lg:w-auto">
              <h2 className="flex items-center gap-2 text-xs font-semibold text-neutral-300">
                <span className={`h-2 w-2 rounded-full ${tones[column.key]}`} aria-hidden />
                {column.label}
                <span className="font-normal text-neutral-600">{items.length}</span>
              </h2>
              <p className="-mt-1 text-[10px] text-neutral-600">{column.hint}</p>

              {items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-neutral-900 px-3 py-4 text-center text-[11px] text-neutral-700">—</p>
              ) : (
                items.map((item) =>
                  editing?.id === item.ideaId ? (
                    <div key={item.id} className="flex flex-col gap-2 rounded-lg border border-neutral-700 p-3">
                      <input className={field} value={editing.title} aria-label="Título" onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
                      <DateField label="objetivo" value={editing.targetDate} onChange={(v) => setEditing({ ...editing, targetDate: v })} />
                      <textarea className={field} rows={2} value={editing.note} placeholder="Notas, enlaces, enfoque…" onChange={(e) => setEditing({ ...editing, note: e.target.value })} />
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          className={`${small} border-green-800 text-green-300`}
                          disabled={pending || ideaProblems(editing).length > 0}
                          onClick={() => run(() => actions.save(editing.id, editing), () => setEditing(null))}
                        >
                          Guardar
                        </button>
                        <button type="button" className={small} onClick={() => setEditing(null)}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <Card
                      key={item.id}
                      item={item}
                      column={column.key}
                      today={view.today}
                      pending={pending}
                      onEdit={() => setEditing({ id: item.ideaId!, title: item.title, targetDate: item.targetDate ?? "", note: item.note ?? "" })}
                      onMove={(stage) => run(() => actions.move(item.ideaId!, stage))}
                      onWrite={() => run(() => actions.write(item.ideaId!), (r) => r.href && router.push(r.href))}
                      onRemove={() => {
                        if (!confirm(`¿Mover la idea «${item.title}» a la papelera?`)) return;
                        run(() => actions.remove(item.ideaId!));
                      }}
                    />
                  ),
                )
              )}
            </div>
          );
        })}
      </section>

      {/* -------------------------------- el mes -------------------------------- */}
      <section className="flex flex-col gap-3">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold capitalize">{monthLabel(view.month)}</h2>
          <nav className="flex items-center gap-1.5" aria-label="Meses">
            <Link href={`/contenido/calendario?mes=${shiftMonth(view.month, -1)}`} className={small} aria-label="Mes anterior">
              <BsChevronLeft className="h-3 w-3" aria-hidden />
            </Link>
            {view.month !== view.today.slice(0, 7) ? (
              <Link href="/contenido/calendario" className={small}>
                Este mes
              </Link>
            ) : null}
            <Link href={`/contenido/calendario?mes=${shiftMonth(view.month, 1)}`} className={small} aria-label="Mes siguiente">
              <BsChevronRight className="h-3 w-3" aria-hidden />
            </Link>
          </nav>
        </header>

        {monthOnly.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-neutral-500">Este mes, sin día:</span>
            {monthOnly.map((item) => (
              <Pill key={item.id} item={item} column={columnFor(item)} />
            ))}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-lg border border-neutral-900">
          <div className="grid grid-cols-7 border-b border-neutral-900 text-center text-[10px] text-neutral-500">
            {WEEKDAYS.map((d) => (
              <span key={d} className="py-1.5">
                {d}
              </span>
            ))}
          </div>
          {monthGrid(view.month).map((week) => (
            <div key={week[0]} className="grid grid-cols-7 divide-x divide-neutral-900 border-b border-neutral-900 last:border-b-0">
              {week.map((day) => {
                const inMonth = day.startsWith(view.month);
                const pieces = byDay.get(day) ?? [];
                return (
                  <div key={day} className={`flex min-h-20 flex-col gap-1 p-1.5 ${inMonth ? "" : "bg-neutral-950/60 opacity-40"}`}>
                    <span
                      className={`self-start rounded px-1 text-[11px] tabular-nums ${
                        day === view.today ? "bg-neutral-200 font-semibold text-neutral-950" : "text-neutral-500"
                      }`}
                    >
                      {Number(day.slice(8))}
                    </span>
                    {pieces.map((item) => (
                      <Pill key={item.id} item={item} column={columnFor(item)} compact />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      <Toast result={result} onDismiss={() => setResult(null)} />
    </div>
  );
}

function Card({
  item,
  column,
  today,
  pending,
  onEdit,
  onMove,
  onWrite,
  onRemove,
}: {
  item: BoardItem;
  column: ColumnKey;
  today: string;
  pending: boolean;
  onEdit: () => void;
  onMove: (stage: "idea" | "research") => void;
  onWrite: () => void;
  onRemove: () => void;
}) {
  const late = isLate(item, column, today);
  const isIdea = column === "idea" || column === "research";
  const date = column === "scheduled" || column === "published" ? item.when : item.targetDate;

  return (
    <article className="flex flex-col gap-2 rounded-lg border border-neutral-900 p-3">
      <div className="flex items-start gap-1">
        <p className="min-w-0 flex-1 text-sm leading-snug text-neutral-100">{item.title}</p>
        {item.ideaId ? (
          <>
            <button type="button" className={iconButton} aria-label={`Editar «${item.title}»`} onClick={onEdit}>
              <BsPencil className="h-3 w-3" aria-hidden />
            </button>
            {isIdea ? (
              <button type="button" className={`${iconButton} hover:text-red-400`} aria-label={`Mover «${item.title}» a la papelera`} onClick={onRemove}>
                <BsTrash className="h-3 w-3" aria-hidden />
              </button>
            ) : null}
          </>
        ) : null}
      </div>

      {date ? (
        <p className={`text-[11px] ${late ? "text-amber-500" : "text-neutral-500"}`}>
          {late ? "Se pasó: " : column === "published" ? "Salió el " : column === "scheduled" ? "Sale el " : "Para "}
          {formatPartialDate(date)}
        </p>
      ) : isIdea ? (
        <p className="text-[11px] text-neutral-600">Sin fecha objetivo</p>
      ) : null}

      {item.note ? <p className="line-clamp-2 text-[11px] text-neutral-500">{item.note}</p> : null}

      <div className="flex flex-wrap gap-1.5">
        {column === "idea" ? (
          <button type="button" className={small} disabled={pending} onClick={() => onMove("research")}>
            Investigar
          </button>
        ) : null}
        {column === "research" ? (
          <button type="button" className={small} disabled={pending} onClick={() => onMove("idea")}>
            A ideas
          </button>
        ) : null}
        {isIdea ? (
          <button type="button" className={`${small} border-amber-900 text-amber-300 hover:border-amber-700`} disabled={pending} onClick={onWrite}>
            Escribir
          </button>
        ) : null}
        {item.postId ? (
          <Link href={`/contenido/blogs/${item.postId}`} className={small}>
            Abrir en Blogs
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function Pill({ item, column, compact = false }: { item: BoardItem; column: ColumnKey | null; compact?: boolean }) {
  const href = item.postId ? `/contenido/blogs/${item.postId}` : "#";
  const label = (
    <>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${column ? tones[column] : "bg-neutral-700"}`} aria-hidden />
      <span className="truncate">{item.title}</span>
    </>
  );
  const className = `flex min-w-0 items-center gap-1 rounded px-1 ${compact ? "text-[10px]" : "text-xs"} text-neutral-300 hover:bg-neutral-900`;
  return item.postId ? (
    <Link href={href} className={className} title={item.title}>
      {label}
    </Link>
  ) : (
    <span className={className} title={item.title}>
      {label}
    </span>
  );
}
