"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BsChevronLeft, BsChevronRight, BsPencil, BsTrash } from "react-icons/bs";
import DateField from "@/components/DateField";
import Toast from "@/components/Toast";
import Unsaved from "@/components/Unsaved";
import type { JournalWeekView } from "@/lib/journal";
import type { DayItem } from "@/lib/journal-draft";
import { useUnsavedChanges } from "@/lib/use-unsaved";
import type { ActionResult } from "@/app/(panel)/bitacora/actions";

const field =
  "rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none";
const labelClass = "font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500";
const button =
  "inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm transition-colors disabled:opacity-50";
const small =
  "inline-flex items-center gap-1 rounded border border-neutral-800 px-2 py-1 text-xs text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-100";

type Actions = {
  add: (at: string, text: string) => Promise<ActionResult>;
  update: (id: string, at: string, text: string) => Promise<ActionResult>;
  remove: (id: string) => Promise<ActionResult>;
  saveWeek: (week: string, summary: string) => Promise<ActionResult>;
};

/**
 * A week at a time: what the panel saw you do, and what you wrote about it.
 *
 * The automatic lines are greyed and the notes are not, because they are two
 * different kinds of truth — one is a record, the other is your account of it —
 * and reading them as one voice would blur which is which.
 */
export default function JournalModule({ view, actions }: { view: JournalWeekView; actions: Actions }) {
  const router = useRouter();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const defaultAt = view.isCurrent ? view.today : view.monday;
  const [at, setAt] = useState(defaultAt);
  const [text, setText] = useState("");
  const [summary, setSummary] = useState(view.summary);
  const [editing, setEditing] = useState<{ id: string; at: string; text: string } | null>(null);

  const summaryDirty = summary.trim() !== view.summary.trim();
  useUnsavedChanges(summaryDirty || text.trim() !== "" || editing !== null);

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

  const nav = "inline-flex items-center gap-1 rounded border border-neutral-800 px-2.5 py-1 text-xs text-neutral-400 hover:border-neutral-600 hover:text-neutral-100";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Bitácora</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Semana del {view.label}. Lo que el panel registró, junto a lo que
            escribiste tú.
          </p>
        </div>
        <nav className="flex items-center gap-1.5" aria-label="Semanas">
          <Link href={`/bitacora?semana=${view.prev}`} className={nav}>
            <BsChevronLeft className="h-3 w-3" aria-hidden />
            Anterior
          </Link>
          {!view.isCurrent ? (
            <Link href="/bitacora" className={nav}>
              Esta semana
            </Link>
          ) : null}
          {view.next ? (
            <Link href={`/bitacora?semana=${view.next}`} className={nav}>
              Siguiente
              <BsChevronRight className="h-3 w-3" aria-hidden />
            </Link>
          ) : null}
        </nav>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Hecho" value={String(view.counts.done)} note="Registrado por el panel" />
        <Stat label="Notas" value={String(view.counts.notes)} note="Escritas por ti" />
        <Stat label="Días con algo" value={`${view.counts.activeDays} de 7`} />
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-neutral-900 p-5">
        <h2 className="text-sm font-semibold">Añadir una nota</h2>
        <div className="grid gap-2 lg:grid-cols-[minmax(0,22rem)_1fr]">
          <DateField label="de la nota" allowTime value={at} onChange={setAt} placeholder="2026-10-04" />
          <textarea
            className={`${field} min-h-[2.4rem]`}
            rows={2}
            value={text}
            placeholder="Qué hiciste, qué aprendiste, qué quedó pendiente…"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Ctrl/⌘+Enter saves: a log you add to by reaching for the mouse
              // is a log you stop adding to.
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && text.trim()) {
                e.preventDefault();
                run(() => actions.add(at, text), () => setText(""));
              }
            }}
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={pending || !text.trim()}
            onClick={() => run(() => actions.add(at, text), () => setText(""))}
            className={`${button} border-neutral-700 text-neutral-200 hover:border-neutral-500`}
          >
            Añadir
          </button>
          <span className="text-[11px] text-neutral-600">Ctrl+Enter también la añade. La hora es opcional.</span>
        </div>
      </section>

      <ol className="flex flex-col gap-3">
        {view.days.map((day) => (
          <li
            key={day.date}
            className={`rounded-lg border p-4 ${day.date === view.today ? "border-neutral-700" : "border-neutral-900"}`}
          >
            <h3 className="flex items-baseline gap-2 text-sm font-semibold text-neutral-200">
              <span className="capitalize">{day.label}</span>
              {day.date === view.today ? <span className="text-[11px] font-normal text-neutral-500">hoy</span> : null}
            </h3>

            {day.items.length === 0 ? (
              <p className="mt-1 text-xs text-neutral-700">—</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1.5">
                {day.items.map((item, i) =>
                  item.noteId && editing?.id === item.noteId ? (
                    <li key={item.noteId} className="flex flex-col gap-2 rounded border border-neutral-800 p-2">
                      <DateField
                        label="de la nota"
                        allowTime
                        value={editing.at}
                        onChange={(v) => setEditing({ ...editing, at: v })}
                      />
                      <textarea
                        className={field}
                        rows={3}
                        value={editing.text}
                        onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                      />
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          disabled={pending}
                          className={`${small} border-green-800 text-green-300`}
                          onClick={() => run(() => actions.update(editing.id, editing.at, editing.text), () => setEditing(null))}
                        >
                          Guardar
                        </button>
                        <button type="button" className={small} onClick={() => setEditing(null)}>
                          Cancelar
                        </button>
                      </div>
                    </li>
                  ) : (
                    <Line
                      key={item.noteId ?? `${item.text}-${i}`}
                      item={item}
                      onEdit={
                        item.noteId
                          ? () => setEditing({ id: item.noteId!, at: item.at ?? day.date, text: item.text })
                          : undefined
                      }
                      onRemove={
                        item.noteId
                          ? () => {
                              if (!confirm("¿Mover esta nota a la papelera?")) return;
                              run(() => actions.remove(item.noteId!));
                            }
                          : undefined
                      }
                    />
                  ),
                )}
              </ul>
            )}
          </li>
        ))}
      </ol>

      <section className="flex flex-col gap-3 rounded-lg border border-neutral-900 p-5">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">La semana, en resumen</h2>
          {summaryDirty ? <Unsaved /> : null}
        </header>
        <textarea
          className={field}
          rows={5}
          value={summary}
          placeholder="Qué salió bien, qué no, qué sigue la semana que viene."
          onChange={(e) => setSummary(e.target.value)}
        />
        <div>
          <button
            type="button"
            disabled={pending || !summaryDirty}
            onClick={() => run(() => actions.saveWeek(view.monday, summary))}
            className={`${button} border-green-800 bg-green-950/60 text-green-300 hover:border-green-600`}
          >
            Guardar resumen
          </button>
        </div>
      </section>

      <Toast result={result} onDismiss={() => setResult(null)} />
    </div>
  );
}

function Line({ item, onEdit, onRemove }: { item: DayItem; onEdit?: () => void; onRemove?: () => void }) {
  const note = Boolean(item.noteId);
  return (
    <li className="group flex items-start gap-3 text-sm">
      <span className="w-11 shrink-0 pt-px font-mono text-[11px] text-neutral-600">{item.time ?? ""}</span>
      <p className={`min-w-0 flex-1 whitespace-pre-wrap ${note ? "text-neutral-100" : "text-neutral-500"}`}>
        {item.text}
        {item.count > 1 ? <span className="ml-1.5 text-[11px] text-neutral-600">×{item.count}</span> : null}
      </p>
      {note ? (
        <span className="flex shrink-0 gap-0.5">
          <button
            type="button"
            onClick={onEdit}
            aria-label="Editar la nota"
            className="rounded p-1 text-neutral-600 transition-colors hover:text-neutral-200"
          >
            <BsPencil className="h-3 w-3" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Mover la nota a la papelera"
            className="rounded p-1 text-neutral-600 transition-colors hover:text-red-400"
          >
            <BsTrash className="h-3 w-3" aria-hidden />
          </button>
        </span>
      ) : null}
    </li>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-neutral-900 p-4">
      <span className={labelClass}>{label}</span>
      <span className="text-xl font-semibold tracking-tight text-neutral-100">{value}</span>
      {note ? <span className="text-[11px] text-neutral-600">{note}</span> : null}
    </div>
  );
}
