"use client";

import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BsFileEarmarkText, BsPin, BsPinFill, BsPlus, BsTrash } from "react-icons/bs";
import Toast from "@/components/Toast";
import Unsaved from "@/components/Unsaved";
import type { ActionResult } from "@/app/(panel)/notas/actions";
import { fold } from "@/lib/list-filters";
import {
  backlinks,
  emptyNote,
  excerpt,
  findByTitle,
  noteProblems,
  parseNote,
  wikiLinks,
  type Inline,
  type NoteDraft,
} from "@/lib/note-draft";
import type { NoteRow } from "@/lib/notes";
import { isDirty, useUnsavedChanges } from "@/lib/use-unsaved";

const field =
  "w-full rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none";
const small =
  "inline-flex items-center gap-1 rounded border border-neutral-800 px-2 py-1 text-xs text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-100 disabled:opacity-40";
const primary =
  "rounded border border-neutral-600 bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-950 transition-colors hover:bg-white disabled:opacity-40";

type Actions = {
  save: (draft: NoteDraft) => Promise<ActionResult>;
  pin: (id: string, pinned: boolean) => Promise<ActionResult>;
  remove: (id: string, title: string) => Promise<ActionResult>;
  toArticle: (id: string) => Promise<ActionResult>;
};

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });

/**
 * Notes: what was learnt, kept where it can be found.
 *
 * All of them come down at once, so search, tags and «enlazan aquí» answer
 * without a round trip. The open note lives in the address (`?nota=`), written
 * with `history.replaceState` like Multimedia's filters, so a note is a link and
 * opening one does not ask the server for the whole list again.
 */
export default function NotesModule({ notes, actions }: { notes: NoteRow[]; actions: Actions }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  /** A note being written that is not saved yet, with the title it started from. */
  const [fresh, setFresh] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const openId = params.get("nota");
  const open = openId ? (notes.find((n) => n.id === openId) ?? null) : null;

  function select(id: string | null) {
    if (dirty && !confirm("Hay cambios sin guardar en esta nota. ¿Descartarlos?")) return;
    setFresh(null);
    setDirty(false);
    window.history.replaceState(null, "", id ? `${pathname}?nota=${id}` : pathname);
  }

  function startNew(title = "") {
    if (dirty && !confirm("Hay cambios sin guardar en esta nota. ¿Descartarlos?")) return;
    setDirty(false);
    window.history.replaceState(null, "", pathname);
    setFresh(title);
  }

  /** A [[link]]: open the note, or start it if it does not exist yet. */
  function follow(title: string) {
    const target = findByTitle(notes, title);
    if (target) select(target.id);
    else startNew(title);
  }

  function run(action: () => Promise<ActionResult>, onOk?: (outcome: ActionResult) => void) {
    setResult(null);
    startTransition(async () => {
      const outcome = await action();
      setResult(outcome);
      if (outcome.ok) {
        onOk?.(outcome);
        router.refresh();
      }
    });
  }

  const tags = [...notes.flatMap((n) => n.tags).reduce((m, t) => m.set(t, (m.get(t) ?? 0) + 1), new Map<string, number>())].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const needle = fold(query);
  const shown = notes.filter(
    (n) => (!tag || n.tags.includes(tag)) && (!needle || fold(`${n.title} ${n.body} ${n.tags.join(" ")}`).includes(needle)),
  );

  const editing = fresh !== null || open !== null;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Notas</h1>
          <p className="mt-1 max-w-prose text-sm text-neutral-500">
            Lo que aprendes, en Markdown. <code className="text-neutral-400">[[Otra nota]]</code> enlaza a otra por su
            título, y una nota puede convertirse en borrador de artículo.
          </p>
        </div>
        <button type="button" className={`${small} border-neutral-700 text-neutral-200`} onClick={() => startNew()}>
          <BsPlus className="h-4 w-4" aria-hidden />
          Nueva nota
        </button>
      </header>

      <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
        {/* ------------------------------ la lista ------------------------------ */}
        <aside className={`flex flex-col gap-3 ${editing ? "hidden lg:flex" : ""}`} aria-label="Lista de notas">
          <input
            type="search"
            className={field}
            placeholder="Buscar en títulos y texto"
            aria-label="Buscar notas"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {tags.map(([t, count]) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={tag === t}
                  onClick={() => setTag(tag === t ? null : t)}
                  className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                    tag === t ? "border-neutral-400 text-neutral-100" : "border-neutral-800 text-neutral-500 hover:border-neutral-600"
                  }`}
                >
                  #{t} <span className="font-mono text-[10px] text-neutral-500">{count}</span>
                </button>
              ))}
            </div>
          ) : null}

          {notes.length === 0 ? (
            <p className="rounded border border-dashed border-neutral-800 px-4 py-8 text-center text-sm text-neutral-500">
              Ninguna nota todavía.
            </p>
          ) : shown.length === 0 ? (
            <p className="text-sm text-neutral-500">Ninguna nota coincide.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-neutral-900 rounded-lg border border-neutral-900">
              {shown.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => select(n.id)}
                    aria-current={n.id === openId ? "true" : undefined}
                    className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors hover:bg-neutral-900/50 ${
                      n.id === openId ? "bg-neutral-900" : ""
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-sm text-neutral-100">
                      {n.pinned ? <BsPinFill className="h-3 w-3 shrink-0 text-neutral-500" aria-label="Fijada" /> : null}
                      <span className="truncate">{n.title}</span>
                    </span>
                    {n.body ? <span className="line-clamp-2 text-[11px] text-neutral-500">{excerpt(n.body)}</span> : null}
                    <span className="font-mono text-[10px] text-neutral-500">
                      {dateLabel(n.updatedAt)}
                      {n.tags.length > 0 ? ` · ${n.tags.map((t) => `#${t}`).join(" ")}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* ------------------------------ la nota ------------------------------ */}
        <section className={editing ? "" : "hidden lg:block"} aria-label="Nota">
          {fresh !== null ? (
            <Editor
              key={`new:${fresh}`}
              note={null}
              initialTitle={fresh}
              notes={notes}
              pending={pending}
              onDirty={setDirty}
              onFollow={follow}
              onClose={() => select(null)}
              onSave={(draft) =>
                run(
                  () => actions.save(draft),
                  (outcome) => {
                    setDirty(false);
                    setFresh(null);
                    if (outcome.ok && outcome.id) window.history.replaceState(null, "", `${pathname}?nota=${outcome.id}`);
                  },
                )
              }
              actions={actions}
              run={run}
            />
          ) : open ? (
            <Editor
              key={open.id}
              note={open}
              initialTitle=""
              notes={notes}
              pending={pending}
              onDirty={setDirty}
              onFollow={follow}
              onClose={() => select(null)}
              onSave={(draft) => run(() => actions.save(draft), () => setDirty(false))}
              actions={actions}
              run={run}
            />
          ) : openId ? (
            <p className="text-sm text-neutral-500">Abriendo…</p>
          ) : (
            <p className="rounded-lg border border-dashed border-neutral-800 px-6 py-16 text-center text-sm text-neutral-500">
              Elige una nota o empieza una nueva.
            </p>
          )}
        </section>
      </div>

      <Toast result={result} onDismiss={() => setResult(null)} />
    </div>
  );
}

function Editor({
  note,
  initialTitle,
  notes,
  pending,
  onDirty,
  onFollow,
  onClose,
  onSave,
  actions,
  run,
}: {
  note: NoteRow | null;
  initialTitle: string;
  notes: NoteRow[];
  pending: boolean;
  onDirty: (dirty: boolean) => void;
  onFollow: (title: string) => void;
  onClose: () => void;
  onSave: (draft: NoteDraft) => void;
  actions: Actions;
  run: (action: () => Promise<ActionResult>, onOk?: (outcome: ActionResult) => void) => void;
}) {
  const router = useRouter();
  const saved: NoteDraft = note
    ? { id: note.id, title: note.title, body: note.body, tags: note.tags.join(", ") }
    : emptyNote(initialTitle);
  const [draft, setDraft] = useState<NoteDraft>(saved);
  // Read what exists, write what is new.
  const [mode, setMode] = useState<"read" | "edit">(note && note.body ? "read" : "edit");

  const dirty = isDirty(saved, draft);
  useUnsavedChanges(dirty);
  const problems = noteProblems(draft);

  function change(next: NoteDraft) {
    setDraft(next);
    onDirty(isDirty(saved, next));
  }

  const linked = note ? backlinks(notes, note) : [];
  const missing = wikiLinks(draft.body).filter((t) => !findByTitle(notes, t));

  return (
    <article
      className="flex flex-col gap-4 rounded-lg border border-neutral-800 p-5"
      onKeyDown={(e) => {
        // Ctrl/⌘+S saves, because that is what the hand does in a text editor.
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          if (problems.length === 0 && dirty) onSave(draft);
        }
      }}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button type="button" className={`${small} lg:hidden`} onClick={onClose}>
            ← Notas
          </button>
          <div className="flex rounded border border-neutral-800" role="group" aria-label="Modo">
            {(["read", "edit"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={`px-2.5 py-1 text-xs ${mode === m ? "bg-neutral-800 text-neutral-100" : "text-neutral-500 hover:text-neutral-200"}`}
              >
                {m === "read" ? "Leer" : "Editar"}
              </button>
            ))}
          </div>
          {dirty ? <Unsaved /> : null}
        </div>
        {note ? (
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              className={small}
              disabled={pending}
              onClick={() => run(() => actions.pin(note.id, !note.pinned))}
              aria-pressed={note.pinned}
            >
              {note.pinned ? <BsPinFill className="h-3 w-3" aria-hidden /> : <BsPin className="h-3 w-3" aria-hidden />}
              {note.pinned ? "Fijada" : "Fijar"}
            </button>
            {note.postId ? (
              <Link href={`/contenido/blogs/${note.postId}`} className={small}>
                <BsFileEarmarkText className="h-3 w-3" aria-hidden />
                Ver borrador
              </Link>
            ) : (
              <button
                type="button"
                className={small}
                disabled={pending || dirty}
                title={dirty ? "Guarda la nota primero: el borrador sale de lo guardado" : "Crea un borrador en Blogs con esta nota"}
                onClick={() =>
                  run(
                    () => actions.toArticle(note.id),
                    (outcome) => {
                      if (outcome.ok && outcome.href) router.push(outcome.href);
                    },
                  )
                }
              >
                <BsFileEarmarkText className="h-3 w-3" aria-hidden />
                Convertir en artículo
              </button>
            )}
            <button
              type="button"
              className={`${small} hover:border-red-900 hover:text-red-400`}
              disabled={pending}
              onClick={() => {
                if (!confirm(`¿Mover «${note.title}» a la papelera? Se puede restaurar durante 30 días.`)) return;
                run(() => actions.remove(note.id, note.title), onClose);
              }}
            >
              <BsTrash className="h-3 w-3" aria-hidden />
            </button>
          </div>
        ) : null}
      </header>

      {mode === "edit" ? (
        <>
          <input
            className={`${field} text-base font-semibold`}
            value={draft.title}
            placeholder="Título"
            aria-label="Título"
            autoFocus={!note}
            onChange={(e) => change({ ...draft, title: e.target.value })}
          />
          <input
            className={field}
            value={draft.tags}
            placeholder="Etiquetas, separadas por comas: postgres, rendimiento"
            aria-label="Etiquetas"
            onChange={(e) => change({ ...draft, tags: e.target.value })}
          />
          <textarea
            className={`${field} min-h-[22rem] font-mono text-[13px] leading-relaxed`}
            value={draft.body}
            placeholder={"# Lo que aprendí\n\nUn párrafo, una - lista, `código`, [un enlace](https://…) o [[otra nota]]."}
            aria-label="Texto de la nota"
            onChange={(e) => change({ ...draft, body: e.target.value })}
          />
          <p className="text-[11px] text-neutral-500">
            # títulos · - listas · &gt; citas · ``` bloques de código · **negrita** · [texto](url) · [[otra nota]] · Ctrl+S
            guarda.
          </p>
          {problems.length > 0 && dirty ? <p className="text-[11px] text-amber-500">{problems.join(" ")}</p> : null}
          <div className="flex gap-2">
            <button type="button" className={primary} disabled={pending || problems.length > 0 || !dirty} onClick={() => onSave(draft)}>
              {pending ? "Guardando…" : "Guardar"}
            </button>
            {note && draft.body ? (
              <button type="button" className={small} onClick={() => setMode("read")}>
                Ver cómo queda
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <h2 className="text-lg font-semibold tracking-tight text-neutral-100">{draft.title}</h2>
          {draft.tags.trim() ? (
            <p className="font-mono text-[11px] text-neutral-500">
              {draft.tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
                .map((t) => `#${t}`)
                .join(" ")}
            </p>
          ) : null}
          <NoteView body={draft.body} notes={notes} onFollow={onFollow} />
        </>
      )}

      {missing.length > 0 ? (
        <p className="text-[11px] text-neutral-500">
          Enlaces a notas que aún no existen:{" "}
          {missing.map((t, i) => (
            <span key={t}>
              {i > 0 ? ", " : ""}
              <button type="button" className="text-neutral-300 underline decoration-dotted" onClick={() => onFollow(t)}>
                {t}
              </button>
            </span>
          ))}
          . Al pulsar uno se empieza.
        </p>
      ) : null}

      {linked.length > 0 ? (
        <footer className="flex flex-col gap-1.5 border-t border-neutral-900 pt-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500">Enlazan aquí</span>
          <ul className="flex flex-wrap gap-1.5">
            {linked.map((n) => (
              <li key={n.id}>
                <button type="button" className={small} onClick={() => onFollow(n.title)}>
                  {n.title}
                </button>
              </li>
            ))}
          </ul>
        </footer>
      ) : null}
    </article>
  );
}

function Inlines({ parts, notes, onFollow }: { parts: Inline[]; notes: NoteRow[]; onFollow: (title: string) => void }) {
  return (
    <>
      {parts.map((part, i): ReactNode => {
        switch (part.kind) {
          case "text":
            return <span key={i}>{part.text}</span>;
          case "strong":
            return (
              <strong key={i} className="font-semibold text-neutral-100">
                {part.text}
              </strong>
            );
          case "em":
            return <em key={i}>{part.text}</em>;
          case "code":
            return (
              <code key={i} className="rounded bg-neutral-900 px-1 py-0.5 font-mono text-[0.9em] text-neutral-200">
                {part.text}
              </code>
            );
          case "link":
            return (
              <a key={i} href={part.href} target="_blank" rel="noreferrer" className="break-words text-neutral-100 underline underline-offset-2">
                {part.text}
              </a>
            );
          case "wiki": {
            const exists = !!findByTitle(notes, part.title);
            return (
              <button
                key={i}
                type="button"
                onClick={() => onFollow(part.title)}
                title={exists ? "Abrir la nota" : "Esa nota no existe: pulsa para empezarla"}
                className={`text-neutral-100 underline underline-offset-2 ${exists ? "" : "decoration-dotted opacity-70"}`}
              >
                {part.title}
              </button>
            );
          }
        }
      })}
    </>
  );
}

function NoteView({ body, notes, onFollow }: { body: string; notes: NoteRow[]; onFollow: (title: string) => void }) {
  const blocks = parseNote(body);
  if (blocks.length === 0) return <p className="text-sm text-neutral-500">Nota vacía. Pulsa «Editar» para escribir.</p>;
  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed text-neutral-300">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "heading": {
            const size = block.level === 1 ? "text-base" : block.level === 2 ? "text-sm" : "text-sm text-neutral-200";
            return (
              <p key={i} className={`font-semibold text-neutral-100 ${size}`} role="heading" aria-level={block.level + 2}>
                <Inlines parts={block.inline} notes={notes} onFollow={onFollow} />
              </p>
            );
          }
          case "paragraph":
            return (
              <p key={i}>
                <Inlines parts={block.inline} notes={notes} onFollow={onFollow} />
              </p>
            );
          case "quote":
            return (
              <blockquote key={i} className="border-l-2 border-neutral-700 pl-3 text-neutral-400">
                <Inlines parts={block.inline} notes={notes} onFollow={onFollow} />
              </blockquote>
            );
          case "list": {
            const items = block.items.map((item, j) => (
              <li key={j}>
                <Inlines parts={item} notes={notes} onFollow={onFollow} />
              </li>
            ));
            return block.ordered ? (
              <ol key={i} className="list-decimal pl-5">
                {items}
              </ol>
            ) : (
              <ul key={i} className="list-disc pl-5">
                {items}
              </ul>
            );
          }
          case "code":
            return (
              <pre key={i} className="overflow-x-auto rounded border border-neutral-800 bg-neutral-950 p-3 font-mono text-[12px] text-neutral-200">
                <code>{block.code}</code>
              </pre>
            );
        }
      })}
    </div>
  );
}
