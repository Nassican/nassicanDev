"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import {
  BsArrowRepeat,
  BsBook,
  BsCalendar3,
  BsCheck2Square,
  BsChevronLeft,
  BsChevronRight,
  BsController,
  BsFileText,
  BsHddStack,
  BsPencil,
  BsPencilSquare,
  BsPlus,
  BsTrash,
} from "react-icons/bs";
import DateField from "@/components/DateField";
import Toast from "@/components/Toast";
import Unsaved from "@/components/Unsaved";
import type { JournalWeekView } from "@/lib/journal";
import { longDayLabel, type DayItem, type LineKind } from "@/lib/journal-draft";
import { isDirty, useUnsavedChanges } from "@/lib/use-unsaved";
import type { ActionResult } from "@/app/(panel)/bitacora/actions";

const field =
  "rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none";
const labelClass = "font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500";
const small =
  "inline-flex items-center gap-1 rounded border border-neutral-800 px-2 py-1 text-xs text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-100 disabled:opacity-40";

const icons: Record<LineKind, ComponentType<{ className?: string }>> = {
  content: BsFileText,
  games: BsController,
  books: BsBook,
  subscriptions: BsArrowRepeat,
  tasks: BsCheck2Square,
  data: BsHddStack,
  note: BsPencilSquare,
};

/** How many routine lines a day shows before folding the rest behind a button. */
const ROUTINE_SHOWN = 3;

/**
 * Day names at three widths. The strip spans the whole page, so a wide screen
 * has room to say «Miércoles» and a phone has room for «X»; the note picker
 * lives in a narrow column at every size and always uses the short form.
 */
const INITIALS = ["L", "M", "X", "J", "V", "S", "D"];
const SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const FULL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/** The three priority slots, filled from what is saved and empty after. */
function toThree(saved: { id: string; text: string }[]): { id: string | null; text: string }[] {
  const filled = saved.map((p): { id: string | null; text: string } => ({ id: p.id, text: p.text }));
  return [...filled, ...Array.from({ length: 3 }, () => ({ id: null, text: "" }))].slice(0, 3);
}

type Actions = {
  add: (at: string, text: string) => Promise<ActionResult>;
  update: (id: string, at: string, text: string) => Promise<ActionResult>;
  remove: (id: string) => Promise<ActionResult>;
  saveReview: (
    week: string,
    review: { wentWell: string; change: string; summary: string },
    priorities: { id: string | null; text: string }[],
  ) => Promise<ActionResult>;
  togglePriority: (id: string, done: boolean) => Promise<ActionResult>;
  priorityToTask: (id: string) => Promise<ActionResult>;
};

/**
 * A week at a time, read in the order a person asks about it: what stood out,
 * which days were busy, and then the detail.
 *
 * Three weights, on purpose. Your notes are the loudest — they are the only
 * part written by you. What changed something (finished, published, paid)
 * comes next. Routine edits are greyed and folded after three a day: a week
 * held a hundred of them and a handful of the others, and at the same weight
 * the handful drowned.
 */
export default function JournalModule({ view, actions }: { view: JournalWeekView; actions: Actions }) {
  const router = useRouter();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const writable = view.days.filter((d) => d.date <= view.today);
  const [day, setDay] = useState(view.isCurrent ? view.today : view.days[0].date);
  const [time, setTime] = useState("");
  const [text, setText] = useState("");
  const [review, setReview] = useState(view.review);
  const [next, setNext] = useState(() => toThree(view.nextPriorities));
  const [editing, setEditing] = useState<{ id: string; at: string; text: string } | null>(null);
  const [unfolded, setUnfolded] = useState<Set<string>>(() => new Set());
  // Folded on a phone and always open on a wide screen, where they sit beside the week.
  const [composeOpen, setComposeOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const composer = useRef<HTMLTextAreaElement>(null);
  const jump = useRef<HTMLInputElement>(null);

  const reviewDirty = isDirty({ review: view.review, next: toThree(view.nextPriorities) }, { review, next });
  const reviewed = Boolean(view.review.wentWell || view.review.change || view.review.summary || view.nextPriorities.length);
  useUnsavedChanges(reviewDirty || text.trim() !== "" || editing !== null);

  /*
   * ← and → move between weeks, unless you are typing. Navigation, not state,
   * so it lives in a listener and never sets anything during a render.
   */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (e.key === "ArrowLeft") router.push(`/bitacora?semana=${view.prev}`);
      if (e.key === "ArrowRight" && view.next) router.push(`/bitacora?semana=${view.next}`);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, view.prev, view.next]);

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

  function addNote() {
    if (!text.trim()) return;
    run(() => actions.add(time ? `${day}T${time}` : day, text), () => {
      setText("");
      setTime("");
    });
  }

  /** «+ Nota» on a day: the one composer, pointed at that day. */
  function writeOn(date: string) {
    setDay(date);
    setComposeOpen(true);
    // After the render that unfolds the composer on a phone, or there is nothing to focus.
    requestAnimationFrame(() => {
      composer.current?.focus();
      composer.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }

  const busiest = Math.max(1, ...view.days.map((d) => d.items.reduce((n, i) => n + i.count, 0)));
  const nav =
    "inline-flex items-center gap-1 rounded border border-neutral-800 px-2.5 py-1.5 text-xs text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-100";

  return (
    <div className="flex flex-col gap-6">
      {/* ----------------------------- cabecera ----------------------------- */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Bitácora</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Lo que hiciste esta semana, en tus palabras y en las del panel.
          </p>
        </div>

        <nav className="flex items-center gap-1.5" aria-label="Semanas">
          <Link href={`/bitacora?semana=${view.prev}`} className={nav} aria-label="Semana anterior" title="Semana anterior (←)">
            <BsChevronLeft className="h-3 w-3" aria-hidden />
          </Link>
          {/* The date input sits over the button, outside it: an input inside a
              button is invalid HTML, and on touch it must take the tap itself. */}
          <span className="relative inline-flex">
            <button
              type="button"
              className={`${nav} min-w-[9rem] justify-center text-neutral-200 sm:min-w-[11rem]`}
              title="Ir a otra semana"
              onClick={() => {
                try {
                  jump.current?.showPicker();
                } catch {
                  jump.current?.focus();
                }
              }}
            >
              <BsCalendar3 className="h-3 w-3" aria-hidden />
              {view.label}
            </button>
            <input
              ref={jump}
              type="date"
              tabIndex={-1}
              aria-hidden
              max={view.today}
              className="pointer-events-none absolute inset-0 h-full w-full opacity-0 pointer-coarse:pointer-events-auto"
              value={view.monday}
              onChange={(e) => {
                if (e.target.value) router.push(`/bitacora?semana=${e.target.value}`);
              }}
            />
          </span>
          {view.next ? (
            <Link href={`/bitacora?semana=${view.next}`} className={nav} aria-label="Semana siguiente" title="Semana siguiente (→)">
              <BsChevronRight className="h-3 w-3" aria-hidden />
            </Link>
          ) : (
            <span className={`${nav} pointer-events-none opacity-30`} aria-hidden>
              <BsChevronRight className="h-3 w-3" />
            </span>
          )}
          {!view.isCurrent ? (
            <Link href="/bitacora" className={nav}>
              Hoy
            </Link>
          ) : null}
        </nav>
      </header>

      {/* ---------------------------- lo destacado ---------------------------- */}
      <section className="flex flex-wrap items-center gap-2" aria-label="Lo destacado de la semana">
        {view.highlights.length === 0 && view.counts.notes === 0 ? (
          <p className="text-sm text-neutral-500">
            {view.counts.routine > 0
              ? `Semana de mantenimiento: ${view.counts.routine} ${view.counts.routine === 1 ? "edición" : "ediciones"} y nada que destacar todavía.`
              : "Una semana en blanco. Una nota es un buen comienzo."}
          </p>
        ) : (
          <>
            {view.highlights.map((h) => {
              const Icon = icons[h.kind];
              return (
                <span
                  key={h.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-neutral-800 px-3 py-1 text-xs text-neutral-200"
                >
                  <Icon className="h-3.5 w-3.5 text-neutral-500" aria-hidden />
                  <span className="font-semibold tabular-nums">{h.count}</span> {h.label}
                </span>
              );
            })}
            {view.counts.notes > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs text-neutral-100">
                <BsPencilSquare className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
                <span className="font-semibold tabular-nums">{view.counts.notes}</span>{" "}
                {view.counts.notes === 1 ? "nota tuya" : "notas tuyas"}
              </span>
            ) : null}
          </>
        )}
      </section>

      {/* ----------------------------- la semana ----------------------------- */}
      <nav aria-label="Días" className="grid grid-cols-7 gap-1.5">
        {view.days.map((d, i) => {
          const amount = d.items.reduce((n, item) => n + item.count, 0);
          const notes = d.items.some((item) => item.noteId);
          const future = d.date > view.today;
          return (
            <a
              key={d.date}
              href={`#dia-${d.date}`}
              aria-label={`${longDayLabel(d.date)}: ${amount === 0 ? "sin actividad" : `${amount} ${amount === 1 ? "cosa" : "cosas"}`}`}
              className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-2 transition-colors ${
                d.date === view.today ? "border-neutral-600" : "border-neutral-900 hover:border-neutral-700"
              } ${future ? "pointer-events-none opacity-40" : ""}`}
            >
              <span className="text-[10px] text-neutral-500 xl:text-xs">
                <span className="sm:hidden">{INITIALS[i]}</span>
                <span className="hidden sm:inline xl:hidden">{SHORT[i]}</span>
                <span className="hidden xl:inline">{FULL[i]}</span>
              </span>
              <span className="text-sm font-semibold tabular-nums text-neutral-200">{Number(d.date.slice(8))}</span>
              {/* Height is how busy the day was, against the busiest of the week. */}
              <span className="flex h-6 w-full items-end justify-center" aria-hidden>
                <span
                  className="w-3 rounded-sm bg-neutral-600"
                  style={{ height: amount === 0 ? 2 : `${Math.max(12, (amount / busiest) * 100)}%` }}
                />
              </span>
              <span className={`h-1 w-1 rounded-full ${notes ? "bg-neutral-200" : "bg-transparent"}`} aria-hidden />
            </a>
          );
        })}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* ---------------------- escribir y resumir (lateral) ---------------------- */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:order-2 lg:self-start">
          <button
            type="button"
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-neutral-700 py-2.5 text-sm text-neutral-100 lg:hidden ${composeOpen ? "hidden" : ""}`}
            onClick={() => setComposeOpen(true)}
          >
            <BsPlus className="h-4 w-4" aria-hidden />
            Escribir una nota
          </button>
          <section className={`${composeOpen ? "flex" : "hidden"} flex-col gap-3 rounded-lg border border-neutral-900 p-4 lg:flex`}>
            <h2 className="text-sm font-semibold">Escribir una nota</h2>

            <div className="flex flex-col gap-1.5">
              <span className={labelClass}>Día</span>
              <div className="grid grid-cols-7 gap-1" role="radiogroup" aria-label="Día de la nota">
                {view.days.map((d, i) => {
                  const allowed = writable.some((w) => w.date === d.date);
                  return (
                    <button
                      key={d.date}
                      type="button"
                      role="radio"
                      aria-checked={day === d.date}
                      aria-label={longDayLabel(d.date)}
                      title={longDayLabel(d.date)}
                      disabled={!allowed}
                      onClick={() => setDay(d.date)}
                      className={`rounded py-1 text-xs transition-colors disabled:opacity-25 ${
                        day === d.date
                          ? "bg-neutral-200 font-semibold text-neutral-950"
                          : "border border-neutral-800 text-neutral-400 hover:border-neutral-600"
                      }`}
                    >
                      {SHORT[i]}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-neutral-500">{longDayLabel(day)}</p>
            </div>

            <label className="flex items-center gap-2 text-xs text-neutral-500">
              Hora
              <input
                type="time"
                className={`${field} w-28 py-1 font-mono`}
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
              {time ? (
                <button type="button" className="text-neutral-500 hover:text-neutral-200" onClick={() => setTime("")}>
                  quitar
                </button>
              ) : (
                <span className="text-[11px] text-neutral-600">opcional</span>
              )}
            </label>

            <textarea
              ref={composer}
              className={field}
              rows={4}
              value={text}
              placeholder="Qué hiciste, qué aprendiste, qué quedó pendiente…"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                // Ctrl/⌘+Enter saves: a log you add to by reaching for the
                // mouse is a log you stop adding to.
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  addNote();
                }
              }}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-neutral-600">Ctrl+Enter para guardar</span>
              <button
                type="button"
                disabled={pending || !text.trim()}
                onClick={addNote}
                className="rounded border border-neutral-600 bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-950 transition-colors hover:bg-white disabled:opacity-40"
              >
                Guardar nota
              </button>
            </div>
          </section>

          {/* Folded on a phone, so the week is not a screen of form away. */}
          <button
            type="button"
            className={`${small} justify-center py-2 lg:hidden ${summaryOpen ? "hidden" : ""}`}
            onClick={() => setSummaryOpen(true)}
          >
            {reviewed ? "Ver la revisión de la semana" : "Hacer la revisión de la semana"}
          </button>
          <section className={`${summaryOpen ? "flex" : "hidden"} flex-col gap-4 rounded-lg border border-neutral-900 p-4 lg:flex`}>
            <header className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Revisión de la semana</h2>
              {reviewDirty ? <Unsaved /> : null}
            </header>

            {/*
              What last week's review promised, ticked here. Seeing whether the
              plan held is the half of a review that makes the next plan better.
            */}
            {view.priorities.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <span className={labelClass}>Te propusiste</span>
                {view.priorities.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="checkbox"
                    aria-checked={p.done}
                    disabled={pending}
                    onClick={() => run(() => actions.togglePriority(p.id, !p.done))}
                    className="flex items-start gap-2 text-left text-sm"
                  >
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        p.done ? "border-green-700 bg-green-950 text-green-400" : "border-neutral-600"
                      }`}
                      aria-hidden
                    >
                      {p.done ? "✓" : ""}
                    </span>
                    <span className={p.done ? "text-neutral-500 line-through" : "text-neutral-200"}>{p.text}</span>
                  </button>
                ))}
              </div>
            ) : null}

            {view.toDecide.inbox + view.toDecide.overdue > 0 ? (
              <Link
                href="/pendientes"
                className="rounded border border-amber-900/50 bg-amber-950/15 px-3 py-2 text-xs text-amber-300 hover:border-amber-700"
              >
                Por decidir: {view.toDecide.inbox} en la bandeja · {view.toDecide.overdue} atrasados →
              </Link>
            ) : null}

            <label className="flex flex-col gap-1">
              <span className={labelClass}>¿Qué salió bien?</span>
              <textarea
                className={field}
                rows={3}
                value={review.wentWell}
                onChange={(e) => setReview({ ...review, wentWell: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelClass}>¿Qué cambiarías?</span>
              <textarea
                className={field}
                rows={3}
                value={review.change}
                onChange={(e) => setReview({ ...review, change: e.target.value })}
              />
            </label>

            <div className="flex flex-col gap-1.5">
              <span className={labelClass}>Tres prioridades · {view.nextLabel}</span>
              {next.map((p, i) => (
                <div key={i} className="flex gap-1.5">
                  <input
                    className={`${field} min-w-0 flex-1`}
                    value={p.text}
                    placeholder={`Prioridad ${i + 1}`}
                    aria-label={`Prioridad ${i + 1}`}
                    onChange={(e) => setNext(next.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                  />
                  {p.id && !reviewDirty ? (
                    <button
                      type="button"
                      className={small}
                      disabled={pending}
                      title="Crear un pendiente con esta prioridad"
                      onClick={() => run(() => actions.priorityToTask(p.id!))}
                    >
                      → Pendiente
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            <label className="flex flex-col gap-1">
              <span className={labelClass}>Notas libres</span>
              <textarea
                className={field}
                rows={2}
                value={review.summary}
                onChange={(e) => setReview({ ...review, summary: e.target.value })}
              />
            </label>

            <button
              type="button"
              disabled={pending || !reviewDirty}
              onClick={() => run(() => actions.saveReview(view.monday, review, next))}
              className={`${small} self-start border-green-800 text-green-300 hover:border-green-600`}
            >
              Guardar revisión
            </button>
          </section>

          <p className="hidden px-1 text-[11px] leading-relaxed text-neutral-600 lg:block">
            Se arma con la auditoría, pero no la reemplaza: pliega las ediciones
            repetidas, deja fuera lo rutinario y tus notas se pueden cambiar. El
            registro completo, con quién y desde dónde, está en{" "}
            <Link href="/sistema#auditoria" className="text-neutral-400 underline-offset-2 hover:underline">
              Sistema → Auditoría
            </Link>
            .
          </p>
        </aside>

        {/* ------------------------------ los días ------------------------------ */}
        <ol className="flex flex-col gap-3 lg:order-1">
          {view.days.map((d) => {
            const future = d.date > view.today;
            if (future) return null;

            const notes = d.items.filter((i) => i.noteId);
            const highlights = d.items.filter((i) => !i.noteId && i.highlight);
            const routine = d.items.filter((i) => !i.noteId && !i.highlight);
            const open = unfolded.has(d.date);
            const routineShown = open ? routine : routine.slice(0, ROUTINE_SHOWN);
            const hidden = routine.length - routineShown.length;
            const empty = d.items.length === 0;

            return (
              <li
                key={d.date}
                id={`dia-${d.date}`}
                className={`scroll-mt-6 rounded-lg border ${
                  d.date === view.today ? "border-neutral-700" : "border-neutral-900"
                } ${empty ? "px-4 py-2.5" : "p-4"}`}
              >
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className={`text-sm ${empty ? "text-neutral-600" : "font-semibold text-neutral-100"}`}>
                    {longDayLabel(d.date)}
                    {d.date === view.today ? (
                      <span className="ml-2 rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] font-normal text-neutral-300">hoy</span>
                    ) : null}
                    {empty ? <span className="ml-2 text-xs font-normal">· sin actividad</span> : null}
                  </h3>
                  <button type="button" className={small} onClick={() => writeOn(d.date)} aria-label={`Escribir una nota el ${longDayLabel(d.date)}`}>
                    <BsPlus className="h-3.5 w-3.5" aria-hidden />
                    Nota
                  </button>
                </header>

                {notes.length > 0 ? (
                  <ul className="mt-3 flex flex-col gap-2">
                    {notes.map((item) =>
                      editing && editing.id === item.noteId ? (
                        <li key={item.noteId} className="flex flex-col gap-2 rounded-md border border-neutral-700 p-3">
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
                              onClick={() =>
                                run(() => actions.update(editing.id, editing.at, editing.text), () => setEditing(null))
                              }
                            >
                              Guardar
                            </button>
                            <button type="button" className={small} onClick={() => setEditing(null)}>
                              Cancelar
                            </button>
                          </div>
                        </li>
                      ) : (
                        <Note
                          key={item.noteId}
                          item={item}
                          onEdit={() => setEditing({ id: item.noteId!, at: item.at ?? d.date, text: item.text })}
                          onRemove={() => {
                            if (!confirm("¿Mover esta nota a la papelera? Se puede restaurar durante 30 días.")) return;
                            run(() => actions.remove(item.noteId!));
                          }}
                        />
                      ),
                    )}
                  </ul>
                ) : null}

                {highlights.length > 0 || routineShown.length > 0 ? (
                  <ul className="mt-3 flex flex-col gap-1">
                    {highlights.map((item, i) => (
                      <Line key={`h-${item.text}-${i}`} item={item} />
                    ))}
                    {routineShown.map((item, i) => (
                      <Line key={`r-${item.text}-${i}`} item={item} />
                    ))}
                  </ul>
                ) : null}

                {hidden > 0 || (open && routine.length > ROUTINE_SHOWN) ? (
                  <button
                    type="button"
                    className="mt-2 text-xs text-neutral-500 hover:text-neutral-200"
                    aria-expanded={open}
                    onClick={() => {
                      const next = new Set(unfolded);
                      if (open) next.delete(d.date);
                      else next.add(d.date);
                      setUnfolded(next);
                    }}
                  >
                    {open ? "Mostrar menos" : `Ver ${hidden} ${hidden === 1 ? "edición más" : "ediciones más"}`}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ol>

        {/* On a phone the note about the audit trail closes the page instead of opening it. */}
        <p className="px-1 text-[11px] leading-relaxed text-neutral-600 lg:hidden">
          Se arma con la auditoría, pero no la reemplaza. El registro completo está en{" "}
          <Link href="/sistema#auditoria" className="text-neutral-400 underline-offset-2 hover:underline">
            Sistema → Auditoría
          </Link>
          .
        </p>
      </div>

      <Toast result={result} onDismiss={() => setResult(null)} />
    </div>
  );
}

function Line({ item }: { item: DayItem }) {
  const Icon = icons[item.kind];
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <span className="w-10 shrink-0 pt-0.5 font-mono text-[11px] text-neutral-600">{item.time ?? ""}</span>
      <Icon
        className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${item.highlight ? "text-neutral-300" : "text-neutral-700"}`}
        aria-hidden
      />
      <p className={`min-w-0 flex-1 ${item.highlight ? "text-neutral-200" : "text-xs leading-5 text-neutral-500"}`}>
        {item.text}
        {item.count > 1 ? <span className="ml-1.5 text-[11px] text-neutral-600">×{item.count}</span> : null}
      </p>
    </li>
  );
}

function Note({ item, onEdit, onRemove }: { item: DayItem; onEdit: () => void; onRemove: () => void }) {
  return (
    <li className="group flex items-start gap-3 rounded-md border border-neutral-800 bg-neutral-900/50 px-3 py-2.5">
      <BsPencilSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-100">{item.text}</p>
        {item.time ? <p className="mt-1 font-mono text-[11px] text-neutral-500">{item.time}</p> : null}
      </div>
      <span className="flex shrink-0 gap-0.5 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100">
        <button
          type="button"
          onClick={onEdit}
          aria-label="Editar la nota"
          className="rounded p-1 text-neutral-500 transition-colors hover:text-neutral-200"
        >
          <BsPencil className="h-3 w-3" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Mover la nota a la papelera"
          className="rounded p-1 text-neutral-500 transition-colors hover:text-red-400"
        >
          <BsTrash className="h-3 w-3" aria-hidden />
        </button>
      </span>
    </li>
  );
}
