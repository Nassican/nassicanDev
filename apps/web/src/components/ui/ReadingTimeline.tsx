"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BsChevronDown } from "react-icons/bs";
import type { TocEntry } from "@/lib/data";

/**
 * Where you are in an article: its sections as a timeline that follows the
 * scroll, and how much of it is behind you.
 *
 * `TableOfContents` is the list you pass once at the top; this is the one that
 * stays. On a wide screen it sits in the margin beside the text. Below that
 * there is no margin, so it is a bar under the header naming the current
 * section, which opens into the same list.
 *
 * A client component on every article, which the first table of contents
 * declined to be. What changed is the articles: seventeen sections is too long
 * to hold in your head from one look at the top.
 */

/** Below the fixed header, and just past where an anchor jump lands (`scroll-mt-28`). */
const OFFSET = 128;

const ROOT = "[data-reading-root]";

/** One listener per frame, shared by everything that reads the scroll position. */
function subscribe(notify: () => void) {
  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      notify();
    });
  };
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
  };
}

/** The last heading that has crossed the line under the header; -1 above the first. */
function readActive(ids: string[]): number {
  const root = document.querySelector(ROOT);
  // At the very end the last sections may be too short to ever reach the line.
  if (root && root.getBoundingClientRect().bottom <= window.innerHeight + 2) return ids.length - 1;

  let active = -1;
  for (let i = 0; i < ids.length; i++) {
    const heading = document.getElementById(ids[i]);
    if (!heading || heading.getBoundingClientRect().top > OFFSET) break;
    active = i;
  }
  return active;
}

/** 0 when the article starts under the header, 100 when its end reaches the bottom of the window. */
function readPercent(): number {
  const root = document.querySelector(ROOT);
  if (!root) return 0;
  const rect = root.getBoundingClientRect();
  const distance = rect.height - (window.innerHeight - OFFSET);
  if (distance <= 0) return rect.top <= OFFSET ? 100 : 0;
  return Math.round(Math.min(1, Math.max(0, (OFFSET - rect.top) / distance)) * 100);
}

/** True once the whole article has scrolled above the header. */
function readGone(): boolean {
  const root = document.querySelector(ROOT);
  return !!root && root.getBoundingClientRect().bottom <= OFFSET;
}

export default function ReadingTimeline({
  entries,
  label,
  progressLabel,
}: {
  entries: TocEntry[];
  label: string;
  progressLabel: string;
}) {
  const ids = entries.map((entry) => entry.id);
  // Numbers and a boolean, so a scroll that changes none of them renders nothing.
  const active = useSyncExternalStore(subscribe, () => readActive(ids), () => -1);
  const percent = useSyncExternalStore(subscribe, readPercent, () => 0);
  const gone = useSyncExternalStore(subscribe, readGone, () => false);

  const [expanded, setExpanded] = useState(false);
  const rail = useRef<HTMLOListElement>(null);
  const sheet = useRef<HTMLOListElement>(null);

  /*
   * Keeps the current section in sight when the list is taller than the window.
   * Moved by `scrollTop` and not `scrollIntoView`, which may also scroll the
   * page — and here the page is exactly what the reader is scrolling.
   */
  useEffect(() => {
    const list = rail.current;
    const item = list?.children[active] as HTMLElement | undefined;
    if (!list || !item) return;
    // The list is the items' offset parent, so `offsetTop` is already relative to it.
    const top = item.offsetTop;
    // Kept this far from either end: the ends fade out, and the section after
    // the current one is the next thing a reader looks for.
    const margin = 48;
    if (top - margin < list.scrollTop) list.scrollTop = Math.max(0, top - margin);
    else if (top + item.offsetHeight + margin > list.scrollTop + list.clientHeight) {
      list.scrollTop = top + item.offsetHeight + margin - list.clientHeight;
    }
  }, [active]);

  // The bar belongs to the article: not before its first section, not after its end.
  const barVisible = active >= 0 && !gone;
  const open = expanded && barVisible;

  // Opened in the second half of an article, the list starts on where you are.
  useEffect(() => {
    const list = sheet.current;
    const item = list?.children[active] as HTMLElement | undefined;
    if (open && list && item) list.scrollTop = Math.max(0, item.offsetTop - list.clientHeight / 2);
  }, [open, active]);

  if (entries.length < 2) return null;

  /*
   * The line is drawn per item, in two halves that meet at the item's dot: the
   * half above it and the half below. That is what lets the filled part end
   * exactly on the current dot instead of at the edge of a row, and what keeps
   * the line from sticking out above the first dot or below the last — neither
   * has that half. Every dot sits 15px down, the middle of a first line of text
   * (6px of padding and half of an 18px line), so a title that wraps keeps its
   * dot beside its first line.
   */
  const fill = "bg-zinc-900 dark:bg-zinc-100";
  // What is read is a solid 2px line and what is left a faint 1px one, both
  // centred on the same axis as the dots (6px in).
  const done = `left-[5px] w-0.5 ${fill}`;
  const ahead = "left-[5.5px] w-px bg-black/20 dark:bg-white/20";
  const items = (onPick?: () => void) =>
    entries.map((entry, i) => {
      const current = i === active;
      const past = i < active;
      const sub = entry.level === 3;
      return (
        // A subsection's text sits further in; its dot stays on the line, smaller.
        <li key={entry.id} className={`relative ${sub ? "pl-10" : "pl-6"}`}>
          {i > 0 ? (
            <span
              aria-hidden
              className={`absolute top-0 h-[15px] transition-all duration-300 ${past || current ? done : ahead}`}
            />
          ) : null}
          {i < entries.length - 1 ? (
            <span
              aria-hidden
              className={`absolute bottom-0 top-[15px] transition-all duration-300 ${past ? done : ahead}`}
            />
          ) : null}
          {/*
            The state is in the dot's shape as well as its colour: filled,
            filled with a halo, hollow. Read dots sit on the line like beads on
            a string, with no gap: a gap around every one chopped the line into
            dashes. Only the current dot clears a little space around itself, so
            the line stops at its halo instead of running through it.
          */}
          <span
            aria-hidden
            className={`absolute left-[6px] top-[15px] -translate-x-1/2 -translate-y-1/2 rounded-full outline-1 outline-offset-[3px] transition-all duration-300 ${
              current
                ? `h-3 w-3 outline-zinc-900/45 ring-[3px] ring-[var(--background)] dark:outline-zinc-100/55 ${fill}`
                : `outline-transparent ${sub ? "h-1.5 w-1.5" : "h-2.5 w-2.5"} ${
                    past ? fill : "border-[1.5px] border-zinc-500 bg-[var(--background)]"
                  }`
            }`}
          />
          <a
            href={`#${entry.id}`}
            aria-current={current ? "location" : undefined}
            onClick={onPick}
            className={`block py-1.5 leading-[18px] transition-colors duration-300 ${sub ? "text-xs" : "text-[13px]"} ${
              current
                ? "font-semibold text-zinc-900 dark:text-zinc-100"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            {entry.text}
          </a>
        </li>
      );
    });

  const bar = (
    <div
      role="progressbar"
      aria-label={progressLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="h-0.5 overflow-hidden bg-black/10 dark:bg-white/10"
    >
      <div className="h-full bg-zinc-900 dark:bg-zinc-100" style={{ width: `${percent}%` }} />
    </div>
  );

  return (
    <>
      {/*
        Wide screens: in the right margin, beside the text, for the whole
        article. Right and not left, so the text keeps the edge the eye returns
        to at every line, and because that is where a reader expects it.
      */}
      <aside className="hidden xl:col-start-3 xl:row-start-1 xl:block">
        <nav aria-label={label} className="sticky top-28">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400">{label}</h2>
            <span aria-hidden className="font-mono text-[11px] tabular-nums text-zinc-600 dark:text-zinc-400">
              {percent} %
            </span>
          </div>
          <div className="overflow-hidden rounded-full">{bar}</div>
          {/*
            When the list is taller than the window it scrolls, and both ends
            fade out: a title cut in half by a hard edge looked like a
            rendering fault. The padding is the fade's own height, so the first
            and last items rest clear of it when the list is at either end.
          */}
          <ol ref={rail} className="relative max-h-[calc(100vh-12rem)] overflow-y-auto py-5 pl-1.5 pr-1 [mask-image:linear-gradient(to_bottom,transparent,black_1.25rem,black_calc(100%-1.25rem),transparent)] [scrollbar-width:none]"
          >
            {items()}
          </ol>
        </nav>
      </aside>

      {/*
        Everything narrower: a bar under the header. Opaque, and no backdrop
        blur: the open list sits over the article, and text showing through it
        made both unreadable — and a blur would be recomputed over the whole
        width on every scrolled frame.
      */}
      <div
        aria-hidden={!barVisible}
        className={`fixed inset-x-0 top-[60px] z-40 transition-opacity duration-200 xl:hidden ${
          barVisible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <nav
          aria-label={label}
          className="border-b border-black/10 bg-[var(--background)] shadow-sm dark:border-white/10"
        >
          {bar}
          <button
            type="button"
            aria-expanded={open}
            tabIndex={barVisible ? 0 : -1}
            onClick={() => setExpanded(!open)}
            className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-2 text-left"
          >
            <span className="sr-only">{label}: </span>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-zinc-600 dark:text-zinc-400">
              {String(Math.max(active, 0) + 1).padStart(2, "0")}/{String(entries.length).padStart(2, "0")}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {entries[Math.max(active, 0)].text}
            </span>
            <BsChevronDown
              aria-hidden
              className={`h-3.5 w-3.5 shrink-0 text-zinc-600 transition-transform dark:text-zinc-400 ${open ? "rotate-180" : ""}`}
            />
          </button>
          {open ? (
            <ol ref={sheet} className="relative mx-auto max-h-[55vh] max-w-3xl overflow-y-auto px-4 pb-3 pt-1">
              {items(() => setExpanded(false))}
            </ol>
          ) : null}
        </nav>
      </div>
    </>
  );
}
