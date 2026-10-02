/**
 * The site's half of the theme contract.
 *
 * The pure parts — cookie name, lifetime, and the inline script — moved to
 * `@nassican/shared` when the panel grew a light mode, because two copies of a
 * cookie contract is two contracts drifting apart. They are re-exported here so
 * every import inside `apps/web` keeps working untouched, the same arrangement
 * `lib/i18n/config.ts` and `lib/data/content.ts` already use.
 *
 * What stays is everything that touches the DOM: `packages/shared` has no `dom`
 * lib because `packages/db` imports it and that code is `server-only`.
 *
 * The move was verified the way the `robots.txt` change was — the generated
 * script came out byte-identical for both fallbacks and for no argument at all.
 */
import { DEFAULT_THEME, THEME_COOKIE, COOKIE_MAX_AGE, type Theme } from "@nassican/shared";

export { DEFAULT_THEME, THEME_COOKIE, themeInitScript, type Theme } from "@nassican/shared";

/**
 * Event both `ThemeToggle` instances (navbar and mobile drawer) listen to, so
 * flipping one updates the other without a shared React context.
 */
const THEME_EVENT = "nassican:themechange";

/**
 * The applied theme is read back off `<html>` rather than from the cookie: the
 * class is what the rest of the CSS reacts to, so it is the real source of
 * truth once the page is running.
 */
export function readTheme(): Theme {
  if (typeof document === "undefined") return DEFAULT_THEME;
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

/**
 * Stored in a cookie rather than `localStorage` so the value is available to
 * the inline script on every document load, including the full reload the
 * language switcher performs.
 */
export function writeTheme(theme: Theme) {
  document.cookie = `${THEME_COOKIE}=${theme};path=/;max-age=${COOKIE_MAX_AGE};samesite=lax`;
}

export function emitThemeChange() {
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function subscribeToTheme(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  return () => window.removeEventListener(THEME_EVENT, onChange);
}
