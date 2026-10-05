"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { fold } from "@/lib/list-filters";
import { navigation, type NavIcon } from "@/lib/navigation";

export type Command = {
  id: string;
  label: string;
  /** What it is, shown to the right: «Artículo», «Módulo»… */
  kind: string;
  href: string;
  icon?: NavIcon;
};

/** Prepared once per list, so a keystroke only compares. */
type Searchable = { command: Command; label: string; kind: string };

/** Opening without a keyboard — a phone has no ⌘K, and this is how it gets one. */
const OPEN_EVENT = "command-palette:open";

export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/**
 * Jump anywhere with the keyboard.
 *
 * For an operator who opens this every day, the menu is a mouse trip to a place
 * they already know the name of.
 *
 * **Modules are local and content is fetched.** The module list comes from the
 * same `navigation` data the sidebar renders — one list, so a new module appears
 * here the day it appears there — and it needs no round trip, which is what makes
 * ⌘K feel instant for the thing it is used for most. The content (drafts, pages,
 * projects) arrives from a server action the first time the palette opens, and
 * then stays for the rest of the tab.
 *
 * It used to come down with every page render instead, which cost 217 ms on
 * every page of the panel for a list most of those pages never showed.
 */
export default function CommandPalette({
  load,
  capture,
}: {
  load: () => Promise<Command[]>;
  /**
   * «+ pagar la luz mañana» files a task without leaving the page you are on.
   * Capturing has to cost two seconds or it does not happen, and the palette is
   * already one keystroke away from everywhere.
   */
  capture?: (raw: string) => Promise<{ ok: boolean; message: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const capturing = Boolean(capture) && query.trimStart().startsWith("+");
  const [active, setActive] = useState(0);
  const [content, setContent] = useState<Command[] | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const fetching = useRef(false);

  const modules = useMemo<Command[]>(
    () =>
      navigation
        .flatMap((section) => section.entries)
        .filter((entry) => entry.ready)
        .map((entry) => ({
          id: `nav:${entry.href}`,
          label: entry.label,
          kind: "Módulo",
          href: entry.href,
          icon: entry.icon,
        })),
    [],
  );

  /**
   * Folding allocates three strings per label, so it happens once per list
   * rather than once per label per keystroke.
   */
  const searchable = useMemo<Searchable[]>(
    () =>
      [...modules, ...(content ?? [])].map((command) => ({
        command,
        label: fold(command.label),
        kind: fold(command.kind),
      })),
    [modules, content],
  );

  const results = useMemo(() => {
    const needle = fold(query);
    if (!needle) return searchable.slice(0, 12).map((entry) => entry.command);

    // Something whose name starts with what you typed is almost always what you
    // meant, so it outranks a match buried in the middle.
    return searchable
      .map((entry) => {
        if (entry.label.startsWith(needle)) return { entry, rank: 0 };
        if (entry.label.includes(needle)) return { entry, rank: 1 };
        if (entry.kind.includes(needle)) return { entry, rank: 2 };
        return null;
      })
      .filter((hit): hit is { entry: Searchable; rank: number } => hit !== null)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 12)
      .map((hit) => hit.entry.command);
  }, [searchable, query]);

  // The index is clamped while rendering rather than reset in an effect: when
  // the list shrinks under you, an effect would render the empty slot once
  // before fixing it.
  const selected = Math.min(active, Math.max(0, results.length - 1));

  useEffect(() => {
    const toggle = () => {
      setOpen((value) => !value);
      setQuery("");
      setActive(0);

      // Fired from the handler, not from an effect watching `open`: the fetch
      // is a consequence of the keypress, and once per tab.
      if (!fetching.current) {
        fetching.current = true;
        load()
          .then(setContent)
          // A palette that still lists every module is worth keeping; retry
          // on the next open rather than reporting a failure nobody asked for.
          .catch(() => {
            fetching.current = false;
          });
      }
    };

    const onKey = (event: KeyboardEvent) => {
      const isToggle =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";

      if (isToggle) {
        event.preventDefault();
        toggle();
        return;
      }

      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, toggle);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, toggle);
    };
  }, [load]);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  if (!open) return null;

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  async function file() {
    if (!capture || saving || !query.replace(/^\s*\+/, "").trim()) return;
    setSaving(true);
    const outcome = await capture(query);
    setSaving(false);
    setNotice(outcome);
    // The palette stays open: capturing comes in bursts, three things at once.
    if (outcome.ok) {
      setQuery("");
      router.refresh();
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center p-4 pt-[12vh]">
      {/*
        Dimmed, not blurred. `backdrop-filter` turns this into a backdrop root:
        the browser has to snapshot everything painted beneath it, blur that
        snapshot and recomposite — over the whole viewport, on every frame where
        anything above it changes, which here is every keystroke. On a GPU that
        is a shader; with hardware acceleration off it is a CPU convolution over
        a few million pixels, and typing in the palette crawls. A flat
        translucent layer composites for free and says the same thing.
      */}
      <div
        aria-hidden
        className="absolute inset-0 bg-black/70"
        onClick={() => setOpen(false)}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ir a"
        className="relative w-full max-w-lg overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 shadow-lg"
      >
        <input
          ref={input}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setNotice(null);
          }}
          onKeyDown={(e) => {
            if (capturing) {
              if (e.key === "Enter") {
                e.preventDefault();
                void file();
              }
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, results.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            }
            if (e.key === "Enter" && results[selected]) {
              e.preventDefault();
              go(results[selected].href);
            }
          }}
          placeholder="Ir a un módulo, artículo o página… o «+» para apuntar"
          className="w-full border-b border-neutral-900 bg-transparent px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none"
        />

        {notice ? (
          <p
            role={notice.ok ? "status" : "alert"}
            className={`border-b border-neutral-900 px-4 py-2 text-xs ${notice.ok ? "text-green-400" : "text-red-400"}`}
          >
            {notice.message}
          </p>
        ) : null}

        {capturing ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => void file()}
            className="flex w-full flex-col gap-0.5 bg-neutral-900 px-4 py-3 text-left"
          >
            <span className="text-sm text-neutral-100">
              {saving ? "Apuntando…" : `Apuntar «${query.replace(/^\s*\+\s*/, "") || "…"}» en Pendientes`}
            </span>
            <span className="text-[11px] text-neutral-500">
              Termina en «hoy» o «mañana» para planificarlo de una vez.
            </span>
          </button>
        ) : results.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-neutral-500">
            {/*
              While the content is still in flight, «nada coincide» would be a
              lie that corrects itself a moment later.
            */}
            {content === null
              ? "Buscando en el contenido…"
              : `Nada coincide con «${query}».${capture ? " Escribe «+» delante para apuntarlo como pendiente." : ""}`}
          </p>
        ) : (
          <ul className="max-h-[50vh] overflow-y-auto py-1">
            {results.map((command, index) => (
              <li key={command.id}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onClick={() => go(command.href)}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm ${
                    index === selected
                      ? "bg-neutral-900 text-neutral-100"
                      : "text-neutral-400"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{command.label}</span>
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-neutral-600">
                    {command.kind}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="border-t border-neutral-900 px-4 py-2 font-mono text-[10px] text-neutral-600">
          ↑↓ moverse · ⏎ abrir{capture ? " · + apuntar un pendiente" : ""} · esc cerrar
        </p>
      </div>
    </div>
  );
}
