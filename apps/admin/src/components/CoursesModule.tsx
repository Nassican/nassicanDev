"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BsAward, BsBoxArrowUpRight, BsPencil, BsPlus, BsTrash } from "react-icons/bs";
import type { CourseStatus } from "@nassican/db";
import DateField from "@/components/DateField";
import QuickField, { FinishPrompt } from "@/components/QuickField";
import Toast from "@/components/Toast";
import Unsaved from "@/components/Unsaved";
import type { ActionResult, QuickCourseField } from "@/app/(panel)/aprendizaje/actions";
import {
  certificateProblems,
  courseProblems,
  emptyCourse,
  statuses,
  yearOf,
  type CertificateFromCourse,
  type CourseDraft,
} from "@/lib/course-draft";
import type { CourseRow, CoursesSummary } from "@/lib/courses";
import { formatPartialDate } from "@/lib/draft-fields";
import { fold } from "@/lib/list-filters";
import { quickText } from "@/lib/quick-edit";
import { isDirty, useUnsavedChanges } from "@/lib/use-unsaved";

const field =
  "w-full rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none";
const labelClass = "font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500";
const small =
  "inline-flex items-center gap-1 rounded border border-neutral-800 px-2 py-1 text-xs text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-100 disabled:opacity-40";
const primary =
  "rounded border border-neutral-600 bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-950 transition-colors hover:bg-white disabled:opacity-40";

const money = (n: number) => n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

type Actions = {
  save: (draft: CourseDraft) => Promise<ActionResult>;
  remove: (id: string, title: string) => Promise<ActionResult>;
  setStatus: (id: string, status: CourseStatus) => Promise<ActionResult>;
  quick: (id: string, field: QuickCourseField, raw: string) => Promise<ActionResult>;
  publish: (courseId: string, provider: string, draft: CertificateFromCourse) => Promise<ActionResult>;
};

function toDraft(c: CourseRow): CourseDraft {
  return {
    id: c.id,
    title: c.title,
    provider: c.provider ?? "",
    url: c.url ?? "",
    status: c.status,
    progress: String(c.progress),
    hours: quickText(c.hours),
    hoursSpent: quickText(c.hoursSpent),
    price: quickText(c.price),
    startedAt: c.startedAt ?? "",
    targetDate: c.targetDate ?? "",
    finishedAt: c.finishedAt ?? "",
    note: c.note ?? "",
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

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-neutral-900 p-4">
      <span className={labelClass}>{label}</span>
      <span className="font-mono text-xl tabular-nums text-neutral-100">{value}</span>
      {hint ? <span className="text-[11px] text-neutral-500">{hint}</span> : null}
    </div>
  );
}

/**
 * Courses being taken or meant to be, as a third library beside games and books.
 *
 * The figure it exists for is the same: what was signed up for and never
 * opened. And it has one thing the others do not — a finished course can go to
 * the public site as a certificate, in both languages, from its own row.
 */
export default function CoursesModule({
  summary,
  categories,
  actions,
}: {
  summary: CoursesSummary;
  categories: { es: string; en: string }[];
  actions: Actions;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<CourseDraft | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [onlyStatus, setOnlyStatus] = useState<CourseStatus | "">("");
  const [quickMode, setQuickMode] = useState(false);
  const [askFinish, setAskFinish] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);

  const baseline = draft?.id ? summary.courses.find((c) => c.id === draft.id) : null;
  const dirty = draft !== null && isDirty(baseline ? toDraft(baseline) : emptyCourse(), draft);
  useUnsavedChanges(dirty);
  const problems = draft ? courseProblems(draft) : [];

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

  const needle = fold(query);
  const shown = summary.courses.filter(
    (c) =>
      (!onlyStatus || c.status === onlyStatus) &&
      (!needle || fold(`${c.title} ${c.provider ?? ""} ${c.note ?? ""}`).includes(needle)),
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Aprendizaje</h1>
          <p className="mt-1 max-w-prose text-sm text-neutral-500">
            Los cursos que haces o quieres hacer. Uno terminado pasa a Certificados —y al sitio— desde su fila.
          </p>
        </div>
        <button type="button" className={`${small} border-neutral-700 text-neutral-200`} onClick={() => setDraft(emptyCourse())}>
          <BsPlus className="h-4 w-4" aria-hidden />
          Añadir curso
        </button>
      </header>

      <section className="grid gap-3 sm:grid-cols-4" aria-label="Resumen">
        <Figure label="En curso" value={String(summary.counts.in_progress)} />
        <Figure
          label="Sin empezar"
          value={String(summary.counts.backlog)}
          hint={summary.backlogSpend > 0 ? `${money(summary.backlogSpend)} pagados` : undefined}
        />
        <Figure label="Horas por delante" value={`${summary.hoursAhead} h`} hint="según duración y progreso" />
        <Figure label={`Terminados en ${summary.today.slice(0, 4)}`} value={String(summary.finishedThisYear)} />
      </section>

      {/* ------------------------------- el editor ------------------------------ */}
      {draft ? (
        <section className="flex flex-col gap-4 rounded-lg border border-neutral-800 p-5" aria-label="Editar curso">
          <header className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">{draft.id ? "Editar curso" : "Nuevo curso"}</h2>
            {dirty ? <Unsaved /> : null}
          </header>
          <div className="grid gap-3 sm:grid-cols-6">
            <Labelled label="Título" className="sm:col-span-3">
              <input className={field} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </Labelled>
            <Labelled label="Plataforma" className="sm:col-span-1">
              <input
                className={field}
                list="course-providers"
                value={draft.provider}
                placeholder="Platzi"
                onChange={(e) => setDraft({ ...draft, provider: e.target.value })}
              />
              <datalist id="course-providers">
                {summary.providers.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </Labelled>
            <Labelled label="Estado" className="sm:col-span-2">
              <select
                className={field}
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value as CourseStatus })}
              >
                {statuses.map((s) => (
                  <option key={s.value} value={s.value} title={s.hint}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Labelled>
            <Labelled label="Enlace al curso" className="sm:col-span-3">
              <input className={field} value={draft.url} placeholder="https://" onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
            </Labelled>
            <Labelled label="Progreso %">
              <input className={field} inputMode="numeric" value={draft.progress} onChange={(e) => setDraft({ ...draft, progress: e.target.value })} />
            </Labelled>
            <Labelled label="Duración (h)">
              <input className={field} inputMode="decimal" value={draft.hours} onChange={(e) => setDraft({ ...draft, hours: e.target.value })} />
            </Labelled>
            <Labelled label="Precio">
              <input className={field} inputMode="decimal" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
            </Labelled>
            <Labelled label="Inicio" className="sm:col-span-2">
              <DateField label="de inicio" value={draft.startedAt} onChange={(v) => setDraft({ ...draft, startedAt: v })} />
            </Labelled>
            <Labelled label="Fecha objetivo" className="sm:col-span-2">
              <DateField label="objetivo" value={draft.targetDate} onChange={(v) => setDraft({ ...draft, targetDate: v })} />
            </Labelled>
            <Labelled label="Fin" className="sm:col-span-2">
              <DateField label="de fin" value={draft.finishedAt} onChange={(v) => setDraft({ ...draft, finishedAt: v })} />
            </Labelled>
            <Labelled label="Horas dedicadas" className="sm:col-span-2">
              <input className={field} inputMode="decimal" value={draft.hoursSpent} onChange={(e) => setDraft({ ...draft, hoursSpent: e.target.value })} />
            </Labelled>
            <Labelled label="Nota" className="sm:col-span-4">
              <input className={field} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
            </Labelled>
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

      {/* ------------------------------- la lista ------------------------------- */}
      {summary.courses.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            className={`${field} min-w-0 flex-1 sm:max-w-64`}
            placeholder="Buscar curso o plataforma"
            aria-label="Buscar cursos"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className={`${field} w-auto`}
            value={onlyStatus}
            aria-label="Estado"
            onChange={(e) => setOnlyStatus(e.target.value as CourseStatus | "")}
          >
            <option value="">Todos los estados</option>
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label} ({summary.counts[s.value]})
              </option>
            ))}
          </select>
          <button
            type="button"
            aria-pressed={quickMode}
            onClick={() => setQuickMode((v) => !v)}
            title="Progreso, horas y fechas editables en cada fila; Tab pasa al siguiente y cada campo se guarda al salir"
            className={`rounded border px-2.5 py-1.5 text-[11px] transition-colors ${
              quickMode
                ? "border-neutral-500 bg-neutral-800 text-neutral-100"
                : "border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300"
            }`}
          >
            Edición rápida
          </button>
        </div>
      ) : null}

      {summary.courses.length === 0 ? (
        <p className="rounded border border-dashed border-neutral-800 px-6 py-12 text-center text-sm text-neutral-500">
          Ningún curso todavía. Añade el que estás haciendo: el progreso y la fecha objetivo son lo que lo mantiene a la vista.
        </p>
      ) : shown.length === 0 ? (
        <p className="rounded border border-dashed border-neutral-800 px-6 py-12 text-center text-sm text-neutral-500">
          Ningún curso coincide con el filtro.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-900 rounded-lg border border-neutral-900">
          {shown.map((course) => (
            <li key={course.id} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm text-neutral-200">{course.title}</span>
                    {course.url ? (
                      <a
                        href={course.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Abrir ${course.title}`}
                        className="shrink-0 text-neutral-500 hover:text-neutral-200"
                      >
                        <BsBoxArrowUpRight className="h-3 w-3" aria-hidden />
                      </a>
                    ) : null}
                    {course.certificateId ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-green-900 px-2 py-0.5 text-[10px] text-green-400">
                        <BsAward className="h-3 w-3" aria-hidden />
                        En el sitio
                      </span>
                    ) : null}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-2 text-[11px] text-neutral-500">
                    {course.provider ? <span>{course.provider}</span> : null}
                    {course.status === "in_progress" ? (
                      <span className="inline-flex items-center gap-1.5" title={`${course.progress}% completado`}>
                        <span className="h-1 w-16 overflow-hidden rounded-full bg-neutral-800" aria-hidden>
                          <span className="block h-full rounded-full bg-neutral-300" style={{ width: `${course.progress}%` }} />
                        </span>
                        <span className="tabular-nums">{course.progress}%</span>
                      </span>
                    ) : null}
                    {course.hours !== null ? <span>{course.hours} h</span> : null}
                    {course.targetDate && course.status !== "finished" ? (
                      <span className={course.late ? "text-amber-500" : ""}>
                        {course.late ? "era para" : "para"} {formatPartialDate(course.targetDate)}
                      </span>
                    ) : null}
                    {course.finishedAt ? <span>terminado {formatPartialDate(course.finishedAt)}</span> : null}
                    {course.price !== null ? <span>{money(course.price)}</span> : null}
                  </span>
                </span>

                <select
                  className={`${field} w-auto shrink-0`}
                  value={course.status}
                  disabled={pending}
                  aria-label={`Estado de ${course.title}`}
                  onChange={(e) => {
                    const status = e.target.value as CourseStatus;
                    run(
                      () => actions.setStatus(course.id, status),
                      () => setAskFinish(status === "finished" && !course.finishedAt ? course.id : null),
                    );
                  }}
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
                    aria-label={`Editar ${course.title}`}
                    onClick={() => setDraft(toDraft(course))}
                    className="rounded p-1.5 text-neutral-500 transition-colors hover:text-neutral-200"
                  >
                    <BsPencil className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label={`Eliminar ${course.title}`}
                    disabled={pending}
                    onClick={() => {
                      if (!confirm(`¿Mover «${course.title}» a la papelera? Se puede restaurar durante 30 días.`)) return;
                      run(() => actions.remove(course.id, course.title));
                    }}
                    className="rounded p-1.5 text-neutral-600 transition-colors hover:text-red-400"
                  >
                    <BsTrash className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </span>
              </div>

              {askFinish === course.id && !course.finishedAt ? (
                <FinishPrompt
                  pending={pending}
                  onToday={() => run(() => actions.quick(course.id, "finishedAt", "today"), () => setAskFinish(null))}
                  onOtherDay={() => {
                    setAskFinish(null);
                    setQuickMode(true);
                  }}
                  onDismiss={() => setAskFinish(null)}
                />
              ) : null}

              {quickMode ? (
                <div className="flex flex-wrap gap-3">
                  {(
                    [
                      ["progress", "Progreso %", String(course.progress), "w-16", "numeric"],
                      ["hoursSpent", "Horas dedicadas", quickText(course.hoursSpent), "w-20", "decimal"],
                      ["targetDate", "Objetivo", course.targetDate ?? "", "w-28", "text"],
                      ["finishedAt", "Fin", course.finishedAt ?? "", "w-28", "text"],
                    ] as const
                  ).map(([key, title, value, width, inputMode]) => (
                    <QuickField
                      key={`${key}:${value}`}
                      label={title}
                      value={value}
                      width={width}
                      inputMode={inputMode}
                      placeholder={inputMode === "text" ? "2026-11" : "—"}
                      onSave={async (raw) => {
                        const outcome = await actions.quick(course.id, key, raw);
                        if (outcome.ok) router.refresh();
                        else setResult(outcome);
                        return outcome;
                      }}
                    />
                  ))}
                </div>
              ) : null}

              {course.status === "finished" && !course.certificateId ? (
                publishing === course.id ? (
                  <PublishForm
                    course={course}
                    categories={categories}
                    pending={pending}
                    today={summary.today}
                    onCancel={() => setPublishing(null)}
                    onPublish={(provider, certificate) =>
                      run(() => actions.publish(course.id, provider, certificate), () => setPublishing(null))
                    }
                  />
                ) : (
                  <button type="button" className={`${small} w-fit`} onClick={() => setPublishing(course.id)}>
                    <BsAward className="h-3.5 w-3.5" aria-hidden />
                    Publicar en Certificados
                  </button>
                )
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Toast result={result} onDismiss={() => setResult(null)} />
    </div>
  );
}

/**
 * The certificate a finished course becomes. The Spanish title starts as the
 * course's own; the English one is typed, never guessed — the site is bilingual
 * and this is visible text. A category already in use fills both languages at
 * once, so the filters on /certificates do not grow a near-duplicate.
 */
function PublishForm({
  course,
  categories,
  pending,
  today,
  onCancel,
  onPublish,
}: {
  course: CourseRow;
  categories: { es: string; en: string }[];
  pending: boolean;
  today: string;
  onCancel: () => void;
  onPublish: (provider: string, draft: CertificateFromCourse) => void;
}) {
  const [provider, setProvider] = useState(course.provider ?? "");
  const [draft, setDraft] = useState<CertificateFromCourse>({
    url: course.url ?? "",
    dateLabel: yearOf(course.finishedAt) || today.slice(0, 4),
    title: { es: course.title, en: "" },
    category: { es: "", en: "" },
  });
  const problems = certificateProblems(draft, ["es", "en"]);
  if (!provider.trim()) problems.unshift("Falta el proveedor.");

  return (
    <form
      className="flex flex-col gap-3 rounded border border-neutral-800 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        onPublish(provider, draft);
      }}
    >
      <p className="text-xs text-neutral-400">
        Así aparecerá en /certificates, en los dos idiomas. El diploma (imagen) se sube después desde Perfil.
      </p>
      <div className="grid gap-2 sm:grid-cols-4">
        <Labelled label="Proveedor">
          <input className={field} value={provider} onChange={(e) => setProvider(e.target.value)} />
        </Labelled>
        <Labelled label="Año">
          <input className={field} value={draft.dateLabel} onChange={(e) => setDraft({ ...draft, dateLabel: e.target.value })} />
        </Labelled>
        <Labelled label="Enlace del diploma" className="sm:col-span-2">
          <input className={field} value={draft.url} placeholder="https://" onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
        </Labelled>
        <Labelled label="Título (español)" className="sm:col-span-2">
          <input className={field} value={draft.title.es} onChange={(e) => setDraft({ ...draft, title: { ...draft.title, es: e.target.value } })} />
        </Labelled>
        <Labelled label="Título (inglés)" className="sm:col-span-2">
          <input className={field} value={draft.title.en} onChange={(e) => setDraft({ ...draft, title: { ...draft.title, en: e.target.value } })} />
        </Labelled>
        <Labelled label="Categoría existente" className="sm:col-span-2">
          <select
            className={field}
            value=""
            onChange={(e) => {
              const pair = categories.find((c) => c.es === e.target.value);
              if (pair) setDraft({ ...draft, category: { es: pair.es, en: pair.en } });
            }}
          >
            <option value="">Elegir…</option>
            {categories.map((c) => (
              <option key={c.es} value={c.es}>
                {c.es} · {c.en}
              </option>
            ))}
          </select>
        </Labelled>
        <Labelled label="Categoría (español)">
          <input className={field} value={draft.category.es} onChange={(e) => setDraft({ ...draft, category: { ...draft.category, es: e.target.value } })} />
        </Labelled>
        <Labelled label="Categoría (inglés)">
          <input className={field} value={draft.category.en} onChange={(e) => setDraft({ ...draft, category: { ...draft.category, en: e.target.value } })} />
        </Labelled>
      </div>
      {problems.length > 0 ? (
        <ul className="flex flex-col gap-0.5 text-[11px] text-amber-500">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : null}
      <div className="flex gap-2">
        <button type="submit" className={primary} disabled={pending || problems.length > 0}>
          Publicar
        </button>
        <button type="button" className={small} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
