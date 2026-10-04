"use client";

import { useState, useTransition } from "react";
import Toast from "@/components/Toast";

type Entry = {
  id: string;
  kindLabel: string;
  label: string;
  sizeBytes: number;
  deletedAt: string;
  expiresAt: string;
  deletedBy: string | null;
};

type ActionResult =
  | { ok: true; message: string; notes: string[] }
  | { ok: false; message: string };

const button =
  "rounded border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 transition-colors hover:border-neutral-500 hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-40";

const date = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });

const size = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`;

function daysLeft(iso: string, now: number): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 86_400_000));
}

/**
 * What was deleted in the last month, and the way back.
 *
 * A restore that had to leave something out — an image that was deleted in
 * the meantime, a tag that no longer exists — says so below the list rather
 * than in the toast. The toast goes away by itself, and those notes are what
 * someone needs to go and fix.
 */
export default function TrashModule({
  days,
  entries,
  actions,
}: {
  days: number;
  entries: Entry[];
  actions: {
    restoreItem: (id: string) => Promise<ActionResult>;
    destroyItem: (id: string) => Promise<ActionResult>;
  };
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [notes, setNotes] = useState<{ label: string; notes: string[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // Read once: the countdown does not need to tick while the page is open.
  const [now] = useState(() => Date.now());

  function run(entry: Entry, action: (id: string) => Promise<ActionResult>) {
    setResult(null);
    setBusy(entry.id);
    startTransition(async () => {
      const outcome = await action(entry.id);
      setBusy(null);
      setResult(outcome);
      setNotes(outcome.ok && outcome.notes.length > 0 ? { label: entry.label, notes: outcome.notes } : null);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Papelera</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Lo que se borró en los últimos {days} días. Restaurar lo devuelve tal
          como estaba, publicado incluido; después de {days} días se elimina
          solo.
        </p>
      </header>

      {notes ? (
        <div className="rounded-lg border border-amber-900/50 bg-amber-950/15 px-4 py-3">
          <p className="text-xs font-medium text-amber-300">
            «{notes.label}» volvió, pero no entero:
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {notes.notes.map((note) => (
              <li key={note} className="text-xs text-amber-300/80">
                {note}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-800 px-4 py-10 text-center text-sm text-neutral-500">
          La papelera está vacía.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-900 rounded-lg border border-neutral-900">
          {entries.map((entry) => {
            const left = daysLeft(entry.expiresAt, now);
            return (
              <li key={entry.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <span className="w-20 shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500">
                  {entry.kindLabel}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-neutral-100" title={entry.label}>
                    {entry.label}
                  </p>
                  <p className="text-[11px] text-neutral-600">
                    Borrado el {date(entry.deletedAt)}
                    {entry.deletedBy ? ` por ${entry.deletedBy}` : ""} · {size(entry.sizeBytes)}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-[11px] tabular-nums ${left <= 3 ? "text-amber-500" : "text-neutral-500"}`}
                >
                  {left === 0 ? "Se elimina hoy" : `${left} ${left === 1 ? "día" : "días"}`}
                </span>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    className={button}
                    disabled={busy !== null}
                    onClick={() => run(entry, actions.restoreItem)}
                  >
                    {busy === entry.id ? "…" : "Restaurar"}
                  </button>
                  <button
                    type="button"
                    className={`${button} hover:border-red-900 hover:text-red-400`}
                    disabled={busy !== null}
                    onClick={() => {
                      if (!confirm(`¿Eliminar «${entry.label}» para siempre? Esto sí no se puede deshacer.`)) return;
                      run(entry, actions.destroyItem);
                    }}
                  >
                    Eliminar ya
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Toast result={result} onDismiss={() => setResult(null)} />
    </div>
  );
}
