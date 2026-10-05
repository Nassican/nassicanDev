"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { BsCupHot, BsStopwatch } from "react-icons/bs";
import { useClock, useFocusState } from "@/lib/focus-clock";
import { focusPhase, formatClock, type FocusNow } from "@/lib/focus-draft";

/** Matches the prefix this chip puts on the tab title, so it can take it off. */
const TITLE_PREFIX = /^(?:● \d+:\d\d|⏸ \d+:\d\d|✓ Tiempo) · /;

/**
 * The running block, in the header of every screen.
 *
 * A timer you only see on its own page is a timer you forget, and the point of
 * a fixed break is to take it when it comes. So the clock follows you: here,
 * and in the tab title, where it is visible from another tab. When the time is
 * up the browser says so — if notifications were allowed on «Enfoque».
 *
 * It asks the server once, when the panel first loads, and after that listens
 * to what the module announces. The shell never remounts on navigation, so
 * that one read lasts the whole session.
 */
export default function FocusChip({ load, hidden }: { load: () => Promise<FocusNow>; hidden: boolean }) {
  const state = useFocusState(null, load);
  const now = useClock();
  const phase = state && now > 0 ? focusPhase(state.running, state.last, now) : { kind: "idle" as const };

  const label =
    phase.kind === "work"
      ? `● ${formatClock(phase.remainingMs)}`
      : phase.kind === "break"
        ? `⏸ ${formatClock(phase.remainingMs)}`
        : phase.kind === "over"
          ? "✓ Tiempo"
          : null;

  useEffect(() => {
    const base = document.title.replace(TITLE_PREFIX, "");
    document.title = label ? `${label} · ${base}` : base;
  }, [label]);

  // Says so once per change of phase, not once per second.
  const announced = useRef<string | null>(null);
  const key = phase.kind === "idle" ? null : `${phase.kind}:${phase.block.id}`;
  useEffect(() => {
    const previous = announced.current;
    announced.current = key;
    if (previous === null || previous === key || typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;

    if (key?.startsWith("over:")) {
      new Notification("Bloque terminado", { body: "Anota dónde lo dejaste y descansa.", tag: "nassican-focus" });
    } else if (previous.startsWith("break:") && key === null) {
      new Notification("Descanso terminado", { body: "Puedes empezar otro bloque.", tag: "nassican-focus" });
    }
  }, [key]);

  if (hidden || phase.kind === "idle") return null;

  const tone =
    phase.kind === "over"
      ? "border-amber-700 text-amber-400"
      : phase.kind === "break"
        ? "border-green-800 text-green-400"
        : "border-neutral-700 text-neutral-200";

  return (
    <Link
      href="/enfoque"
      title={phase.kind === "break" ? "Descanso" : phase.block.label}
      className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 font-mono text-xs tabular-nums transition-colors hover:border-neutral-500 ${tone}`}
    >
      {phase.kind === "break" ? (
        <BsCupHot className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <BsStopwatch className="h-3.5 w-3.5" aria-hidden />
      )}
      {phase.kind === "work" || phase.kind === "break" ? formatClock(phase.remainingMs) : "Tiempo"}
      <span className="sr-only">
        {phase.kind === "break" ? " de descanso" : phase.kind === "over" ? ": bloque terminado" : ` en «${phase.block.label}»`}
      </span>
    </Link>
  );
}
