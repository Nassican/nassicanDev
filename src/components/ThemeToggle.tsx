"use client";
import { useSyncExternalStore } from "react";
import {
  DEFAULT_THEME,
  applyTheme,
  emitThemeChange,
  readTheme,
  subscribeToTheme,
  writeTheme,
  type Theme,
} from "@/lib/theme";
import type { Dictionary } from "@/lib/i18n";

/**
 * The applied theme lives on `<html>`, outside React, because the inline
 * script in the layout has to set it before the first paint.
 * `useSyncExternalStore` is what reads that kind of state without a
 * setState-in-effect and without a hydration mismatch: it renders the server
 * snapshot while hydrating, then swaps to the real one.
 */
function useTheme(): Theme {
  return useSyncExternalStore(subscribeToTheme, readTheme, () => DEFAULT_THEME);
}

/** False during SSR and hydration, true afterwards. Gates the icon animation. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToTheme,
    () => true,
    () => false,
  );
}

export default function ThemeToggle({
  t,
  className = "",
}: {
  t: Dictionary;
  className?: string;
}) {
  const theme = useTheme();
  const hydrated = useHydrated();
  const isDark = theme === "dark";

  const toggle = () => {
    const next: Theme = isDark ? "light" : "dark";
    applyTheme(next);
    writeTheme(next);
    // Keeps the navbar and the mobile drawer toggles in sync.
    emitThemeChange();
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? t.theme.toLight : t.theme.toDark}
      title={isDark ? t.theme.light : t.theme.dark}
      aria-pressed={isDark}
      suppressHydrationWarning
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-zinc-600 transition-colors duration-200 hover:bg-black/5 hover:text-black dark:border-white/10 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white ${className}`}
    >
      {/* Icons swap with a rotate/scale transition; hidden until hydrated so the
          swap never plays on load for visitors whose stored theme is not the default */}
      <span
        className={`relative block h-5 w-5 transition-opacity duration-200 ${
          hydrated ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Sun */}
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className={`absolute inset-0 h-5 w-5 transition-all duration-300 ${
            isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
          }`}
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
        {/* Moon */}
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`absolute inset-0 h-5 w-5 transition-all duration-300 ${
            isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
          }`}
        >
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      </span>
    </button>
  );
}
