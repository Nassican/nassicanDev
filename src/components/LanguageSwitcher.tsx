"use client";
import { usePathname } from "next/navigation";
import {
  localeNames,
  localePath,
  locales,
  stripLocale,
  type Locale,
} from "@/lib/i18n/config";

/**
 * Links to the same page in the other language. The current pathname already
 * carries the visible prefix (`/en/...` or none at all), so stripping it gives
 * the canonical path that every locale can be rebuilt from.
 *
 * Plain `<a>` rather than `<Link>` on purpose. Changing the locale changes the
 * `[locale]` param of the root layout, which makes React remount `<html>` and
 * drop the `dark` class the pre-paint script put there — the theme would reset
 * on every language change. A full document load re-runs that script, and it
 * is also the honest thing to do when the whole document's `lang` changes.
 */
export default function LanguageSwitcher({
  locale,
  label,
  className = "",
}: {
  locale: Locale;
  /** `language.switchTo` from the dictionary, for the accessible name. */
  label: string;
  className?: string;
}) {
  const pathname = usePathname();
  // Hash fragments never reach the server, so only the path is preserved.
  const canonicalPath = stripLocale(pathname ?? "/");

  return (
    <div
      className={`inline-flex items-center rounded-full border border-black/10 p-0.5 text-[11px] font-semibold dark:border-white/10 ${className}`}
    >
      {locales.map((l) => {
        const active = l === locale;
        return (
          <a
            key={l}
            href={localePath(l, canonicalPath)}
            hrefLang={l}
            aria-current={active ? "true" : undefined}
            aria-label={active ? undefined : `${label} ${localeNames[l]}`}
            className={`rounded-full px-2.5 py-1 uppercase tracking-wide transition-colors ${
              active
                ? "bg-black/5 text-black dark:bg-white/10 dark:text-white"
                : "text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            {l}
          </a>
        );
      })}
    </div>
  );
}
