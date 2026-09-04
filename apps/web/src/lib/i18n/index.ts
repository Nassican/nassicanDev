import { es, type Dictionary } from "./dictionaries/es";
import { en } from "./dictionaries/en";
import type { Locale } from "./config";

const dictionaries: Record<Locale, Dictionary> = { es, en };

/**
 * Every dictionary is a plain object bundled at build time, so this is
 * synchronous and safe to call from server and client components alike.
 */
export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export type { Dictionary };
export * from "./config";
