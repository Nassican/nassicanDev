"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BsArrowRight, BsCheck2 } from "react-icons/bs";
import Toast from "@/components/Toast";
import { formatPartialDate } from "@/lib/draft-fields";
import { relativeDay } from "@/lib/task-draft";
import type { TodayView } from "@/lib/today";

type Result = { ok: boolean; message: string };

const labelClass = "font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500";

/**
 * The top of the dashboard: today, and only today.
 *
 * Everything here can be ticked in place — a task done, a habit, a weekly
 * priority — because the point of the panel is to start the day from one
 * screen. Opening three modules to tick three boxes is how the boxes stay
 * unticked.
 */
export default function TodayPanel({
  view,
  actions,
}: {
  view: TodayView;
  actions: {
    finishTask: (id: string, outcome: "done" | "dropped") => Promise<Result>;
    toggleHabit: (id: string, date: string) => Promise<Result>;
    togglePriority: (id: string, done: boolean) => Promise<Result>;
  };
}) {
  const router = useRouter();
  const [result, setResult] = useState<Result | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<Result>) {
    setResult(null);
    startTransition(async () => {
      const outcome = await action();
      setResult(outcome);
      if (outcome.ok) router.refresh();
    });
  }

  const habitsLeft = view.habits.filter((h) => !h.done).length;
  const empty =
    view.tasks.length === 0 &&
    view.habits.length === 0 &&
    view.priorities.length === 0 &&
    view.renewals.length === 0 &&
    view.goals.length === 0 &&
    !view.review;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-neutral-800 p-5" aria-labelledby="hoy">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="hoy" className="text-sm font-semibold">
          Hoy <span className="font-normal text-neutral-500">· {view.label}</span>
        </h2>
        {view.habits.length > 0 ? (
          <span className="text-xs text-neutral-500">
            {habitsLeft === 0 ? "Hábitos de hoy, hechos" : `${habitsLeft} ${habitsLeft === 1 ? "hábito" : "hábitos"} por marcar`}
          </span>
        ) : null}
      </header>

      {empty ? (
        <p className="text-sm text-neutral-500">
          Nada pendiente para hoy.{" "}
          <Link href="/pendientes" className="text-neutral-300 underline-offset-2 hover:underline">
            Apunta algo
          </Link>{" "}
          o marca un hábito en{" "}
          <Link href="/metas" className="text-neutral-300 underline-offset-2 hover:underline">
            Metas y hábitos
          </Link>
          .
        </p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {/* -------------------------- la columna de hacer -------------------------- */}
          <div className="flex flex-col gap-4">
            {view.habits.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <span className={labelClass}>Hábitos</span>
                <div className="flex flex-wrap gap-1.5">
                  {view.habits.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      disabled={pending}
                      aria-pressed={h.done}
                      onClick={() => run(() => actions.toggleHabit(h.id, view.today))}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                        h.done
                          ? "border-green-800 bg-green-950/60 text-green-300"
                          : "border-neutral-700 text-neutral-200 hover:border-neutral-500"
                      }`}
                    >
                      {h.done ? <BsCheck2 className="h-3 w-3" aria-hidden /> : null}
                      {h.title}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {view.tasks.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <span className={labelClass}>Pendientes</span>
                <ul className="flex flex-col gap-1">
                  {view.tasks.map((t) => (
                    <li key={t.id} className="flex items-start gap-2 text-sm">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => actions.finishTask(t.id, "done"))}
                        aria-label={`Marcar «${t.title}» como hecho`}
                        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-neutral-600 text-transparent transition-colors hover:border-green-500 hover:text-green-400"
                      >
                        <BsCheck2 className="h-2.5 w-2.5" aria-hidden />
                      </button>
                      <span className="min-w-0 flex-1 text-neutral-200">{t.title}</span>
                      <span className={`shrink-0 text-[11px] ${t.late ? "text-amber-500" : "text-neutral-500"}`}>
                        {relativeDay(t.plannedFor, view.today)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {view.priorities.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <span className={labelClass}>Prioridades de la semana</span>
                <ul className="flex flex-col gap-1">
                  {view.priorities.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={p.done}
                        disabled={pending}
                        onClick={() => run(() => actions.togglePriority(p.id, !p.done))}
                        className="flex items-start gap-2 text-left text-sm"
                      >
                        <span
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                            p.done ? "border-green-700 bg-green-950 text-green-400" : "border-neutral-600"
                          }`}
                          aria-hidden
                        >
                          {p.done ? "✓" : ""}
                        </span>
                        <span className={p.done ? "text-neutral-500 line-through" : "text-neutral-200"}>{p.text}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {/* ------------------------- la columna de saber ------------------------- */}
          <div className="flex flex-col gap-4">
            {view.review ? (
              <Link
                href={`/bitacora?semana=${view.review.week}`}
                className="group flex items-center justify-between gap-2 rounded border border-neutral-800 px-3 py-2 text-xs text-neutral-300 hover:border-neutral-600"
              >
                <span>Falta la revisión de la semana pasada ({view.review.label})</span>
                <BsArrowRight className="h-3 w-3 shrink-0" aria-hidden />
              </Link>
            ) : null}

            {view.renewals.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <span className={labelClass}>Renovaciones</span>
                <ul className="flex flex-col gap-1 text-sm">
                  {view.renewals.map((r) => (
                    <li key={r.name} className="flex justify-between gap-3">
                      <Link href="/suscripciones" className="text-neutral-200 hover:underline">
                        {r.name}
                      </Link>
                      <span className={`text-[11px] ${r.overdue ? "text-red-400" : "text-amber-500"}`}>
                        {r.overdue
                          ? `vencida · ${formatPartialDate(r.nextRenewal)}`
                          : r.days === null
                            ? "este mes"
                            : r.days === 0
                              ? "hoy"
                              : r.days === 1
                                ? "mañana"
                                : `en ${r.days} días`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {view.goals.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <span className={labelClass}>Metas que vencen</span>
                <ul className="flex flex-col gap-1 text-sm">
                  {view.goals.map((g) => (
                    <li key={g.title} className="flex justify-between gap-3">
                      <Link href="/metas" className="text-neutral-200 hover:underline">
                        {g.title}
                      </Link>
                      <span className={`text-[11px] ${g.overdue ? "text-red-400" : "text-amber-500"}`}>
                        {g.overdue ? "pasó la fecha" : g.days === null ? "este mes" : g.days === 0 ? "hoy" : `en ${g.days} días`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {view.yesterday.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <span className={labelClass}>Ayer</span>
                <ul className="flex flex-col gap-0.5 text-xs text-neutral-400">
                  {view.yesterday.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <Toast result={result} onDismiss={() => setResult(null)} />
    </section>
  );
}
