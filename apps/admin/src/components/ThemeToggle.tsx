"use client";

import { useSyncExternalStore } from "react";
import { BsMoon, BsSun } from "react-icons/bs";
import { applyTheme, readTheme, writeTheme, type Theme } from "@/lib/theme";

/**
 * Reads the class on `<html>` instead of keeping its own copy.
 *
 * `useState` plus an effect would start from a guess and correct it after
 * hydration, which is a visible flicker on the one element whose whole job is
 * not to flicker. `useSyncExternalStore` reads the real thing on every render
 * and `getServerSnapshot` makes the server agree, so there is nothing to
 * correct.
 */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore<Theme>(
    subscribe,
    readTheme,
    // On the server the class is already set from the cookie, but this snapshot
    // cannot see it. Dark matches the default, and the attribute on `<html>` is
    // what actually paints — so a mismatch here never reaches the screen.
    () => "dark",
  );

  const next: Theme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      aria-label={next === "dark" ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
      title={next === "dark" ? "Modo oscuro" : "Modo claro"}
      onClick={() => {
        applyTheme(next);
        writeTheme(next);
      }}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-neutral-800 text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-200 ${className}`}
    >
      {theme === "dark" ? (
        <BsSun className="h-4 w-4" aria-hidden />
      ) : (
        <BsMoon className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}
