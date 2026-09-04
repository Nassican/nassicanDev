export type Theme = "dark" | "light";

/** Dark unless the visitor has explicitly chosen otherwise. */
export const DEFAULT_THEME: Theme = "dark";

export const THEME_COOKIE = "theme";

/** One year, so the choice survives well beyond a single session. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

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

/**
 * Runs in `<head>` before first paint, so the page never flashes the wrong
 * theme. Self-contained on purpose: it executes long before any bundle loads,
 * so it cannot import from this module.
 *
 * It also adopts the value the previous `localStorage`-based toggle left
 * behind, so returning visitors keep the theme they had chosen.
 */
export const themeInitScript = `(function(){try{var m=document.cookie.match(/(?:^|;\\s*)${THEME_COOKIE}=(dark|light)/);var t=m&&m[1];if(!t){var l=localStorage.getItem("${THEME_COOKIE}");if(l==="dark"||l==="light"){t=l;document.cookie="${THEME_COOKIE}="+t+";path=/;max-age=${COOKIE_MAX_AGE};samesite=lax";}}if(!t){t="${DEFAULT_THEME}";}document.documentElement.classList.toggle("dark",t==="dark");}catch(e){document.documentElement.classList.add("dark");}})();`;
