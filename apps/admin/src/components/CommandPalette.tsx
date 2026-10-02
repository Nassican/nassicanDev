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

/**
 * Jump anywhere with the keyboard.
 *
 * For an operator who opens this every day, the menu is a mouse trip to a place
 * they already know the name of. Modules come from the same `navigation` data
 * the sidebar renders — one list, so a new module appears here the day it
 * appears there — and the content comes from the server, resolved once when the
 * shell renders.
 */
export default function CommandPalette({ content }: { content: Command[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(() => {
    const modules = navigation
      .flatMap((section) => section.entries)
      .filter((entry) => entry.ready)
      .map((entry) => ({
        id: `nav:${entry.href}`,
        label: entry.label,
        kind: "Módulo",
        href: entry.href,
        icon: entry.icon,
      }));

    return [...modules, ...content];
  }, [content]);

  const results = useMemo(() => {
    const needle = fold(query);
    if (!needle) return commands.slice(0, 12);

    // Something whose name starts with what you typed is almost always what you
    // meant, so it outranks a match buried in the middle.
    return commands
      .map((command) => {
        const label = fold(command.label);
        if (label.startsWith(needle)) return { command, rank: 0 };
        if (label.includes(needle)) return { command, rank: 1 };
        if (fold(command.kind).includes(needle)) return { command, rank: 2 };
        return null;
      })
      .filter((hit): hit is { command: Command; rank: number } => hit !== null)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 12)
      .map((hit) => hit.command);
  }, [commands, query]);

  // The index is clamped while rendering rather than reset in an effect: when
  // the list shrinks under you, an effect would render the empty slot once
  // before fixing it.
  const selected = Math.min(active, Math.max(0, results.length - 1));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const isToggle =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";

      if (isToggle) {
        event.preventDefault();
        setOpen((value) => !value);
        setQuery("");
        setActive(0);
        return;
      }

      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  if (!open) return null;

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center p-4 pt-[12vh]">
      <div
        aria-hidden
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ir a"
        className="relative w-full max-w-lg overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 shadow-2xl"
      >
        <input
          ref={input}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
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
          placeholder="Ir a un módulo, artículo, proyecto o página…"
          className="w-full border-b border-neutral-900 bg-transparent px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none"
        />

        {results.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-neutral-500">
            Nada coincide con «{query}».
          </p>
        ) : (
          <ul className="max-h-[50vh] overflow-y-auto py-1">
            {results.map((command, index) => (
              <li key={command.id}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onClick={() => go(command.href)}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${
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
          ↑↓ moverse · ⏎ abrir · esc cerrar
        </p>
      </div>
    </div>
  );
}
