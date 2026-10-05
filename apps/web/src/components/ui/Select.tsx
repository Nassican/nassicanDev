"use client";

import { useEffect, useId, useRef, useState } from "react";
import { BsCheck2, BsChevronDown } from "react-icons/bs";

export type SelectOption = { value: string; label: string };

/**
 * A select whose open list is part of the site, not of the operating system.
 *
 * A native `<select>` can be styled closed and not open: the list is drawn by
 * the OS — a white Windows menu over a near-black page, in a font the site does
 * not use. This one draws its own list in the site's own surfaces.
 *
 * It keeps what the native one gave for free, because that is the part that is
 * easy to lose: the listbox pattern from the ARIA practices — arrows, Home/End,
 * Enter and Space, Escape back to the button, typing a letter to jump — and
 * `aria-activedescendant`, so a screen reader announces the option under the
 * cursor while focus stays on the list.
 */
export default function Select({
  value,
  options,
  onChange,
  label,
  className = "",
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** Accessible name; the visible text is the selected option. */
  label: string;
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const root = useRef<HTMLDivElement>(null);

  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const selected = options[selectedIndex];

  // Focus moves to the list when it opens, so the keys below reach it. A side
  // effect on the DOM, not on state, which is what an effect is for.
  useEffect(() => {
    if (open) list.current?.focus();
  }, [open]);

  // The option under the keyboard stays in view in a long list.
  useEffect(() => {
    if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, id]);

  // A click anywhere else closes it, as a native select does.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  function show() {
    setActive(selectedIndex);
    setOpen(true);
  }

  function choose(index: number) {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
    button.current?.focus();
  }

  function onListKey(event: React.KeyboardEvent) {
    const last = options.length - 1;
    const keys: Record<string, () => void> = {
      ArrowDown: () => setActive((i) => Math.min(last, i + 1)),
      ArrowUp: () => setActive((i) => Math.max(0, i - 1)),
      Home: () => setActive(0),
      End: () => setActive(last),
      Enter: () => choose(active),
      " ": () => choose(active),
      Escape: () => {
        setOpen(false);
        button.current?.focus();
      },
      Tab: () => setOpen(false),
    };

    if (keys[event.key]) {
      if (event.key !== "Tab") event.preventDefault();
      keys[event.key]();
      return;
    }

    // Type-ahead: a letter jumps to the next option starting with it.
    if (event.key.length === 1 && /\S/.test(event.key)) {
      const letter = event.key.toLocaleLowerCase();
      const order = [...options.slice(active + 1), ...options.slice(0, active + 1)];
      const match = order.find((o) => o.label.toLocaleLowerCase().startsWith(letter));
      if (match) setActive(options.indexOf(match));
    }
  }

  return (
    <div ref={root} className={`relative ${className}`}>
      <button
        ref={button}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-label={`${label}: ${selected?.label ?? ""}`}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            show();
          }
        }}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-full border border-black/10 bg-transparent pr-3 pl-4 text-left text-sm outline-none transition hover:border-black/20 focus-visible:border-black/40 dark:border-white/10 dark:hover:border-white/20 dark:focus-visible:border-white/40"
      >
        <span className="truncate">{selected?.label}</span>
        <BsChevronDown
          aria-hidden
          className={`h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform dark:text-zinc-400 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <ul
          ref={list}
          id={`${id}-list`}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={`${id}-${active}`}
          onKeyDown={onListKey}
          className="absolute right-0 left-0 z-30 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-black/10 bg-white p-1.5 shadow-lg outline-none dark:border-white/10 dark:bg-zinc-950"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <li
                key={option.value}
                id={`${id}-${index}`}
                role="option"
                aria-selected={isSelected}
                onPointerMove={() => setActive(index)}
                onClick={() => choose(index)}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm ${
                  index === active ? "bg-zinc-900/5 dark:bg-white/10" : ""
                } ${isSelected ? "font-medium text-zinc-900 dark:text-white" : "text-zinc-600 dark:text-zinc-300"}`}
              >
                <span className="truncate">{option.label}</span>
                {isSelected ? <BsCheck2 aria-hidden className="h-4 w-4 shrink-0" /> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
