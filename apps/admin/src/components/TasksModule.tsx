"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BsArrowCounterclockwise, BsCalendar3, BsCheck2, BsPencil, BsTrash, BsX } from "react-icons/bs";
import DateField from "@/components/DateField";
import Toast from "@/components/Toast";
import {
  groupTasks,
  quickDays,
  relativeDay,
  taskProblems,
  type TaskGroupKey,
  type TaskRow,
} from "@/lib/task-draft";
import type { TasksSummary } from "@/lib/tasks";
import { useUnsavedChanges } from "@/lib/use-unsaved";
import type { ActionResult } from "@/app/(panel)/pendientes/actions";

const field =
  "rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none";
const chip =
  "rounded border border-neutral-800 px-2 py-1 text-xs text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-100 disabled:opacity-40";
const iconButton = "rounded p-1.5 text-neutral-500 transition-colors hover:text-neutral-200";

type Actions = {
  capture: (raw: string, area?: string) => Promise<ActionResult>;
  save: (id: string, fields: { title: string; plannedFor: string; area: string; note: string }) => Promise<ActionResult>;
  plan: (id: string, plannedFor: string | null) => Promise<ActionResult>;
  finish: (id: string, outcome: "done" | "dropped") => Promise<ActionResult>;
  reopen: (id: string) => Promise<ActionResult>;
  remove: (id: string) => Promise<ActionResult>;
};

const groupHints: Partial<Record<TaskGroupKey, string>> = {
  overdue: "Se pasó el día. Vuelve a planificarlo o descártalo: las dos cosas lo sacan de la cabeza.",
  inbox: "Todavía sin día. Darle uno es lo que hace que deje de rondarte.",
};

/**
 * Capture fast, plan with a day, close by doing or by dropping.
 *
 * The inbox is at the bottom on purpose: what has a day is what you act on,
 * and the inbox is a queue of decisions, not of work. Planning is one tap for
 * the usual days, because a plan that costs effort is a plan not made.
 */
export default function TasksModule({ summary, actions }: { summary: TasksSummary; actions: Actions }) {
  const router = useRouter();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [area, setArea] = useState("");
  const [onlyArea, setOnlyArea] = useState("");
  const [planning, setPlanning] = useState<{ id: string; value: string } | null>(null);
  const [editing, setEditing] = useState<{ id: string; title: string; plannedFor: string; area: string; note: string } | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useUnsavedChanges(text.trim() !== "" || editing !== null);

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

  function capture() {
    if (!text.trim()) return;
    run(() => actions.capture(text, area), () => {
      setText("");
      input.current?.focus();
    });
  }

  const visible = (t: TaskRow) => !onlyArea || t.area === onlyArea;
  const groups = groupTasks(summary.open.filter(visible), summary.today);
  const closed = summary.closed.filter(visible);
  const days = quickDays(summary.today);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Pendientes</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Apunta rápido, dale un día y ciérralo: haciéndolo o descartándolo.
        </p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
          <span>
            <span className="font-semibold text-neutral-200">{summary.counts.inbox}</span> en la bandeja
          </span>
          <span className={summary.counts.overdue > 0 ? "text-amber-500" : ""}>
            <span className="font-semibold">{summary.counts.overdue}</span> atrasados
          </span>
          <span>
            <span className="font-semibold text-neutral-200">{summary.counts.doneThisWeek}</span> hechos esta semana
          </span>
        </p>
      </header>

      {/* ------------------------------ capturar ------------------------------ */}
      <section className="flex flex-col gap-2 rounded-lg border border-neutral-800 p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            ref={input}
            className={`${field} min-w-0 flex-1`}
            value={text}
            placeholder="Apunta algo… termina en «hoy» o «mañana» para planificarlo"
            aria-label="Nuevo pendiente"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                capture();
              }
            }}
          />
          <input
            className={`${field} sm:w-40`}
            value={area}
            list="task-areas"
            placeholder="Área (opcional)"
            aria-label="Área"
            onChange={(e) => setArea(e.target.value)}
          />
          <button
            type="button"
            disabled={pending || !text.trim()}
            onClick={capture}
            className="rounded border border-neutral-600 bg-neutral-100 px-4 py-1.5 text-sm font-medium text-neutral-950 transition-colors hover:bg-white disabled:opacity-40"
          >
            Apuntar
          </button>
        </div>
        <p className="text-[11px] text-neutral-600">
          También desde cualquier pantalla: abre «Buscar» (Ctrl K) y escribe «+» delante.
        </p>
        <datalist id="task-areas">
          {summary.areas.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
      </section>

      {summary.areas.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Filtrar por área">
          {["", ...summary.areas].map((a) => (
            <button
              key={a || "todas"}
              type="button"
              role="radio"
              aria-checked={onlyArea === a}
              onClick={() => setOnlyArea(a)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                onlyArea === a ? "bg-neutral-200 text-neutral-950" : "border border-neutral-800 text-neutral-400 hover:border-neutral-600"
              }`}
            >
              {a || "Todas"}
            </button>
          ))}
        </div>
      ) : null}

      {/* -------------------------------- grupos -------------------------------- */}
      {groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-800 px-4 py-10 text-center text-sm text-neutral-500">
          Nada pendiente{onlyArea ? ` en «${onlyArea}»` : ""}. Apunta lo primero que te ronde la cabeza.
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="flex flex-col gap-2">
            <h2 className="flex items-baseline gap-2 text-sm font-semibold">
              <span className={group.key === "overdue" ? "text-amber-500" : "text-neutral-200"}>{group.label}</span>
              <span className="text-xs font-normal text-neutral-600">{group.tasks.length}</span>
            </h2>
            {groupHints[group.key] ? <p className="-mt-1 text-[11px] text-neutral-600">{groupHints[group.key]}</p> : null}

            <ul className="flex flex-col divide-y divide-neutral-900 overflow-hidden rounded-lg border border-neutral-900">
              {group.tasks.map((task) =>
                editing?.id === task.id ? (
                  <li key={task.id} className="flex flex-col gap-2 px-4 py-3">
                    <input
                      className={field}
                      value={editing.title}
                      aria-label="Qué hay que hacer"
                      onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <DateField
                        label="del plan"
                        allowTime
                        placeholder="Sin día: a la bandeja"
                        value={editing.plannedFor}
                        onChange={(v) => setEditing({ ...editing, plannedFor: v })}
                      />
                      <input
                        className={field}
                        value={editing.area}
                        list="task-areas"
                        placeholder="Área"
                        aria-label="Área"
                        onChange={(e) => setEditing({ ...editing, area: e.target.value })}
                      />
                    </div>
                    <textarea
                      className={field}
                      rows={2}
                      value={editing.note}
                      placeholder="Nota: dónde, cómo, con quién…"
                      onChange={(e) => setEditing({ ...editing, note: e.target.value })}
                    />
                    {taskProblems(editing).length > 0 ? (
                      <p className="text-xs text-amber-500">{taskProblems(editing).join(" ")}</p>
                    ) : null}
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        className={`${chip} border-green-800 text-green-300`}
                        disabled={pending || taskProblems(editing).length > 0}
                        onClick={() => run(() => actions.save(editing.id, editing), () => setEditing(null))}
                      >
                        Guardar
                      </button>
                      <button type="button" className={chip} onClick={() => setEditing(null)}>
                        Cancelar
                      </button>
                    </div>
                  </li>
                ) : (
                  <li key={task.id} className="flex flex-col gap-2 px-4 py-3">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => actions.finish(task.id, "done"))}
                        aria-label={`Marcar «${task.title}» como hecho`}
                        title="Hecho"
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-neutral-600 text-transparent transition-colors hover:border-green-500 hover:text-green-400"
                      >
                        <BsCheck2 className="h-3 w-3" aria-hidden />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-neutral-100">{task.title}</p>
                        <p className="text-[11px] text-neutral-500">
                          {[
                            task.plannedFor ? relativeDay(task.plannedFor, summary.today) : null,
                            task.area,
                            task.note,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center">
                        <button
                          type="button"
                          className={iconButton}
                          aria-label={`Editar «${task.title}»`}
                          onClick={() =>
                            setEditing({
                              id: task.id,
                              title: task.title,
                              plannedFor: task.plannedFor ?? "",
                              area: task.area ?? "",
                              note: task.note ?? "",
                            })
                          }
                        >
                          <BsPencil className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className={`${iconButton} hover:text-red-400`}
                          aria-label={`Mover «${task.title}» a la papelera`}
                          onClick={() => {
                            if (!confirm(`¿Mover «${task.title}» a la papelera?`)) return;
                            run(() => actions.remove(task.id));
                          }}
                        >
                          <BsTrash className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    </div>

                    {/* Planning is the action this list exists for, so it is one tap. */}
                    <div className="flex flex-wrap items-center gap-1.5 pl-8">
                      {days
                        .filter((d) => d.date !== task.plannedFor?.slice(0, 10))
                        .map((d) => (
                          <button
                            key={d.date}
                            type="button"
                            className={chip}
                            disabled={pending}
                            onClick={() => run(() => actions.plan(task.id, d.date))}
                          >
                            {d.label}
                          </button>
                        ))}
                      <button
                        type="button"
                        className={`${chip} inline-flex items-center gap-1`}
                        onClick={() => setPlanning(planning?.id === task.id ? null : { id: task.id, value: task.plannedFor ?? "" })}
                        aria-expanded={planning?.id === task.id}
                      >
                        <BsCalendar3 className="h-3 w-3" aria-hidden />
                        Otro día
                      </button>
                      {task.plannedFor ? (
                        <button
                          type="button"
                          className={chip}
                          disabled={pending}
                          onClick={() => run(() => actions.plan(task.id, null))}
                        >
                          A la bandeja
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={`${chip} hover:border-neutral-600`}
                        disabled={pending}
                        onClick={() => run(() => actions.finish(task.id, "dropped"))}
                        title="No lo vas a hacer: también lo saca de la cabeza"
                      >
                        Descartar
                      </button>
                    </div>

                    {planning?.id === task.id ? (
                      <div className="flex flex-wrap items-center gap-2 pl-8">
                        <div className="min-w-0 flex-1 sm:max-w-sm">
                          <DateField
                            label="del plan"
                            allowTime
                            value={planning.value}
                            onChange={(v) => setPlanning({ ...planning, value: v })}
                          />
                        </div>
                        <button
                          type="button"
                          className={`${chip} border-green-800 text-green-300`}
                          disabled={pending || !planning.value || taskProblems({ title: "x", plannedFor: planning.value }).length > 0}
                          onClick={() => run(() => actions.plan(task.id, planning.value), () => setPlanning(null))}
                        >
                          Planificar
                        </button>
                        <button type="button" className={iconButton} aria-label="Cerrar" onClick={() => setPlanning(null)}>
                          <BsX className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    ) : null}
                  </li>
                ),
              )}
            </ul>
          </section>
        ))
      )}

      {/* ------------------------------- cerrados ------------------------------- */}
      {closed.length > 0 ? (
        <section className="flex flex-col gap-2">
          <button
            type="button"
            className="self-start text-xs text-neutral-500 hover:text-neutral-200"
            aria-expanded={showClosed}
            onClick={() => setShowClosed(!showClosed)}
          >
            {showClosed ? "Ocultar" : "Ver"} lo cerrado en los últimos 30 días ({closed.length})
          </button>
          {showClosed ? (
            <ul className="flex flex-col divide-y divide-neutral-900 overflow-hidden rounded-lg border border-neutral-900">
              {closed.map((task) => (
                <li key={task.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span
                    className={`text-[10px] font-mono uppercase tracking-[0.1em] ${
                      task.status === "done" ? "text-green-400" : "text-neutral-600"
                    }`}
                  >
                    {task.status === "done" ? "Hecho" : "Descartado"}
                  </span>
                  <span className={`min-w-0 flex-1 truncate text-sm ${task.status === "done" ? "text-neutral-400 line-through" : "text-neutral-500"}`}>
                    {task.title}
                  </span>
                  <button
                    type="button"
                    className={iconButton}
                    aria-label={`Reabrir «${task.title}»`}
                    title="Reabrir"
                    disabled={pending}
                    onClick={() => run(() => actions.reopen(task.id))}
                  >
                    <BsArrowCounterclockwise className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <Toast result={result} onDismiss={() => setResult(null)} />
    </div>
  );
}
