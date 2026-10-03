import "server-only";

import { looksLikeSvg, prepareIconSvg } from "@nassican/shared";

/**
 * Devicon, used as a source at authoring time and never at render time.
 *
 * 578 technologies, 559 of them with an `original` variant that is the real
 * multi-colour brand logo and 388 with a monochrome `plain`. That is the whole
 * reason for choosing it over Simple Icons: Simple Icons gives one brand colour
 * per logo, which is exactly the problem — devicon's own manifest says Vite is
 * `#ffdd35`, and tinting the whole mark yellow is what made it look wrong.
 *
 * **Nothing here runs when a visitor loads a page.** The panel fetches once, the
 * prepared markup goes into the row, and the public site inlines what it stored.
 * Same principle as the images living in Postgres: the site does not depend on a
 * third party being up in order to draw itself.
 */

const MANIFEST = "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/devicon.json";
const ICONS = "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons";

/** Beyond this it is not a logo, it is a mistake. */
const MAX_BYTES = 120 * 1024;

export type DeviconEntry = {
  name: string;
  /** Alternative spellings and tags, which is how a search finds "vite.js". */
  aliases: string[];
  /** Which of `original` / `plain` / … exist as SVG. */
  variants: string[];
  /** Devicon's single brand colour. Useful as a default, not as the drawing. */
  color: string;
};

type RawEntry = {
  name: string;
  altnames?: string[];
  tags?: string[];
  aliases?: unknown[];
  versions?: { svg?: string[] };
  color?: string;
};

/**
 * The manifest, cached for a day.
 *
 * It is 578 entries and changes a few times a year, so a request per keystroke
 * would be absurd. `revalidate` rather than `force-cache` so a new technology
 * appearing upstream does not need a deploy.
 */
export async function deviconIndex(): Promise<DeviconEntry[]> {
  const response = await fetch(MANIFEST, { next: { revalidate: 86_400 } });
  if (!response.ok) return [];

  const raw: RawEntry[] = await response.json();

  return raw
    .map((entry) => ({
      name: entry.name,
      aliases: [...(entry.altnames ?? []), ...(entry.tags ?? [])],
      variants: entry.versions?.svg ?? [],
      color: entry.color ?? "#888888",
    }))
    .filter((entry) => entry.variants.length > 0);
}

/**
 * The prepared markup for one icon, ready to be stored.
 *
 * `key` is the technology's registry key and becomes the id prefix, which is the
 * step that stops two gradients colliding. Returns null rather than throwing: a
 * missing icon should leave the row as it was, not fail the save.
 */
export async function fetchDeviconSvg(
  deviconName: string,
  variant: string,
  key: string,
): Promise<string | null> {
  // Built from a manifest entry, never from free text, but the name still goes
  // into a URL — so anything that is not a plain slug is refused outright.
  if (!/^[a-z0-9.+-]+$/i.test(deviconName) || !/^[a-z-]+$/i.test(variant)) return null;

  const response = await fetch(`${ICONS}/${deviconName}/${deviconName}-${variant}.svg`, {
    next: { revalidate: 86_400 },
  });
  if (!response.ok) return null;

  const markup = await response.text();
  if (markup.length > MAX_BYTES || !looksLikeSvg(markup)) return null;

  const prepared = prepareIconSvg(markup, key);
  return looksLikeSvg(prepared) ? prepared : null;
}

/**
 * Icons whose name, alias or tag matches, best first.
 *
 * Exact name beats a prefix beats an alias, for the reason the command palette
 * ranks the same way: what you typed the start of is almost always what you
 * meant.
 */
export function searchDevicons(
  index: DeviconEntry[],
  query: string,
  limit = 24,
): DeviconEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return index.slice(0, limit);

  return index
    .map((entry) => {
      const name = entry.name.toLowerCase();
      if (name === needle) return { entry, rank: 0 };
      if (name.startsWith(needle)) return { entry, rank: 1 };
      if (name.includes(needle)) return { entry, rank: 2 };
      if (entry.aliases.some((a) => a.toLowerCase().includes(needle))) {
        return { entry, rank: 3 };
      }
      return null;
    })
    .filter((hit): hit is { entry: DeviconEntry; rank: number } => hit !== null)
    .sort((a, b) => a.rank - b.rank || a.entry.name.localeCompare(b.entry.name))
    .slice(0, limit)
    .map((hit) => hit.entry);
}

/**
 * The devicon a technology key probably means.
 *
 * Only a suggestion for the picker's first search — `Next.js` is `nextjs`,
 * `Tailwind CSS` is `tailwindcss` — and wrong often enough that it never saves
 * anything on its own.
 */
export function guessDeviconName(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}
