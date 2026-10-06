"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BsBoxArrowUpRight, BsChevronDown, BsPencil, BsPlus, BsTrash, BsX } from "react-icons/bs";
import type { ClientProjectStatus } from "@nassican/db";
import DateField from "@/components/DateField";
import { FinishPrompt } from "@/components/QuickField";
import Toast from "@/components/Toast";
import Unsaved from "@/components/Unsaved";
import type { ActionResult } from "@/app/(panel)/trabajos/actions";
import {
  QUIET_DAYS,
  clientProjectProblems,
  emptyClientProject,
  statuses,
  type ClientProjectDraft,
} from "@/lib/client-project-draft";
import type { ClientProjectRow, ClientProjectsView } from "@/lib/client-projects";
import { formatPartialDate } from "@/lib/draft-fields";
import { fold } from "@/lib/list-filters";
import { isDirty, useUnsavedChanges } from "@/lib/use-unsaved";

const field =
  "w-full rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none";
const labelClass = "font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500";
const small =
  "inline-flex items-center gap-1 rounded border border-neutral-800 px-2 py-1 text-xs text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-100 disabled:opacity-40";
const primary =
  "rounded border border-neutral-600 bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-950 transition-colors hover:bg-white disabled:opacity-40";

type Actions = {
  save: (draft: ClientProjectDraft) => Promise<ActionResult>;
  setStatus: (id: string, status: ClientProjectStatus) => Promise<ActionResult>;
  finishedAt: (id: string, raw: string) => Promise<ActionResult>;
  log: (id: string, entry: { at: string; text: string; hours: string }) => Promise<ActionResult>;
  removeEntry: (entryId: string) => Promise<ActionResult>;
  remove: (id: string, title: string) => Promise<ActionResult>;
};

function toDraft(p: ClientProjectRow): ClientProjectDraft {
  return {
    id: p.id,
    title: p.title,
    company: p.company,
    status: p.status,
    contactName: p.contactName ?? "",
    contact: p.contact ?? "",
    url: p.url ?? "",
    description: p.description ?? "",
    startedAt: p.startedAt ?? "",
    dueDate: p.dueDate ?? "",
    finishedAt: p.finishedAt ?? "",
    amount: p.amount === null ? "" : String(p.amount),
    currency: p.currency ?? "COP",
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

const money = (amount: number, currency: string) =>
  amount.toLocaleString("es-CO", { style: "currency", currency, maximumFractionDigits: 0 });

/** «hace 3 días», or «sin avances» — the one line that says whether it is moving. */
function activityLabel(p: ClientProjectRow): string {
  if (p.status === "finished") return p.finishedAt ? `finalizado ${formatPartialDate(p.finishedAt)}` : "finalizado";
  if (!p.lastActivity) return p.status === "in_progress" ? "sin avances anotados" : "sin empezar";
  const d = p.daysQuiet ?? 0;
  return d === 0 ? "último avance hoy" : d === 1 ? "último avance ayer" : `último avance hace ${d} días`;
}

/**
 * Work for companies: three states and a log of what was done.
 *
 * In progress first, because that is what the page is opened for; finished
 * ones fold away at the end. The single warning is the quiet one — in progress
 * and nothing logged for a week — because work that nobody touches is usually
 * waiting on someone.
 */
export default function ClientProjectsModule({ view, actions }: { view: ClientProjectsView; actions: Actions }) {
  const router = useRouter();
  const [draft, setDraft] = useState<ClientProjectDraft | null>(null);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [showFinished, setShowFinished] = useState(false);
  const [askFinish, setAskFinish] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const baseline = draft?.id ? view.rows.find((r) => r.id === draft.id) : null;
  const dirty = draft !== null && isDirty(baseline ? toDraft(baseline) : emptyClientProject(), draft);
  useUnsavedChanges(dirty);
  const problems = draft ? clientProjectProblems(draft) : [];

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
  const rows = view.rows.filter((r) => !needle || fold(`${r.title} ${r.company} ${r.contactName ?? ""}`).includes(needle));
  const quiet = view.rows.filter((r) => r.quiet).length;

  const renderRow = (p: ClientProjectRow) => {
    const expanded = openRow === p.id;
    return (
      <li key={p.id} className="flex flex-col gap-2 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
          <button
            type="button"
            className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
            aria-expanded={expanded}
            onClick={() => setOpenRow(expanded ? null : p.id)}
          >
            <span className="truncate text-sm text-neutral-100">{p.title}</span>
            <span className="flex flex-wrap gap-x-2 text-[11px] text-neutral-500">
              <span className="text-neutral-400">{p.company}</span>
              <span className={p.quiet ? "text-amber-500" : ""}>{activityLabel(p)}</span>
              {p.hours > 0 ? <span>{p.hours} h</span> : null}
              {p.dueDate && p.status !== "finished" ? (
                <span className={p.late ? "text-red-400" : ""}>
                  {p.late ? "entrega vencida" : "entrega"} {formatPartialDate(p.dueDate)}
                </span>
              ) : null}
              {p.amount !== null && p.currency ? <span>{money(p.amount, p.currency)}</span> : null}
            </span>
          </button>
          <select
            className={`${field} w-auto shrink-0`}
            value={p.status}
            disabled={pending}
            aria-label={`Estado de ${p.title}`}
            onChange={(e) => {
              const status = e.target.value as ClientProjectStatus;
              run(
                () => actions.setStatus(p.id, status),
                () => setAskFinish(status === "finished" && !p.finishedAt ? p.id : null),
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
              aria-label={`Editar ${p.title}`}
              onClick={() => setDraft(toDraft(p))}
              className="rounded p-1.5 text-neutral-500 transition-colors hover:text-neutral-200"
            >
              <BsPencil className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              aria-label={expanded ? `Cerrar ${p.title}` : `Abrir ${p.title}`}
              onClick={() => setOpenRow(expanded ? null : p.id)}
              className="rounded p-1.5 text-neutral-500 transition-colors hover:text-neutral-200"
            >
              <BsChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden />
            </button>
          </span>
        </div>

        {askFinish === p.id && !p.finishedAt ? (
          <FinishPrompt
            pending={pending}
            onToday={() => run(() => actions.finishedAt(p.id, "today"), () => setAskFinish(null))}
            onOtherDay={() => {
              setAskFinish(null);
              setDraft(toDraft(p));
            }}
            onDismiss={() => setAskFinish(null)}
          />
        ) : null}

        {expanded ? (
          <Details
            row={p}
            today={view.today}
            pending={pending}
            onLog={(entry, done) => run(() => actions.log(p.id, entry), done)}
            onRemoveEntry={(id) => run(() => actions.removeEntry(id))}
            onRemove={() => {
              if (!confirm(`¿Mover «${p.title}» a la papelera, con sus avances? Se puede restaurar durante 30 días.`)) return;
              run(() => actions.remove(p.id, p.title), () => setOpenRow(null));
            }}
          />
        ) : null}
      </li>
    );
  };

  const inStatus = (status: ClientProjectStatus) => rows.filter((r) => r.status === status);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Trabajos</h1>
          <p className="mt-1 max-w-prose text-sm text-neutral-500">
            Proyectos en curso con empresas y clientes: en qué estado está cada uno y la bitácora de lo que has avanzado.
          </p>
        </div>
        <button type="button" className={`${small} border-neutral-700 text-neutral-200`} onClick={() => setDraft(emptyClientProject())}>
          <BsPlus className="h-4 w-4" aria-hidden />
          Añadir trabajo
        </button>
      </header>

      {view.rows.length > 0 ? (
        <section className="flex flex-wrap gap-2 text-xs" aria-label="Resumen">
          {statuses.map((s) => (
            <span key={s.value} className="rounded-full border border-neutral-800 px-3 py-1 text-neutral-300">
              <span className="font-semibold tabular-nums">{view.counts[s.value]}</span> {s.label.toLowerCase()}
            </span>
          ))}
          {quiet > 0 ? (
            <span className="rounded-full border border-amber-900 px-3 py-1 text-amber-400">
              <span className="font-semibold tabular-nums">{quiet}</span> en marcha sin avances hace más de {QUIET_DAYS} días
            </span>
          ) : null}
        </section>
      ) : null}

      {draft ? (
        <section className="flex flex-col gap-4 rounded-lg border border-neutral-800 p-5" aria-label="Editar trabajo">
          <header className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">{draft.id ? "Editar trabajo" : "Nuevo trabajo"}</h2>
            {dirty ? <Unsaved /> : null}
          </header>
          <div className="grid gap-3 sm:grid-cols-6">
            <Labelled label="Trabajo" className="sm:col-span-3">
              <input
                className={field}
                value={draft.title}
                placeholder="Tienda en línea · Rediseño del sitio"
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </Labelled>
            <Labelled label="Empresa o cliente" className="sm:col-span-2">
              <input
                className={field}
                list="client-companies"
                value={draft.company}
                onChange={(e) => setDraft({ ...draft, company: e.target.value })}
              />
              <datalist id="client-companies">
                {view.companies.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Labelled>
            <Labelled label="Estado">
              <select className={field} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as ClientProjectStatus })}>
                {statuses.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Labelled>
            <Labelled label="Descripción" className="sm:col-span-6">
              <textarea
                className={`${field} min-h-16`}
                value={draft.description}
                placeholder="Qué incluye, qué se acordó"
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </Labelled>
            <Labelled label="Inicio" className="sm:col-span-2">
              <DateField label="de inicio" value={draft.startedAt} onChange={(v) => setDraft({ ...draft, startedAt: v })} />
            </Labelled>
            <Labelled label="Entrega" className="sm:col-span-2">
              <DateField label="de entrega" value={draft.dueDate} onChange={(v) => setDraft({ ...draft, dueDate: v })} />
            </Labelled>
            <Labelled label="Fin" className="sm:col-span-2">
              <DateField label="de fin" value={draft.finishedAt} onChange={(v) => setDraft({ ...draft, finishedAt: v })} />
            </Labelled>
            <Labelled label="Persona de contacto" className="sm:col-span-2">
              <input className={field} value={draft.contactName} onChange={(e) => setDraft({ ...draft, contactName: e.target.value })} />
            </Labelled>
            <Labelled label="Correo, teléfono o perfil" className="sm:col-span-2">
              <input className={field} value={draft.contact} onChange={(e) => setDraft({ ...draft, contact: e.target.value })} />
            </Labelled>
            <Labelled label="Enlace (repositorio, tablero…)" className="sm:col-span-2">
              <input className={field} value={draft.url} placeholder="https://" onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
            </Labelled>
            <Labelled label="Monto" className="sm:col-span-2">
              <input className={field} inputMode="decimal" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
            </Labelled>
            <Labelled label="Moneda">
              <select
                className={field}
                value={draft.currency}
                onChange={(e) => setDraft({ ...draft, currency: e.target.value as ClientProjectDraft["currency"] })}
              >
                <option value="COP">COP</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
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

      {view.rows.length > 4 ? (
        <input
          type="search"
          className={`${field} sm:max-w-72`}
          placeholder="Buscar por trabajo, empresa o persona"
          aria-label="Buscar trabajos"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      ) : null}

      {view.rows.length === 0 ? (
        <p className="rounded border border-dashed border-neutral-800 px-6 py-12 text-center text-sm text-neutral-500">
          Ningún trabajo todavía. Añade el que tienes en curso y anota cada avance: así se ve qué se mueve y qué lleva días
          quieto.
        </p>
      ) : (
        <>
          {(["in_progress", "not_started"] as const).map((status) => {
            const list = inStatus(status);
            if (list.length === 0) return null;
            return (
              <section key={status} className="flex flex-col gap-2" aria-label={statuses.find((s) => s.value === status)?.label}>
                <h2 className={labelClass}>
                  {statuses.find((s) => s.value === status)?.label} · {list.length}
                </h2>
                <ul className="flex flex-col divide-y divide-neutral-900 rounded-lg border border-neutral-900">{list.map(renderRow)}</ul>
              </section>
            );
          })}
          {inStatus("finished").length > 0 ? (
            <section className="flex flex-col gap-2">
              <button type="button" className={`${small} w-fit`} aria-expanded={showFinished} onClick={() => setShowFinished((v) => !v)}>
                {showFinished ? "Ocultar finalizados" : `Ver finalizados (${inStatus("finished").length})`}
              </button>
              {showFinished ? (
                <ul className="flex flex-col divide-y divide-neutral-900 rounded-lg border border-neutral-900">
                  {inStatus("finished").map(renderRow)}
                </ul>
              ) : null}
            </section>
          ) : null}
        </>
      )}

      <Toast result={result} onDismiss={() => setResult(null)} />
    </div>
  );
}

function Details({
  row,
  today,
  pending,
  onLog,
  onRemoveEntry,
  onRemove,
}: {
  row: ClientProjectRow;
  today: string;
  pending: boolean;
  onLog: (entry: { at: string; text: string; hours: string }, done: () => void) => void;
  onRemoveEntry: (id: string) => void;
  onRemove: () => void;
}) {
  const [text, setText] = useState("");
  const [at, setAt] = useState(today);
  const [hours, setHours] = useState("");

  const isEmail = row.contact && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.contact);
  const isUrl = row.contact && /^https?:\/\//i.test(row.contact);

  return (
    <div className="flex flex-col gap-3 rounded border border-neutral-900 bg-neutral-950/40 p-3">
      {row.description ? <p className="whitespace-pre-line text-xs text-neutral-300">{row.description}</p> : null}
      <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[8rem_1fr]">
        {row.contactName || row.contact ? (
          <>
            <dt className="text-neutral-500">Contacto</dt>
            <dd className="text-neutral-300">
              {row.contactName}
              {row.contactName && row.contact ? " · " : ""}
              {isEmail ? (
                <a className="underline underline-offset-2" href={`mailto:${row.contact}`}>
                  {row.contact}
                </a>
              ) : isUrl ? (
                <a className="underline underline-offset-2" href={row.contact!} target="_blank" rel="noreferrer">
                  {row.contact}
                </a>
              ) : (
                row.contact
              )}
            </dd>
          </>
        ) : null}
        {row.url ? (
          <>
            <dt className="text-neutral-500">Enlace</dt>
            <dd>
              <a className="inline-flex items-center gap-1 text-neutral-300 underline underline-offset-2" href={row.url} target="_blank" rel="noreferrer">
                Abrir <BsBoxArrowUpRight className="h-3 w-3" aria-hidden />
              </a>
            </dd>
          </>
        ) : null}
        {row.startedAt ? (
          <>
            <dt className="text-neutral-500">Inicio</dt>
            <dd className="text-neutral-300">{formatPartialDate(row.startedAt)}</dd>
          </>
        ) : null}
      </dl>

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onLog({ at, text, hours }, () => {
            setText("");
            setHours("");
          });
        }}
      >
        <span className={labelClass}>Anotar un avance</span>
        <div className="flex flex-wrap gap-2">
          <div className="w-40">
            <DateField label="del avance" value={at} onChange={setAt} />
          </div>
          <input
            className={`${field} min-w-0 flex-1`}
            value={text}
            placeholder="Terminé el carrito · Reunión de revisión con el cliente"
            aria-label="Qué avanzaste"
            onChange={(e) => setText(e.target.value)}
          />
          <input
            className={`${field} w-24`}
            inputMode="decimal"
            value={hours}
            placeholder="Horas"
            aria-label="Horas (opcional)"
            onChange={(e) => setHours(e.target.value)}
          />
        </div>
        <div>
          <button type="submit" className={small} disabled={pending || !text.trim()}>
            Anotar
          </button>
        </div>
      </form>

      {row.entries.length > 0 ? (
        <ol className="flex flex-col gap-1.5 border-l border-neutral-800 pl-3" aria-label="Bitácora del trabajo">
          {row.entries.map((e) => (
            <li key={e.id} className="flex items-start gap-2 text-xs">
              <span className="w-24 shrink-0 font-mono text-[11px] text-neutral-500">{formatPartialDate(e.at)}</span>
              <span className="min-w-0 flex-1 whitespace-pre-line text-neutral-300">{e.text}</span>
              {e.hours !== null ? <span className="shrink-0 font-mono text-[11px] text-neutral-500">{e.hours} h</span> : null}
              <button
                type="button"
                aria-label="Borrar este avance"
                className="rounded p-1 text-neutral-600 hover:text-red-400"
                onClick={() => {
                  if (confirm("¿Borrar este avance de la bitácora?")) onRemoveEntry(e.id);
                }}
              >
                <BsX className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-[11px] text-neutral-500">Sin avances anotados todavía.</p>
      )}

      <div>
        <button type="button" className={`${small} hover:border-red-900 hover:text-red-400`} onClick={onRemove}>
          <BsTrash className="h-3 w-3" aria-hidden />
          Mover a la papelera
        </button>
      </div>
    </div>
  );
}
