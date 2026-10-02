"use client";

import { useEffect, useRef } from "react";
import { BsCheck2, BsExclamationTriangle, BsX } from "react-icons/bs";

export type ToastResult = { ok: boolean; message: string };

/** Long enough to read «Guardado», short enough not to sit there. */
const DISMISS_MS = 4000;

/**
 * The outcome of an action, shown without moving the page.
 *
 * It replaces a banner that was inserted above the form: every save pushed
 * everything down by one line and then pulled it back up, which in an editor
 * means the field you were looking at moves while you are looking at it.
 *
 * **A success disappears on its own; a failure does not.** A success says
 * something you already expected and need no longer think about. A failure says
 * the opposite of what you expected, names what to do about it, and is the one
 * message worth re-reading — taking that away on a timer is how it gets missed.
 *
 * No portal: `fixed` is relative to the nearest *transformed* ancestor, and the
 * chain from `<main>` down has none. The mobile drawer does animate with a
 * transform, but it is a sibling of the page content, not its parent.
 */
export default function Toast({
  result,
  onDismiss,
}: {
  result: ToastResult | null;
  onDismiss: () => void;
}) {
  /**
   * The countdown watches `result` and nothing else. `onDismiss` is a fresh
   * closure on every render, so depending on it restarted the timer on every
   * keystroke and «Guardado» never went away while you kept typing. A ref keeps
   * the call current without making it a dependency.
   */
  const dismiss = useRef(onDismiss);
  useEffect(() => {
    dismiss.current = onDismiss;
  });

  useEffect(() => {
    if (!result?.ok) return;
    const timer = setTimeout(() => dismiss.current(), DISMISS_MS);
    return () => clearTimeout(timer);
  }, [result]);

  if (!result) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex justify-center p-4 sm:justify-end">
      <div
        role={result.ok ? "status" : "alert"}
        aria-live={result.ok ? "polite" : "assertive"}
        className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-xl ${
          result.ok
            ? "border-green-900/60 bg-green-950 text-green-300"
            : "border-red-900/60 bg-red-950 text-red-200"
        }`}
      >
        {result.ok ? (
          <BsCheck2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        ) : (
          <BsExclamationTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        )}

        <p className="min-w-0 flex-1">{result.message}</p>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Cerrar aviso"
          className="-mr-1 -mt-0.5 shrink-0 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
        >
          <BsX className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
