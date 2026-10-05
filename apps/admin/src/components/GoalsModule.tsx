"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BsArchive, BsArrowCounterclockwise, BsCheck2, BsDash, BsPencil, BsPlus, BsTrash } from "react-icons/bs";
import type { GoalSource, GoalStatus } from "@nassican/db";
import DateField from "@/components/DateField";
import Toast from "@/components/Toast";
import Unsaved from "@/components/Unsaved";
import { formatPartialDate } from "@/lib/draft-fields";
import {
  emptyGoal,
  goalProblems,
  progressRatio,
  sourceLabel,
  sources,
  statusLabels,
  type GoalDraft,
} from "@/lib/goal-draft";
import type { GoalRow, GoalsSummary, HabitRow } from "@/lib/goals";
import {
  FORMATION_DAYS,
  WEEKDAYS,
  dayPresets,
  describeDays,
  emptyHabit,
  formation,
  habitProblems,
  isDue,
  lastDays,
  streak,
  weekdayIndex,
  type HabitDraft,
} from "@/lib/habit-draft";
import { renewalState } from "@/lib/subscription-draft";
import { isDirty, useUnsavedChanges } from "@/lib/use-unsaved";
import type { ActionResult } from "@/app/(panel)/metas/actions";

const field =
  "rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none";
const labelClass = "font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500";
const small =
  "inline-flex items-center gap-1 rounded border border-neutral-800 px-2 py-1 text-xs text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-100 disabled:opacity-40";
const iconButton = "rounded p-1.5 text-neutral-500 transition-colors hover:text-neutral-200";
const primary =
  "rounded border border-neutral-600 bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-950 transition-colors hover:bg-white disabled:opacity-40";

type Actions = {
  saveGoal: (draft: GoalDraft) => Promise<ActionResult>;
  setStatus: (id: string, status: GoalStatus) => Promise<ActionResult>;
  step: (id: string, delta: 1 | -1) => Promise<ActionResult>;
  removeGoal: (id: string) => Promise<ActionResult>;
  saveHabit: (draft: HabitDraft) => Promise<ActionResult>;
  toggle: (id: string, date: string) => Promise<ActionResult>;
  archive: (id: string, archived: boolean) => Promise<ActionResult>;
  removeHabit: (id: string) => Promise<ActionResult>;
};

/**
 * Goals with a plan, and habits with a cue.
 *
 * Habits come first because they are what is touched daily, and today's are a
 * row of buttons at the very top: a check-in that costs a scroll is a check-in
 * that stops happening.
 */
export default function GoalsModule({ summary, actions }: { summary: GoalsSummary; actions: Actions }) {
  const router = useRouter();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [habitDraft, setHabitDraft] = useState<HabitDraft | null>(null);
  const [goalDraft, setGoalDraft] = useState<GoalDraft | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  const habitBaseline = habitDraft?.id
    ? toHabitDraft(summary.habits.find((h) => h.id === habitDraft.id))
    : emptyHabit();
  const goalBaseline = goalDraft?.id
    ? toGoalDraft(summary.goals.find((g) => g.id === goalDraft.id), summary.today)
    : emptyGoal(summary.today);
  useUnsavedChanges(
    (habitDraft !== null && isDirty(habitBaseline, habitDraft)) ||
      (goalDraft !== null && isDirty(goalBaseline, goalDraft)),
  );

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

  const today = summary.today;
  const active = summary.habits.filter((h) => !h.archived);
  const archived = summary.habits.filter((h) => h.archived);
  const dueToday = active.filter((h) => isDue(h.days, today));
  const openGoals = summary.goals.filter((g) => g.status === "active");
  const closedGoals = summary.goals.filter((g) => g.status !== "active");

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Metas y hábitos</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Cada meta con su plan «si… entonces…», cada hábito con su señal. Es lo
          que tiene más evidencia de que funciona.
        </p>
      </header>

      {/* ------------------------------ hoy ------------------------------ */}
      {dueToday.length > 0 ? (
        <section className="flex flex-col gap-2" aria-label="Hábitos de hoy">
          <h2 className={labelClass}>Hoy</h2>
          <div className="flex flex-wrap gap-2">
            {dueToday.map((h) => {
              const done = h.checks.includes(today);
              return (
                <button
                  key={h.id}
                  type="button"
                  disabled={pending}
                  aria-pressed={done}
                  onClick={() => run(() => actions.toggle(h.id, today))}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
                    done
                      ? "border-green-800 bg-green-950/60 text-green-300"
                      : "border-neutral-700 text-neutral-200 hover:border-neutral-500"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                      done ? "border-green-500 bg-green-500 text-neutral-950" : "border-neutral-500"
                    }`}
                    aria-hidden
                  >
                    {done ? <BsCheck2 className="h-3 w-3" /> : null}
                  </span>
                  {h.title}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* ----------------------------- hábitos ----------------------------- */}
      <section className="flex flex-col gap-3">
        <header className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Hábitos</h2>
          <button type="button" className={small} onClick={() => setHabitDraft(emptyHabit())}>
            <BsPlus className="h-3.5 w-3.5" aria-hidden />
            Nuevo hábito
          </button>
        </header>

        {habitDraft ? (
          <HabitForm
            draft={habitDraft}
            dirty={isDirty(habitBaseline, habitDraft)}
            pending={pending}
            onChange={setHabitDraft}
            onCancel={() => setHabitDraft(null)}
            onSave={() => run(() => actions.saveHabit(habitDraft), () => setHabitDraft(null))}
          />
        ) : null}

        {active.length === 0 && !habitDraft ? (
          <p className="rounded-lg border border-dashed border-neutral-800 px-4 py-8 text-center text-sm text-neutral-500">
            Ningún hábito todavía. Empieza por uno pequeño, atado a algo que ya haces cada día.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-900 overflow-hidden rounded-lg border border-neutral-900">
            {active.map((h) => (
              <HabitLine
                key={h.id}
                habit={h}
                today={today}
                pending={pending}
                onToggle={(date) => run(() => actions.toggle(h.id, date))}
                onEdit={() => setHabitDraft(toHabitDraft(h))}
                onArchive={() => run(() => actions.archive(h.id, true))}
                onRemove={() => {
                  if (!confirm(`¿Mover «${h.title}» a la papelera, con todos sus días marcados?`)) return;
                  run(() => actions.removeHabit(h.id));
                }}
              />
            ))}
          </ul>
        )}

        {archived.length > 0 ? (
          <details className="text-xs text-neutral-500">
            <summary className="cursor-pointer hover:text-neutral-200">Archivados ({archived.length})</summary>
            <ul className="mt-2 flex flex-col gap-1">
              {archived.map((h) => (
                <li key={h.id} className="flex items-center gap-2">
                  <span className="flex-1">
                    {h.title} · {h.total} {h.total === 1 ? "día" : "días"} en total
                  </span>
                  <button type="button" className={small} disabled={pending} onClick={() => run(() => actions.archive(h.id, false))}>
                    Reactivar
                  </button>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      {/* ------------------------------ metas ------------------------------ */}
      <section className="flex flex-col gap-3">
        <header className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Metas</h2>
          <button type="button" className={small} onClick={() => setGoalDraft(emptyGoal(today))}>
            <BsPlus className="h-3.5 w-3.5" aria-hidden />
            Nueva meta
          </button>
        </header>

        {goalDraft ? (
          <GoalForm
            draft={goalDraft}
            dirty={isDirty(goalBaseline, goalDraft)}
            pending={pending}
            onChange={setGoalDraft}
            onCancel={() => setGoalDraft(null)}
            onSave={() => run(() => actions.saveGoal(goalDraft), () => setGoalDraft(null))}
          />
        ) : null}

        {openGoals.length === 0 && !goalDraft ? (
          <p className="rounded-lg border border-dashed border-neutral-800 px-4 py-8 text-center text-sm text-neutral-500">
            Ninguna meta en curso.
          </p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {openGoals.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                today={today}
                pending={pending}
                onStep={(delta) => run(() => actions.step(g.id, delta))}
                onStatus={(status) => run(() => actions.setStatus(g.id, status))}
                onEdit={() => setGoalDraft(toGoalDraft(g, today))}
                onRemove={() => {
                  if (!confirm(`¿Mover «${g.title}» a la papelera?`)) return;
                  run(() => actions.removeGoal(g.id));
                }}
              />
            ))}
          </div>
        )}

        {closedGoals.length > 0 ? (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="self-start text-xs text-neutral-500 hover:text-neutral-200"
              aria-expanded={showClosed}
              onClick={() => setShowClosed(!showClosed)}
            >
              {showClosed ? "Ocultar" : "Ver"} las cerradas ({closedGoals.length})
            </button>
            {showClosed ? (
              <ul className="flex flex-col divide-y divide-neutral-900 overflow-hidden rounded-lg border border-neutral-900">
                {closedGoals.map((g) => (
                  <li key={g.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span
                      className={`font-mono text-[10px] uppercase tracking-[0.1em] ${
                        g.status === "achieved" ? "text-green-400" : "text-neutral-600"
                      }`}
                    >
                      {statusLabels[g.status]}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-neutral-400">{g.title}</span>
                    <button
                      type="button"
                      className={iconButton}
                      aria-label={`Reabrir «${g.title}»`}
                      disabled={pending}
                      onClick={() => run(() => actions.setStatus(g.id, "active"))}
                    >
                      <BsArrowCounterclockwise className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>

      <Toast result={result} onDismiss={() => setResult(null)} />
    </div>
  );
}

function HabitLine({
  habit,
  today,
  pending,
  onToggle,
  onEdit,
  onArchive,
  onRemove,
}: {
  habit: HabitRow;
  today: string;
  pending: boolean;
  onToggle: (date: string) => void;
  onEdit: () => void;
  onArchive: () => void;
  onRemove: () => void;
}) {
  const checked = new Set(habit.checks);
  const run = streak(checked, habit.days, today);
  const progress = formation(habit.total);

  return (
    <li className="flex flex-col gap-3 px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-neutral-100">{habit.title}</p>
          <p className="text-[11px] text-neutral-500">
            Si {habit.cue}, entonces {habit.title.charAt(0).toLowerCase() + habit.title.slice(1)} · {describeDays(habit.days)}
          </p>
        </div>
        <div className="flex shrink-0 items-center">
          <button type="button" className={iconButton} aria-label={`Editar «${habit.title}»`} onClick={onEdit}>
            <BsPencil className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button type="button" className={iconButton} aria-label={`Archivar «${habit.title}»`} title="Archivar: deja de pedirse y conserva su historia" onClick={onArchive}>
            <BsArchive className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button type="button" className={`${iconButton} hover:text-red-400`} aria-label={`Mover «${habit.title}» a la papelera`} onClick={onRemove}>
            <BsTrash className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        {/* The last week, tickable: a day remembered late still counts. */}
        <div className="flex gap-1" role="group" aria-label="Últimos siete días">
          {lastDays(today).map((date) => {
            const due = isDue(habit.days, date);
            const done = checked.has(date);
            const missed = due && !done && date < today;
            return (
              <button
                key={date}
                type="button"
                disabled={pending}
                aria-pressed={done}
                aria-label={`${formatPartialDate(date)}: ${done ? "hecho" : due ? "sin marcar" : "no toca"}`}
                title={formatPartialDate(date)}
                onClick={() => onToggle(date)}
                className={`flex h-9 w-9 flex-col items-center justify-center rounded border text-[10px] transition-colors ${
                  done
                    ? "border-green-800 bg-green-950/60 text-green-300"
                    : missed
                      ? "border-amber-900/70 text-amber-500"
                      : due
                        ? "border-neutral-700 text-neutral-400 hover:border-neutral-500"
                        : "border-neutral-900 text-neutral-700"
                } ${date === today ? "ring-1 ring-neutral-500" : ""}`}
              >
                <span>{WEEKDAYS[weekdayIndex(date)]}</span>
                <span aria-hidden>{done ? "✓" : ""}</span>
              </button>
            );
          })}
        </div>

        <div className="text-xs">
          <p className="text-neutral-200">
            Racha: <span className="font-semibold tabular-nums">{run.days}</span> {run.days === 1 ? "día" : "días"}
          </p>
          {run.atRisk ? (
            <p className="text-amber-500">El último día que tocaba quedó sin marcar: hoy la salvas.</p>
          ) : (
            <p className="text-neutral-600">Un día suelto sin marcar no la rompe.</p>
          )}
        </div>

        <div className="min-w-[10rem] flex-1 text-xs">
          <p className="text-neutral-400">
            <span className="tabular-nums">{progress.days}</span> de {FORMATION_DAYS} días
          </p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-900" aria-hidden>
            <div className="h-full rounded-full bg-neutral-400" style={{ width: `${progress.ratio * 100}%` }} />
          </div>
          <p className="mt-1 text-[10px] text-neutral-600">66 es la media hasta que sale solo; va de 18 a 254.</p>
        </div>
      </div>
    </li>
  );
}

function GoalCard({
  goal,
  today,
  pending,
  onStep,
  onStatus,
  onEdit,
  onRemove,
}: {
  goal: GoalRow;
  today: string;
  pending: boolean;
  onStep: (delta: 1 | -1) => void;
  onStatus: (status: GoalStatus) => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const ratio = progressRatio(goal.count, goal.target);
  const deadline = renewalState(goal.deadline, today, 14);
  const unit = goal.unit ?? (goal.source ? sources.find((s) => s.value === goal.source)?.unit : null) ?? "";

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-neutral-900 p-4">
      <header className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 text-sm font-semibold text-neutral-100">{goal.title}</h3>
        <button type="button" className={iconButton} aria-label={`Editar «${goal.title}»`} onClick={onEdit}>
          <BsPencil className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button type="button" className={`${iconButton} hover:text-red-400`} aria-label={`Mover «${goal.title}» a la papelera`} onClick={onRemove}>
          <BsTrash className="h-3.5 w-3.5" aria-hidden />
        </button>
      </header>

      <p className="rounded border border-neutral-900 bg-neutral-900/40 px-3 py-2 text-xs text-neutral-300">
        <span className="text-neutral-500">Si</span> {goal.planIf}, <span className="text-neutral-500">entonces</span> {goal.planThen}.
      </p>
      {goal.why ? <p className="text-[11px] text-neutral-500">Por qué: {goal.why}</p> : null}

      {goal.target !== null || goal.source ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="text-neutral-200">
              <span className="text-base font-semibold tabular-nums">{goal.count}</span>
              {goal.target !== null ? ` de ${goal.target}` : ""} {unit}
            </span>
            {ratio !== null ? <span className="tabular-nums text-neutral-500">{Math.round(ratio * 100)} %</span> : null}
          </div>
          {ratio !== null ? (
            <div className="h-1.5 overflow-hidden rounded-full bg-neutral-900" aria-hidden>
              <div
                className={`h-full rounded-full ${ratio >= 1 ? "bg-green-500" : "bg-neutral-400"}`}
                style={{ width: `${ratio * 100}%` }}
              />
            </div>
          ) : null}
          {goal.source ? (
            <p className="text-[10px] text-neutral-600">
              Se cuenta solo: {sourceLabel(goal.source).toLowerCase()} desde {formatPartialDate(goal.since)}.
            </p>
          ) : null}
        </div>
      ) : null}

      <footer className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={`text-xs ${
            deadline.kind === "overdue" ? "text-red-400" : deadline.kind === "soon" ? "text-amber-500" : "text-neutral-500"
          }`}
        >
          {deadline.kind === "unknown"
            ? "Sin fecha límite"
            : deadline.kind === "overdue"
              ? `Pasó la fecha: ${formatPartialDate(goal.deadline)}`
              : deadline.days !== null
                ? `${deadline.days === 0 ? "Vence hoy" : `Quedan ${deadline.days} ${deadline.days === 1 ? "día" : "días"}`} · ${formatPartialDate(goal.deadline)}`
                : `Para ${formatPartialDate(goal.deadline)}`}
        </span>
        <div className="flex gap-1.5">
          {!goal.source ? (
            <>
              <button type="button" className={small} disabled={pending || goal.count === 0} aria-label="Restar uno" onClick={() => onStep(-1)}>
                <BsDash className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button type="button" className={small} disabled={pending} aria-label="Sumar uno" onClick={() => onStep(1)}>
                <BsPlus className="h-3.5 w-3.5" aria-hidden />
              </button>
            </>
          ) : null}
          <button type="button" className={`${small} border-green-800 text-green-300`} disabled={pending} onClick={() => onStatus("achieved")}>
            Lograda
          </button>
          <button type="button" className={small} disabled={pending} onClick={() => onStatus("dropped")}>
            Abandonar
          </button>
        </div>
      </footer>
    </article>
  );
}

function HabitForm({
  draft,
  dirty,
  pending,
  onChange,
  onCancel,
  onSave,
}: {
  draft: HabitDraft;
  dirty: boolean;
  pending: boolean;
  onChange: (draft: HabitDraft) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const problems = habitProblems(draft);
  const toggleDay = (d: string) =>
    onChange({
      ...draft,
      days: [...(draft.days.includes(d) ? draft.days.replace(d, "") : draft.days + d)].sort().join(""),
    });

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-neutral-800 bg-neutral-950 p-4">
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{draft.id ? "Editar hábito" : "Nuevo hábito"}</h3>
        {dirty ? <Unsaved /> : null}
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Si… (la señal)</span>
          <input className={field} value={draft.cue} autoFocus placeholder="después de almorzar" onChange={(e) => onChange({ ...draft, cue: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>…entonces (el hábito)</span>
          <input className={field} value={draft.title} placeholder="Leer 10 páginas" onChange={(e) => onChange({ ...draft, title: e.target.value })} />
        </label>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>Qué días</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {WEEKDAYS.map((label, i) => {
            const d = String(i + 1);
            const on = draft.days.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => toggleDay(d)}
                className={`h-8 w-8 rounded text-xs transition-colors ${on ? "bg-neutral-200 font-semibold text-neutral-950" : "border border-neutral-800 text-neutral-500 hover:border-neutral-600"}`}
              >
                {label}
              </button>
            );
          })}
          {dayPresets.map((p) => (
            <button key={p.value} type="button" className={small} onClick={() => onChange({ ...draft, days: p.value })}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {problems.length > 0 ? <p className="text-xs text-amber-500">{problems.join(" ")}</p> : null}
      <div className="flex gap-2">
        <button type="button" className={primary} disabled={pending || problems.length > 0} onClick={onSave}>
          Guardar
        </button>
        <button type="button" className={small} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </section>
  );
}

function GoalForm({
  draft,
  dirty,
  pending,
  onChange,
  onCancel,
  onSave,
}: {
  draft: GoalDraft;
  dirty: boolean;
  pending: boolean;
  onChange: (draft: GoalDraft) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const problems = goalProblems(draft);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-neutral-800 bg-neutral-950 p-4">
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{draft.id ? "Editar meta" : "Nueva meta"}</h3>
        {dirty ? <Unsaved /> : null}
      </header>

      <label className="flex flex-col gap-1">
        <span className={labelClass}>La meta</span>
        <input className={field} value={draft.title} autoFocus placeholder="Leer 12 libros este año" onChange={(e) => onChange({ ...draft, title: e.target.value })} />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Si… (situación concreta)</span>
          <input className={field} value={draft.planIf} placeholder="es domingo después de cenar" onChange={(e) => onChange({ ...draft, planIf: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>…entonces (acción concreta)</span>
          <input className={field} value={draft.planThen} placeholder="leo una hora sin el móvil" onChange={(e) => onChange({ ...draft, planThen: e.target.value })} />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className={labelClass}>Por qué (opcional)</span>
        <input className={field} value={draft.why} placeholder="Qué cambia si lo consigues" onChange={(e) => onChange({ ...draft, why: e.target.value })} />
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Fecha límite</span>
          <DateField label="límite" value={draft.deadline} onChange={(v) => onChange({ ...draft, deadline: v })} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Cifra objetivo</span>
          <input className={field} value={draft.target} inputMode="numeric" placeholder="12" onChange={(e) => onChange({ ...draft, target: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Unidad</span>
          <input className={field} value={draft.unit} placeholder="libros, km, artículos…" onChange={(e) => onChange({ ...draft, unit: e.target.value })} />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Cómo se cuenta</span>
          <select className={field} value={draft.source} onChange={(e) => onChange({ ...draft, source: e.target.value as GoalSource | "" })}>
            <option value="">A mano, con + y −</option>
            {sources.map((s) => (
              <option key={s.value} value={s.value}>
                Solo: {s.label.toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        {draft.source ? (
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Contar desde</span>
            <DateField label="de inicio" value={draft.since} onChange={(v) => onChange({ ...draft, since: v })} />
          </label>
        ) : null}
      </div>

      {problems.length > 0 ? <p className="text-xs text-amber-500">{problems.join(" ")}</p> : null}
      <div className="flex gap-2">
        <button type="button" className={primary} disabled={pending || problems.length > 0} onClick={onSave}>
          Guardar
        </button>
        <button type="button" className={small} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </section>
  );
}

function toHabitDraft(h: HabitRow | undefined): HabitDraft {
  return h ? { id: h.id, title: h.title, cue: h.cue, days: h.days } : emptyHabit();
}

function toGoalDraft(g: GoalRow | undefined, today: string): GoalDraft {
  if (!g) return emptyGoal(today);
  return {
    id: g.id,
    title: g.title,
    why: g.why ?? "",
    planIf: g.planIf,
    planThen: g.planThen,
    deadline: g.deadline ?? "",
    target: g.target === null ? "" : String(g.target),
    unit: g.unit ?? "",
    source: g.source ?? "",
    since: g.since ?? "",
  };
}
