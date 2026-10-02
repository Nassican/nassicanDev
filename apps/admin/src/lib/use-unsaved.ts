"use client";

import { useEffect } from "react";

/**
 * Warns before a tab with unsaved edits is closed.
 *
 * `beforeunload` is the only thing a browser honours here, and it covers what
 * actually loses work: closing the tab, reloading, typing another address. It
 * deliberately cannot show a custom message — every browser replaced that with
 * its own wording years ago, because sites used it to lie.
 *
 * It does **not** cover in-app navigation. Next's App Router has no documented
 * way to block a client-side route change, and the workarounds all involve
 * patching the router. Clicking «Blogs» with unsaved changes still loses them,
 * and saying so here is better than implying a guarantee this does not give.
 */
export function useUnsavedChanges(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;

    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Required by older browsers; the string itself is never shown.
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}

/**
 * Whether a draft differs from what was loaded.
 *
 * Compared as canonical JSON rather than by reference: the editors rebuild
 * their state object on every keystroke, so reference equality would call a
 * freshly opened form dirty and train the operator to dismiss the warning.
 */
export function isDirty<T>(initial: T, current: T): boolean {
  return canonical(initial) !== canonical(current);
}

function canonical(value: unknown): string {
  return JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
            a.localeCompare(b),
          ),
        )
      : v,
  );
}
