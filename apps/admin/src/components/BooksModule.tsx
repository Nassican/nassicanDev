"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BsPencil, BsPlus, BsTrash } from "react-icons/bs";
import QuickField, { FinishPrompt } from "@/components/QuickField";
import Toast from "@/components/Toast";
import Unsaved from "@/components/Unsaved";
import { fold } from "@/lib/list-filters";
import {
  bookProblems,
  fillFromFacts,
  emptyBook,
  formatLabel,
  formats,
  progressRatio,
  statuses,
  type BookDraft,
} from "@/lib/book-draft";
import DateField from "@/components/DateField";
import { formatPartialDate } from "@/lib/draft-fields";
import { isDirty, useUnsavedChanges } from "@/lib/use-unsaved";
import type { BooksSummary } from "@/lib/books";
import type { ActionResult, LookupOutcome, QuickBookField } from "@/app/(panel)/libros/actions";
import { quickText } from "@/lib/quick-edit";

const field =
  "rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none";
const labelClass = "font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500";
const button =
  "inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm transition-colors disabled:opacity-50";

const money = (n: number) =>
  n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

/**
 * The books library, typed in by hand.
 *
 * Same shape as Juegos down to the field order, which is the point: two
 * libraries that behave differently for no reason are two things to remember.
 * What differs is what a book actually has — an author, pages, a format — and
 * nothing is bent to make the two tables look alike.
 */
export default function BooksModule({
  summary,
  actions,
}: {
  summary: BooksSummary;
  actions: {
    save: (draft: BookDraft) => Promise<ActionResult>;
    remove: (id: string, title: string) => Promise<ActionResult>;
    setStatus: (id: string, status: BookDraft["status"]) => Promise<ActionResult>;
    lookup: (isbn: string) => Promise<LookupOutcome>;
    quick: (id: string, field: QuickBookField, raw: string) => Promise<ActionResult>;
  };
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<BookDraft | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [onlyStatus, setOnlyStatus] = useState<BookDraft["status"] | "">("");
  // Rows become fields: Tab walks the shelf, each field saves on leaving.
  const [quickMode, setQuickMode] = useState(false);
  const [askFinish, setAskFinish] = useState<string | null>(null);

  const dirty = draft !== null && isDirty(baselineFor(draft, summary), draft);
  useUnsavedChanges(dirty);

  const problems = draft ? bookProblems(draft) : [];

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

  /*
   * Kept out of `pending` on purpose: a lookup is not a save, and greying out
   * «Guardar» while a catalogue thinks would read as the form being busy with
   * something it is not.
   */
  const [looking, setLooking] = useState(false);

  async function complete(current: BookDraft) {
    setResult(null);
    setLooking(true);
    const outcome = await actions.lookup(current.isbn);
    setLooking(false);

    if (!outcome.ok) {
      setResult(outcome);
      return;
    }

    // Applied to the form as it is *now*, not as it was on the click: anything
    // typed while the catalogue answered is the operator's, and wins. The
    // message is worked out from the click, since an updater must stay pure.
    const { filled } = fillFromFacts(current, outcome.facts);
    setDraft((open) => (open ? fillFromFacts(open, outcome.facts).draft : open));
    setResult({
      ok: true,
      message:
        filled.length > 0
          ? `${outcome.facts.source}: rellenado ${filled.join(", ")}.`
          : `${outcome.facts.source} lo conoce, pero ya tenías escrito lo que sabe.`,
    });
  }

  const shown = useMemo(() => {
    const needle = fold(query);
    // An ISBN is searched as digits, however it was pasted.
    const digits = query.replace(/[\s-]/g, "");
    return summary.books.filter((book) => {
      if (onlyStatus && book.status !== onlyStatus) return false;
      if (!needle) return true;
      return (
        fold(book.title).includes(needle) ||
        fold(book.author ?? "").includes(needle) ||
        (digits.length >= 4 && (book.isbn ?? "").includes(digits)) ||
        fold(book.note ?? "").includes(needle)
      );
    });
  }, [summary.books, query, onlyStatus]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Libros</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Se añaden a mano, como los juegos. Lo que falta por leer es la cifra
            que importa, y para esa no hay API que la sepa.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setDraft(emptyBook())}
          className={`${button} border-neutral-700 text-neutral-200 hover:border-neutral-500`}
        >
          <BsPlus className="h-4 w-4" aria-hidden />
          Añadir
        </button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Sin empezar"
          value={String(summary.counts.backlog)}
          note={
            summary.unreadSpend > 0
              ? `${money(summary.unreadSpend)} sin abrir`
              : "Nada comprado sin abrir"
          }
          tone={summary.counts.backlog > 0 ? "warn" : "plain"}
        />
        <Stat label="Leyendo" value={String(summary.counts.reading)} />
        <Stat
          label="Terminados"
          value={String(summary.counts.finished)}
          note={`${summary.counts.dropped} abandonados`}
        />
        <Stat
          label="Páginas leídas"
          value={summary.pagesRead > 0 ? summary.pagesRead.toLocaleString("es-CO") : "—"}
          note={
            summary.averageLength !== null
              ? `${Math.round(summary.averageLength)} páginas de media`
              : "Faltan páginas en los terminados"
          }
        />
      </section>

      {draft ? (
        <section className="flex flex-col gap-4 rounded-lg border border-neutral-800 bg-neutral-950 p-5">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">
              {draft.id ? `Editar «${draft.title || "sin título"}»` : "Añadir un libro"}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {dirty ? <Unsaved /> : null}
              <button
                type="button"
                disabled={pending || problems.length > 0}
                title={problems.join(" ") || undefined}
                onClick={() => run(() => actions.save(draft), () => setDraft(null))}
                className={`${button} border-green-800 bg-green-950/60 text-green-300 hover:border-green-600`}
              >
                {pending ? "Guardando…" : "Guardar"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setDraft(null)}
                className={`${button} border-neutral-800 text-neutral-400 hover:border-neutral-600`}
              >
                Cancelar
              </button>
            </div>
          </header>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Labelled label="ISBN" className="sm:col-span-2 lg:col-span-3">
              <div className="flex gap-2">
                <input
                  className={`${field} min-w-0 flex-1 font-mono`}
                  value={draft.isbn}
                  inputMode="numeric"
                  placeholder="978-84-376-0494-7 — opcional; con él se rellena lo demás"
                  onChange={(e) => setDraft({ ...draft, isbn: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && draft.isbn.trim()) {
                      e.preventDefault();
                      complete(draft);
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={looking || !draft.isbn.trim()}
                  title="Busca el ISBN en Open Library y rellena solo los campos vacíos"
                  onClick={() => complete(draft)}
                  className={`${button} shrink-0 border-neutral-700 text-neutral-300 hover:border-neutral-500`}
                >
                  {looking ? "Buscando…" : "Completar"}
                </button>
              </div>
            </Labelled>

            <Labelled label="Título" className="sm:col-span-2">
              <input
                className={field}
                value={draft.title}
                autoFocus
                placeholder="Cien años de soledad"
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </Labelled>

            <Labelled label="Autor">
              <input
                className={field}
                value={draft.author}
                placeholder="Gabriel García Márquez"
                onChange={(e) => setDraft({ ...draft, author: e.target.value })}
              />
            </Labelled>

            <Labelled label="Formato">
              <select
                className={field}
                value={draft.format}
                onChange={(e) =>
                  setDraft({ ...draft, format: e.target.value as BookDraft["format"] })
                }
              >
                {formats.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </Labelled>

            <Labelled label="Estado">
              <select
                className={field}
                value={draft.status}
                onChange={(e) =>
                  setDraft({ ...draft, status: e.target.value as BookDraft["status"] })
                }
              >
                {statuses.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label} — {s.hint}
                  </option>
                ))}
              </select>
            </Labelled>

            <Labelled label="Páginas">
              <input
                className={field}
                value={draft.pages}
                placeholder="471"
                onChange={(e) => setDraft({ ...draft, pages: e.target.value })}
              />
            </Labelled>

            <Labelled label="Leídas">
              <input
                className={field}
                value={draft.pagesRead}
                placeholder="vacío = sin registrar"
                onChange={(e) => setDraft({ ...draft, pagesRead: e.target.value })}
              />
            </Labelled>

            <Labelled label="Precio (COP)">
              <input
                className={field}
                value={draft.price}
                placeholder="vacío = regalo o desconocido"
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              />
            </Labelled>

            <Labelled label="Comprado">
              <DateField
                label="de compra"
                allowTime
                value={draft.purchasedAt}
                onChange={(v) => setDraft({ ...draft, purchasedAt: v })}
              />
            </Labelled>

            <Labelled label="Terminado">
              <DateField
                label="de fin"
                allowTime
                value={draft.finishedAt}
                onChange={(v) => setDraft({ ...draft, finishedAt: v })}
              />
            </Labelled>

            <Labelled label="Nota" className="sm:col-span-2 lg:col-span-3">
              <input
                className={field}
                value={draft.note}
                placeholder="Edición, quién lo recomendó, qué te pareció…"
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              />
            </Labelled>
          </div>

          {problems.length > 0 ? (
            <ul className="flex flex-col gap-1 text-[11px] text-amber-500">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {summary.books.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setQuery("");
                setOnlyStatus("");
              }
            }}
            placeholder="Buscar por título, autor o nota…"
            className={`${field} min-w-56 flex-1`}
          />
          <select
            className={field}
            value={onlyStatus}
            onChange={(e) => setOnlyStatus(e.target.value as typeof onlyStatus)}
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
            title="Páginas, precio y fecha de fin editables en cada fila; Tab pasa al siguiente y cada campo se guarda al salir"
            className={`rounded border px-2.5 py-1.5 text-[11px] transition-colors ${
              quickMode
                ? "border-neutral-500 bg-neutral-800 text-neutral-100"
                : "border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300"
            }`}
          >
            Edición rápida
          </button>
          {shown.length !== summary.books.length ? (
            <span className="text-[11px] text-neutral-600">
              {shown.length} de {summary.books.length}
            </span>
          ) : null}
        </div>
      ) : null}

      {summary.books.length === 0 ? (
        <p className="rounded border border-dashed border-neutral-800 px-6 py-12 text-center text-sm text-neutral-500">
          Todavía no hay nada. Añade el primero — y si no recuerdas el precio,
          déjalo vacío: en blanco significa «no sé», y un cero diría «gratis».
        </p>
      ) : shown.length === 0 ? (
        <p className="rounded border border-dashed border-neutral-800 px-6 py-12 text-center text-sm text-neutral-500">
          Ningún libro coincide con el filtro.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-900 overflow-hidden rounded-lg border border-neutral-900">
          {shown.map((book) => {
            const ratio = progressRatio(book.pages, book.pagesRead);

            return (
              <li key={book.id} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-neutral-200">
                    {book.title}
                    {book.author ? (
                      <span className="text-neutral-500"> · {book.author}</span>
                    ) : null}
                  </span>
                  <span className="block truncate text-[11px] text-neutral-600">
                    {[
                      formatLabel(book.format),
                      book.pages !== null ? `${book.pages} pág.` : null,
                      /*
                        Progress only shows while it means something: a finished
                        book is 100% by definition and saying so is noise.
                      */
                      ratio !== null && book.status === "reading"
                        ? `${Math.round(ratio * 100)}% leído`
                        : null,
                      formatPartialDate(book.purchasedAt),
                      book.price !== null ? money(book.price) : null,
                      book.note,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>

                <select
                  className={`${field} shrink-0`}
                  value={book.status}
                  disabled={pending}
                  onChange={(e) => {
                    const status = e.target.value as BookDraft["status"];
                    run(
                      () => actions.setStatus(book.id, status),
                      () => setAskFinish(status === "finished" && !book.finishedAt ? book.id : null),
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
                    aria-label={`Editar ${book.title}`}
                    onClick={() => setDraft(toDraft(book))}
                    className="rounded p-1.5 text-neutral-500 transition-colors hover:text-neutral-200"
                  >
                    <BsPencil className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label={`Eliminar ${book.title}`}
                    disabled={pending}
                    onClick={() => {
                      if (!confirm(`¿Mover «${book.title}» a la papelera? Se puede restaurar durante 30 días.`)) return;
                      run(() => actions.remove(book.id, book.title));
                    }}
                    className="rounded p-1.5 text-neutral-600 transition-colors hover:text-red-400"
                  >
                    <BsTrash className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </span>
              </div>

              {askFinish === book.id && !book.finishedAt ? (
                <FinishPrompt
                  pending={pending}
                  onToday={() => run(() => actions.quick(book.id, "finishedAt", "today"), () => setAskFinish(null))}
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
                      ["pagesRead", "Leídas", book.pagesRead, "w-16", "numeric"],
                      ["pages", "Páginas", book.pages, "w-16", "numeric"],
                      ["price", "Precio", book.price, "w-24", "decimal"],
                      ["finishedAt", "Fin", book.finishedAt, "w-28", "text"],
                    ] as const
                  ).map(([key, title, value, width, inputMode]) => (
                    <QuickField
                      key={`${key}:${quickText(value)}`}
                      label={title}
                      value={quickText(value)}
                      width={width}
                      inputMode={inputMode}
                      placeholder={inputMode === "text" ? "2024-08" : "—"}
                      onSave={async (raw) => {
                        const outcome = await actions.quick(book.id, key, raw);
                        if (outcome.ok) router.refresh();
                        else setResult(outcome);
                        return outcome;
                      }}
                    />
                  ))}
                </div>
              ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {summary.byAuthor.length > 0 ? (
        <p className="text-[11px] text-neutral-600">
          Más de uno: {summary.byAuthor.map((a) => `${a.author} (${a.count})`).join(" · ")}
          {summary.totalSpend > 0 ? ` · ${money(summary.totalSpend)} en total` : ""}
        </p>
      ) : null}

      <Toast result={result} onDismiss={() => setResult(null)} />
    </div>
  );
}

/** One mapping from a stored row to a form, for opening and for comparing. */
function toDraft(row: BooksSummary["books"][number]): BookDraft {
  return {
    id: row.id,
    title: row.title,
    author: row.author ?? "",
    isbn: row.isbn ?? "",
    format: row.format,
    status: row.status,
    pages: row.pages === null ? "" : String(row.pages),
    pagesRead: row.pagesRead === null ? "" : String(row.pagesRead),
    price: row.price === null ? "" : String(row.price),
    purchasedAt: row.purchasedAt ?? "",
    finishedAt: row.finishedAt ?? "",
    note: row.note ?? "",
  };
}

/**
 * What the open form is compared against. The same mapping that opened it, so
 * a field added to one cannot be missing from the other — which would leave the
 * «sin guardar» marker lit on a form nobody touched.
 */
function baselineFor(draft: BookDraft, summary: BooksSummary): BookDraft {
  if (!draft.id) return emptyBook();
  const row = summary.books.find((b) => b.id === draft.id);
  return row ? toDraft(row) : draft;
}

function Labelled({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <span className={labelClass}>{label}</span>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  tone = "plain",
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "plain" | "warn";
}) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-lg border p-4 ${
        tone === "warn" ? "border-amber-900/50 bg-amber-950/15" : "border-neutral-900"
      }`}
    >
      <span className={labelClass}>{label}</span>
      <span className="text-2xl font-semibold tracking-tight text-neutral-100">
        {value}
      </span>
      {note ? <span className="text-[11px] text-neutral-600">{note}</span> : null}
    </div>
  );
}
