"use client";

/**
 * The panel's half of the theme contract.
 *
 * The pure parts live in `@nassican/shared`; what is here is everything that
 * touches the DOM, because that package has no `dom` lib — `packages/db`
 * imports it and that code is `server-only`.
 *
 * Deliberately simpler than the site's version: the panel has no `[locale]`
 * segment, so `<html>` is never remounted and there is no full-reload rule to
 * respect. One toggle, one listener, no cross-component event.
 */
import {
  COOKIE_MAX_AGE,
  DEFAULT_THEME,
  THEME_COOKIE,
  type Theme,
} from "@nassican/shared";

export { DEFAULT_THEME, THEME_COOKIE, themeInitScript, type Theme } from "@nassican/shared";

/**
 * The class on `<html>` is the source of truth once the page is running — it is
 * what the CSS reacts to, so reading the cookie back could disagree with what
 * is on screen.
 */
export function readTheme(): Theme {
  if (typeof document === "undefined") return DEFAULT_THEME;
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

/**
 * A cookie rather than `localStorage`, so the value is readable by the inline
 * script on the very first byte of the next document — which is what prevents
 * the flash of the wrong theme.
 */
export function writeTheme(theme: Theme): void {
  document.cookie = `${THEME_COOKIE}=${theme};path=/;max-age=${COOKIE_MAX_AGE};samesite=lax`;
}
