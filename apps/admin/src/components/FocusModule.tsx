"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BsBell, BsCupHot, BsPencil, BsStopwatch, BsTrash } from "react-icons/bs";
import Toast from "@/components/Toast";
import type { FocusResult } from "@/app/(panel)/enfoque/actions";
import { announceFocus, useClock, useFocusState, useNotificationPermission } from "@/lib/focus-clock";
import {
  MAX_RETURN_NOTE,
  focusFormats,
  focusPhase,
  formatClock,
  formatDuration,
  labelKey,
  type FocusNow,
} from "@/lib/focus-draft";
import type { FocusView } from "@/lib/focus";
import { longDayLabel } from "@/lib/journal-draft";

const field =
  "w-full rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none";
const labelClass = "font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500";
const small =
  "inline-flex items-center gap-1 rounded border border-neutral-800 px-2 py-1 text-xs text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-100 disabled:opacity-40";
const iconButton = "rounded p-1.5 text-neutral-500 transition-colors hover:text-neutral-200";
const primary =
  "rounded border border-neutral-600 bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-950 transition-colors hover:bg-white disabled:opacity-40";

type Actions = {
  start: (fields: { label: string; taskId: string | null; format: string }) => Promise<FocusResult>;
  finish: (id: string, returnNote: string, taskDone: boolean) => Promise<FocusResult>;
  note: (id: string, returnNote: string) => Promise<FocusResult>;
  discard: (id: string) => Promise<FocusResult>;
};

const whenLabels = { overdue: "Atrasados", today: "Para hoy", later: "Más adelante y bandeja" } as const;

/**
 * Focus blocks: a fixed stretch of work, a fixed break, and one line on where
 * you left it.
 *
 * The line is the part that is not a stopwatch. Leroy (2009) found attention
 * stays behind on an interrupted task, and that a plan for picking it up again
 * is what lets it go. So closing a block asks for that plan, and starting one
 * on the same thing shows it back.
 */
export default function FocusModule({ view, actions }: { view: FocusView; actions: Actions }) {
  const router = useRouter();
  const [result, setResult] = useState<FocusResult | null>(null);
  const [pending, startTransition] = useTransition();
  const initial: FocusNow = { running: view.running, last: view.last };
  const state = useFocusState(initial) ?? initial;
  const now = useClock();
  const phase = now > 0 ? focusPhase(state.running, state.last, now) : null;

  const [format, setFormat] = useState(focusFormats[0].key);
  const [taskId, setTaskId] = useState<string>("");
  const [label, setLabel] = useState("");
  const [closing, setClosing] = useState(false);
  const [returnNote, setReturnNote] = useState("");
  const [taskDone, setTaskDone] = useState(false);
  const [permission, askPermission] = useNotificationPermission();

  function run(action: () => Promise<FocusResult>, after?: () => void) {
    setResult(null);
    startTransition(async () => {
      const outcome = await action();
      setResult(outcome);
      if (outcome.now) announceFocus(outcome.now);
      if (outcome.ok) {
        after?.();
        router.refresh();
      }
    });
  }

  const task = view.tasks.find((t) => t.id === taskId) ?? null;
  const running = state.running;
  // What to show back: the note left on this task, or on this same free label.
  const resumeFor = (id: string | null, text: string) =>
    (id ? view.resume.byTask[id] : undefined) ?? (text.trim() ? view.resume.byLabel[labelKey(text)] : undefined);
  const resume = running ? resumeFor(running.taskId, running.label) : resumeFor(taskId || null, label || task?.title || "");

  const waitingForNote = running && (closing || phase?.kind === "over");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Enfoque</h1>
          <p className="mt-1 max-w-prose text-sm text-neutral-500">
            Un bloque de trabajo con su pausa fija. Al cerrarlo, una línea de dónde lo dejaste: la próxima vez
            que empieces con lo mismo, aparece aquí.
          </p>
        </div>
        {permission === "default" ? (
          <button type="button" className={small} onClick={askPermission}>
            <BsBell className="h-3 w-3" aria-hidden />
            Avisarme al terminar
          </button>
        ) : permission === "denied" ? (
          <p className="text-[11px] text-neutral-500">
            El navegador bloqueó los avisos; el reloj sigue en la pestaña.
          </p>
        ) : null}
      </header>

      {/* ------------------------------ el bloque ------------------------------ */}
      <section className="flex flex-col gap-4 rounded-lg border border-neutral-800 p-5" aria-label="Bloque actual">
        {running ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <p className={labelClass}>{phase?.kind === "over" ? "Tiempo" : "En marcha"}</p>
                <p className="mt-1 truncate text-base text-neutral-100">{running.label}</p>
              </div>
              <p
                className={`font-mono text-5xl tabular-nums tracking-tight ${
                  phase?.kind === "over" ? "text-amber-400" : "text-neutral-100"
                }`}
                aria-live="off"
              >
                {phase?.kind === "work" ? formatClock(phase.remainingMs) : phase?.kind === "over" ? "0:00" : "—"}
              </p>
            </div>

            {resume ? <ResumeNote text={resume} /> : null}

            {waitingForNote ? (
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(
                    () => actions.finish(running.id, returnNote, taskDone),
                    () => {
                      setClosing(false);
                      setReturnNote("");
                      setTaskDone(false);
                    },
                  );
                }}
              >
                <label className="flex flex-col gap-1">
                  <span className={labelClass}>Dónde lo dejas</span>
                  <textarea
                    className={`${field} min-h-20`}
                    value={returnNote}
                    maxLength={MAX_RETURN_NOTE}
                    autoFocus
                    placeholder="El siguiente paso es… / Me quedé en…"
                    onChange={(e) => setReturnNote(e.target.value)}
                  />
                  <span className="text-[11px] text-neutral-500">
                    Una línea basta. Es para quien retome esto, que vas a ser tú sin el contexto de ahora.
                  </span>
                </label>
                {running.taskId ? (
                  <label className="flex items-center gap-2 text-sm text-neutral-300">
                    <input type="checkbox" checked={taskDone} onChange={(e) => setTaskDone(e.target.checked)} />
                    El pendiente quedó hecho
                  </label>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <button type="submit" className={primary} disabled={pending}>
                    {phase?.kind === "over" ? "Guardar y descansar" : "Cerrar el bloque"}
                  </button>
                  {closing && phase?.kind === "work" ? (
                    <button type="button" className={small} onClick={() => setClosing(false)}>
                      Seguir con el bloque
                    </button>
                  ) : null}
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button type="button" className={small} onClick={() => setClosing(true)}>
                  Terminar ahora
                </button>
                <button
                  type="button"
                  className={`${small} border-red-900/60 text-red-400`}
                  disabled={pending}
                  onClick={() => {
                    if (!confirm("¿Descartar este bloque? No contará en las horas de foco.")) return;
                    run(() => actions.discard(running.id));
                  }}
                >
                  Descartar
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            {phase?.kind === "break" ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-green-900/60 bg-green-950/30 px-4 py-3">
                <p className="flex items-center gap-2 text-sm text-green-300">
                  <BsCupHot className="h-4 w-4" aria-hidden />
                  Descanso. Levántate de la silla: la pausa cuenta si de verdad lo es.
                </p>
                <span className="font-mono text-2xl tabular-nums text-green-300">{formatClock(phase.remainingMs)}</span>
              </div>
            ) : null}

            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  () => actions.start({ label, taskId: taskId || null, format }),
                  () => setLabel(""),
                );
              }}
            >
              <div className="flex flex-col gap-1.5">
                <span className={labelClass}>Duración</span>
                <div className="flex gap-2" role="radiogroup" aria-label="Duración del bloque">
                  {focusFormats.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      role="radio"
                      aria-checked={format === f.key}
                      onClick={() => setFormat(f.key)}
                      className={`rounded border px-3 py-1.5 font-mono text-sm tabular-nums transition-colors ${
                        format === f.key
                          ? "border-neutral-400 text-neutral-100"
                          : "border-neutral-800 text-neutral-500 hover:border-neutral-600"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className={labelClass}>Pendiente</span>
                  <select className={field} value={taskId} onChange={(e) => setTaskId(e.target.value)}>
                    <option value="">Ninguno</option>
                    {(["overdue", "today", "later"] as const).map((when) => {
                      const group = view.tasks.filter((t) => t.when === when);
                      return group.length > 0 ? (
                        <optgroup key={when} label={whenLabels[when]}>
                          {group.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.title}
                            </option>
                          ))}
                        </optgroup>
                      ) : null;
                    })}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className={labelClass}>{task ? "Nombre del bloque (opcional)" : "En qué vas a trabajar"}</span>
                  <input
                    className={field}
                    value={label}
                    maxLength={200}
                    placeholder={task ? task.title : "Revisar el informe"}
                    onChange={(e) => setLabel(e.target.value)}
                  />
                </label>
              </div>

              {resume ? <ResumeNote text={resume} /> : null}

              <div>
                <button type="submit" className={`${primary} inline-flex items-center gap-1.5`} disabled={pending}>
                  <BsStopwatch className="h-4 w-4" aria-hidden />
                  Empezar {formatDuration(focusFormats.find((f) => f.key === format)?.work ?? 25)}
                </button>
              </div>
            </form>
          </>
        )}
      </section>

      {/* ------------------------------ las cifras ------------------------------ */}
      <section className="grid gap-3 sm:grid-cols-3" aria-label="Horas de foco">
        <Figure label="Hoy" value={formatDuration(view.minutesToday)} />
        <Figure label="Bloques hoy" value={String(view.blocksToday)} />
        <Figure label="Esta semana" value={formatDuration(view.minutesWeek)} />
      </section>

      {/* ------------------------------ la semana ------------------------------ */}
      <section className="flex flex-col gap-4" aria-labelledby="semana-foco">
        <h2 id="semana-foco" className="text-sm font-semibold">
          Esta semana
        </h2>
        {view.days.length === 0 ? (
          <p className="text-sm text-neutral-500">Ningún bloque cerrado esta semana todavía.</p>
        ) : (
          view.days.map((day) => (
            <div key={day.date} className="flex flex-col gap-1.5">
              <p className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-neutral-200">{longDayLabel(day.date)}</span>
                <span className="font-mono text-[11px] text-neutral-500">{formatDuration(day.minutes)}</span>
              </p>
              <ul className="flex flex-col divide-y divide-neutral-900 rounded-lg border border-neutral-900">
                {day.blocks.map((block) => (
                  <BlockRow key={block.id} block={block} pending={pending} run={run} actions={actions} />
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      <Toast result={result} onDismiss={() => setResult(null)} />
    </div>
  );
}

function ResumeNote({ text }: { text: string }) {
  return (
    <div className="rounded border border-neutral-800 bg-neutral-900/50 px-3 py-2">
      <p className={labelClass}>La última vez lo dejaste en</p>
      <p className="mt-1 whitespace-pre-line text-sm text-neutral-200">{text}</p>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-neutral-900 p-4">
      <span className={labelClass}>{label}</span>
      <span className="font-mono text-xl tabular-nums text-neutral-100">{value}</span>
    </div>
  );
}

function BlockRow({
  block,
  pending,
  run,
  actions,
}: {
  block: FocusView["days"][number]["blocks"][number];
  pending: boolean;
  run: (action: () => Promise<FocusResult>, after?: () => void) => void;
  actions: Actions;
}) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(block.returnNote ?? "");
  const cut = block.minutes < block.plannedMinutes;

  return (
    <li className="flex flex-col gap-1.5 px-3 py-2">
      <div className="flex items-center gap-3">
        <span className="w-11 shrink-0 font-mono text-[11px] text-neutral-500">{block.time}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-neutral-200">{block.label}</span>
        <span className={`shrink-0 font-mono text-[11px] tabular-nums ${cut ? "text-neutral-500" : "text-neutral-300"}`}>
          {block.minutes} / {block.plannedMinutes} min
        </span>
        <button
          type="button"
          className={iconButton}
          aria-label={`Editar la nota de «${block.label}»`}
          onClick={() => setEditing(!editing)}
        >
          <BsPencil className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          className={`${iconButton} hover:text-red-400`}
          aria-label={`Borrar el bloque «${block.label}»`}
          disabled={pending}
          onClick={() => {
            if (!confirm(`¿Borrar el bloque «${block.label}» de las ${block.time}? Deja de contar en las horas de foco.`)) return;
            run(() => actions.discard(block.id));
          }}
        >
          <BsTrash className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      {editing ? (
        <form
          className="flex flex-col gap-2 pl-14"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => actions.note(block.id, note), () => setEditing(false));
          }}
        >
          <textarea
            className={`${field} min-h-16`}
            value={note}
            maxLength={MAX_RETURN_NOTE}
            placeholder="Dónde lo dejaste"
            aria-label="Dónde lo dejaste"
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex gap-2">
            <button type="submit" className={small} disabled={pending}>
              Guardar nota
            </button>
            <button type="button" className={small} onClick={() => setEditing(false)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : block.returnNote ? (
        <p className="whitespace-pre-line pl-14 text-xs text-neutral-400">{block.returnNote}</p>
      ) : null}
    </li>
  );
}
