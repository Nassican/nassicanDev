export type Theme = "dark" | "light";

/**
 * The *pure* half of the theme contract, shared by the public site and the
 * panel: a cookie name, a lifetime, and the script that runs before first
 * paint. Both applications need exactly these and neither owns them.
 *
 * The DOM half — reading the class, flipping it, writing the cookie — stays in
 * each app on purpose. This package has no `dom` lib because `packages/db`
 * imports it and that code is `server-only`; letting `document` compile there
 * would trade a real guarantee for five one-line helpers.
 *
 * The two apps do **not** share a cookie store: `nassican.com` and
 * `app.nassican.com` are different origins, so the same name holds a separate
 * choice in each. That is wanted — reading in the dark at night says nothing
 * about how you want to edit at noon.
 */

/** What is shown before anyone has chosen; the system preference is not consulted. */
export const DEFAULT_THEME: Theme = "dark";

export const THEME_COOKIE = "theme";

/** One year, so the choice survives well beyond a single session. */
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Runs in `<head>` before first paint, so the page never flashes the wrong
 * theme. Self-contained on purpose: it executes long before any bundle loads,
 * so it cannot import from this module.
 *
 * It also adopts the value the previous `localStorage`-based toggle left
 * behind, so returning visitors keep the theme they had chosen.
 *
 * The default arrives as an argument rather than being read here: the script is
 * a string assembled on the server, and the caller decides what it says.
 *
 * The `\\s` in that regex is a real escape inside a template literal: written as
 * `\s` it would compile to `s*` and the cookie would never match. There is a
 * test that pins the output, because the mistake is invisible by reading.
 */
export const themeInitScript = (fallback: Theme = DEFAULT_THEME) => `(function(){try{var m=document.cookie.match(/(?:^|;\\s*)${THEME_COOKIE}=(dark|light)/);var t=m&&m[1];if(!t){var l=localStorage.getItem("${THEME_COOKIE}");if(l==="dark"||l==="light"){t=l;document.cookie="${THEME_COOKIE}="+t+";path=/;max-age=${COOKIE_MAX_AGE};samesite=lax";}}if(!t){t="${fallback === "light" ? "light" : "dark"}";}document.documentElement.classList.toggle("dark",t==="dark");}catch(e){document.documentElement.classList.add("dark");}})();`;
