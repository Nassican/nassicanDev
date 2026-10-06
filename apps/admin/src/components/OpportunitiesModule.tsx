"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BsBoxArrowUpRight, BsChevronDown, BsPencil, BsPlus, BsTrash, BsX } from "react-icons/bs";
import type { OpportunityStage } from "@nassican/db";
import DateField from "@/components/DateField";
import Toast from "@/components/Toast";
import Unsaved from "@/components/Unsaved";
import type { ActionResult } from "@/app/(panel)/oportunidades/actions";
import { formatPartialDate } from "@/lib/draft-fields";
import { fold } from "@/lib/list-filters";
import type { OpportunitiesView, OpportunityRow } from "@/lib/opportunities";
import {
  emptyOpportunity,
  kindLabel,
  kinds,
  opportunityProblems,
  stages,
  type FollowUp,
  type OpportunityDraft,
} from "@/lib/opportunity-draft";
import { isDirty, useUnsavedChanges } from "@/lib/use-unsaved";

const field =
  "w-full rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none";
const labelClass = "font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500";
const small =
  "inline-flex items-center gap-1 rounded border border-neutral-800 px-2 py-1 text-xs text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-100 disabled:opacity-40";
const primary =
  "rounded border border-neutral-600 bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-950 transition-colors hover:bg-white disabled:opacity-40";

type Actions = {
  save: (draft: OpportunityDraft) => Promise<ActionResult>;
  setStage: (id: string, stage: OpportunityStage) => Promise<ActionResult>;
  log: (
    id: string,
    entry: { at: string; text: string },
    next: { nextStep: string; nextStepOn: string } | null,
  ) => Promise<ActionResult>;
  removeEntry: (entryId: string) => Promise<ActionResult>;
  remove: (id: string, title: string) => Promise<ActionResult>;
};

function toDraft(o: OpportunityRow): OpportunityDraft {
  return {
    id: o.id,
    title: o.title,
    kind: o.kind,
    stage: o.stage,
    organization: o.organization ?? "",
    contactName: o.contactName ?? "",
    contact: o.contact ?? "",
    url: o.url ?? "",
    nextStep: o.nextStep ?? "",
    nextStepOn: o.nextStepOn ?? "",
    amount: o.amount === null ? "" : String(o.amount),
    currency: o.currency ?? "COP",
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

function FollowUpBadge({ state, step, on }: { state: FollowUp; step: string | null; on: string | null }) {
  if (!state) return null;
  if (state.kind === "missing") {
    return <span className="text-[11px] text-amber-500">Sin próximo paso</span>;
  }
  const tone =
    state.kind === "overdue" ? "text-red-400" : state.kind === "today" ? "text-amber-400" : state.kind === "soon" ? "text-amber-500" : "text-neutral-500";
  const when =
    state.kind === "overdue"
      ? `hace ${state.days} ${state.days === 1 ? "día" : "días"}`
      : state.kind === "today"
        ? "hoy"
        : state.kind === "soon"
          ? state.days === 1
            ? "mañana"
            : `en ${state.days} días`
          : formatPartialDate(on);
  return (
    <span className={`text-[11px] ${tone}`}>
      {step ? `${step} · ` : ""}
      {when}
    </span>
  );
}

const money = (amount: number, currency: string) =>
  amount.toLocaleString("es-CO", { style: "currency", currency, maximumFractionDigits: 0 });

/**
 * Opportunities: jobs, clients, recruiters and collaborations, each with the
 * one thing that keeps a reply from being forgotten — a next step on a day.
 *
 * Grouped by stage in pipeline order, and closed ones folded away at the end:
 * the page is for what is still moving.
 */
export default function OpportunitiesModule({ view, actions }: { view: OpportunitiesView; actions: Actions }) {
  const router = useRouter();
  const [draft, setDraft] = useState<OpportunityDraft | null>(null);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const baseline = draft?.id ? view.rows.find((r) => r.id === draft.id) : null;
  const dirty = draft !== null && isDirty(baseline ? toDraft(baseline) : emptyOpportunity(), draft);
  useUnsavedChanges(dirty);
  const problems = draft ? opportunityProblems(draft) : [];

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
  const rows = view.rows.filter(
    (r) => !needle || fold(`${r.title} ${r.organization ?? ""} ${r.contactName ?? ""}`).includes(needle),
  );
  const open = rows.filter((r) => r.followUp !== null);
  const closed = rows.filter((r) => r.followUp === null);
  const waiting = view.rows.filter((r) => r.followUp?.kind === "overdue" || r.followUp?.kind === "today").length;
  const stepless = view.rows.filter((r) => r.followUp?.kind === "missing").length;

  const renderRow = (o: OpportunityRow) => {
    const expanded = openRow === o.id;
    return (
      <li key={o.id} className="flex flex-col gap-2 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
          <button
            type="button"
            className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
            aria-expanded={expanded}
            onClick={() => setOpenRow(expanded ? null : o.id)}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm text-neutral-100">{o.title}</span>
              <span className="shrink-0 rounded-full border border-neutral-800 px-2 py-0.5 text-[10px] text-neutral-400">
                {kindLabel(o.kind)}
              </span>
            </span>
            <span className="flex flex-wrap gap-x-2 text-[11px] text-neutral-500">
              {o.organization ? <span>{o.organization}</span> : null}
              {o.amount !== null && o.currency ? <span>{money(o.amount, o.currency)}</span> : null}
              <FollowUpBadge state={o.followUp} step={o.nextStep} on={o.nextStepOn} />
              {o.closedAt ? <span>cerrada {formatPartialDate(o.closedAt.slice(0, 10))}</span> : null}
            </span>
          </button>
          <select
            className={`${field} w-auto shrink-0`}
            value={o.stage}
            disabled={pending}
            aria-label={`Etapa de ${o.title}`}
            onChange={(e) => run(() => actions.setStage(o.id, e.target.value as OpportunityStage))}
          >
            {stages.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <span className="flex shrink-0 gap-1">
            <button
              type="button"
              aria-label={`Editar ${o.title}`}
              onClick={() => setDraft(toDraft(o))}
              className="rounded p-1.5 text-neutral-500 transition-colors hover:text-neutral-200"
            >
              <BsPencil className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              aria-label={expanded ? `Cerrar ${o.title}` : `Abrir ${o.title}`}
              onClick={() => setOpenRow(expanded ? null : o.id)}
              className="rounded p-1.5 text-neutral-500 transition-colors hover:text-neutral-200"
            >
              <BsChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden />
            </button>
          </span>
        </div>
        {expanded ? (
          <Details
            row={o}
            today={view.today}
            pending={pending}
            onLog={(entry, next) => run(() => actions.log(o.id, entry, next))}
            onRemoveEntry={(id) => run(() => actions.removeEntry(id))}
            onRemove={() => {
              if (!confirm(`¿Mover «${o.title}» a la papelera, con su historial? Se puede restaurar durante 30 días.`)) return;
              run(() => actions.remove(o.id, o.title), () => setOpenRow(null));
            }}
          />
        ) : null}
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Oportunidades</h1>
          <p className="mt-1 max-w-prose text-sm text-neutral-500">
            Ofertas, clientes, reclutadores y colaboraciones. Cada una abierta lleva un próximo paso con fecha: es lo que
            evita que una respuesta se olvide.
          </p>
        </div>
        <button type="button" className={`${small} border-neutral-700 text-neutral-200`} onClick={() => setDraft(emptyOpportunity())}>
          <BsPlus className="h-4 w-4" aria-hidden />
          Añadir
        </button>
      </header>

      {view.rows.length > 0 ? (
        <section className="flex flex-wrap gap-2 text-xs" aria-label="Resumen">
          <span className="rounded-full border border-neutral-800 px-3 py-1 text-neutral-300">
            <span className="font-semibold tabular-nums">{view.rows.filter((r) => r.followUp !== null).length}</span> abiertas
          </span>
          {waiting > 0 ? (
            <span className="rounded-full border border-amber-900 px-3 py-1 text-amber-400">
              <span className="font-semibold tabular-nums">{waiting}</span> esperan algo de ti hoy
            </span>
          ) : null}
          {stepless > 0 ? (
            <span className="rounded-full border border-neutral-800 px-3 py-1 text-amber-500">
              <span className="font-semibold tabular-nums">{stepless}</span> sin próximo paso
            </span>
          ) : null}
        </section>
      ) : null}

      {draft ? (
        <section className="flex flex-col gap-4 rounded-lg border border-neutral-800 p-5" aria-label="Editar oportunidad">
          <header className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">{draft.id ? "Editar oportunidad" : "Nueva oportunidad"}</h2>
            {dirty ? <Unsaved /> : null}
          </header>
          <div className="grid gap-3 sm:grid-cols-6">
            <Labelled label="Título" className="sm:col-span-3">
              <input
                className={field}
                value={draft.title}
                placeholder="Backend en Acme · Sitio para Panadería X"
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </Labelled>
            <Labelled label="Tipo">
              <select className={field} value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as OpportunityDraft["kind"] })}>
                {kinds.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </Labelled>
            <Labelled label="Etapa" className="sm:col-span-2">
              <select className={field} value={draft.stage} onChange={(e) => setDraft({ ...draft, stage: e.target.value as OpportunityStage })}>
                {stages.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Labelled>
            <Labelled label="Empresa u organización" className="sm:col-span-2">
              <input className={field} value={draft.organization} onChange={(e) => setDraft({ ...draft, organization: e.target.value })} />
            </Labelled>
            <Labelled label="Persona de contacto" className="sm:col-span-2">
              <input className={field} value={draft.contactName} onChange={(e) => setDraft({ ...draft, contactName: e.target.value })} />
            </Labelled>
            <Labelled label="Correo, teléfono o perfil" className="sm:col-span-2">
              <input className={field} value={draft.contact} onChange={(e) => setDraft({ ...draft, contact: e.target.value })} />
            </Labelled>
            <Labelled label="Enlace (oferta, propuesta…)" className="sm:col-span-3">
              <input className={field} value={draft.url} placeholder="https://" onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
            </Labelled>
            <Labelled label="Monto (salario o presupuesto)" className="sm:col-span-2">
              <input className={field} inputMode="decimal" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
            </Labelled>
            <Labelled label="Moneda">
              <select
                className={field}
                value={draft.currency}
                onChange={(e) => setDraft({ ...draft, currency: e.target.value as OpportunityDraft["currency"] })}
              >
                <option value="COP">COP</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </Labelled>
            <Labelled label="Próximo paso" className="sm:col-span-4">
              <input
                className={field}
                value={draft.nextStep}
                placeholder="Enviar portafolio · Llamar para la propuesta"
                onChange={(e) => setDraft({ ...draft, nextStep: e.target.value })}
              />
            </Labelled>
            <Labelled label="¿Cuándo?" className="sm:col-span-2">
              <DateField label="del próximo paso" allowTime value={draft.nextStepOn} onChange={(v) => setDraft({ ...draft, nextStepOn: v })} />
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

      {view.rows.length > 3 ? (
        <input
          type="search"
          className={`${field} sm:max-w-72`}
          placeholder="Buscar por título, empresa o persona"
          aria-label="Buscar oportunidades"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      ) : null}

      {view.rows.length === 0 ? (
        <p className="rounded border border-dashed border-neutral-800 px-6 py-12 text-center text-sm text-neutral-500">
          Ninguna todavía. Una oferta que viste, alguien que te escribió por LinkedIn, un cliente que preguntó: apúntala con
          su próximo paso.
        </p>
      ) : (
        <>
          {stages
            .filter((s) => s.open)
            .map((stage) => {
              const inStage = open.filter((r) => r.stage === stage.value);
              if (inStage.length === 0) return null;
              return (
                <section key={stage.value} className="flex flex-col gap-2" aria-label={stage.label}>
                  <h2 className={labelClass}>
                    {stage.label} · {inStage.length}
                  </h2>
                  <ul className="flex flex-col divide-y divide-neutral-900 rounded-lg border border-neutral-900">
                    {inStage
                      .sort((a, b) => (a.nextStepOn ?? "9999").localeCompare(b.nextStepOn ?? "9999"))
                      .map(renderRow)}
                  </ul>
                </section>
              );
            })}
          {closed.length > 0 ? (
            <section className="flex flex-col gap-2">
              <button type="button" className={`${small} w-fit`} aria-expanded={showClosed} onClick={() => setShowClosed((v) => !v)}>
                {showClosed ? "Ocultar cerradas" : `Ver cerradas (${closed.length})`}
              </button>
              {showClosed ? (
                <ul className="flex flex-col divide-y divide-neutral-900 rounded-lg border border-neutral-900">{closed.map(renderRow)}</ul>
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
  row: OpportunityRow;
  today: string;
  pending: boolean;
  onLog: (entry: { at: string; text: string }, next: { nextStep: string; nextStepOn: string } | null) => void;
  onRemoveEntry: (id: string) => void;
  onRemove: () => void;
}) {
  const [text, setText] = useState("");
  const [at, setAt] = useState(today);
  const [moveOn, setMoveOn] = useState(false);
  const [nextStep, setNextStep] = useState("");
  const [nextStepOn, setNextStepOn] = useState("");

  const isEmail = row.contact && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.contact);
  const isUrl = row.contact && /^https?:\/\//i.test(row.contact);

  return (
    <div className="flex flex-col gap-3 rounded border border-neutral-900 bg-neutral-950/40 p-3">
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
      </dl>

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onLog({ at, text }, moveOn ? { nextStep, nextStepOn } : null);
          setText("");
          setMoveOn(false);
          setNextStep("");
          setNextStepOn("");
        }}
      >
        <span className={labelClass}>Anotar lo que pasó</span>
        <div className="flex flex-wrap gap-2">
          <div className="w-40">
            <DateField label="de la nota" value={at} onChange={setAt} />
          </div>
          <input
            className={`${field} min-w-0 flex-1`}
            value={text}
            placeholder="Les envié el portafolio · Me llamaron para la segunda entrevista"
            aria-label="Qué pasó"
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-neutral-400">
          <input type="checkbox" checked={moveOn} onChange={(e) => setMoveOn(e.target.checked)} />
          Y el próximo paso cambia
        </label>
        {moveOn ? (
          <div className="flex flex-wrap gap-2">
            <input
              className={`${field} min-w-0 flex-1`}
              value={nextStep}
              placeholder="Próximo paso"
              aria-label="Próximo paso"
              onChange={(e) => setNextStep(e.target.value)}
            />
            <div className="w-48">
              <DateField label="del próximo paso" allowTime value={nextStepOn} onChange={setNextStepOn} />
            </div>
          </div>
        ) : null}
        <div>
          <button type="submit" className={small} disabled={pending || !text.trim()}>
            Anotar
          </button>
        </div>
      </form>

      {row.entries.length > 0 ? (
        <ol className="flex flex-col gap-1.5 border-l border-neutral-800 pl-3">
          {row.entries.map((e) => (
            <li key={e.id} className="group flex items-start gap-2 text-xs">
              <span className="w-24 shrink-0 font-mono text-[11px] text-neutral-500">{formatPartialDate(e.at)}</span>
              <span className="min-w-0 flex-1 whitespace-pre-line text-neutral-300">{e.text}</span>
              <button
                type="button"
                aria-label="Borrar esta nota"
                className="rounded p-1 text-neutral-600 hover:text-red-400"
                onClick={() => {
                  if (confirm("¿Borrar esta nota del historial?")) onRemoveEntry(e.id);
                }}
              >
                <BsX className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-[11px] text-neutral-500">Sin notas todavía.</p>
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
