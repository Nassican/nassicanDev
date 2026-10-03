import type { TocEntry } from "@/lib/data";

/**
 * The headings of an article, linked.
 *
 * The anchors were already there — `Prose` has been giving every heading an id
 * since it was written — and nothing pointed at them. This is the cheapest thing
 * on the whole list: the work was done and only the list was missing.
 *
 * **Hidden below two headings.** One is not a table of contents, it is a
 * repetition of the first line of the article; two is the smallest number where
 * knowing what is coming changes whether you keep reading.
 *
 * Server-rendered and plain `<a>`: no scroll spy, no observer, no state. A
 * highlight that follows the reader is nice and is also a client component on
 * every article page, and this earns its place without one.
 */
export default function TableOfContents({
  entries,
  label,
}: {
  entries: TocEntry[];
  label: string;
}) {
  if (entries.length < 2) return null;

  return (
    <nav
      aria-label={label}
      className="mb-8 rounded-lg border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.02]"
    >
      <h2 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
        {label}
      </h2>
      <ol className="flex flex-col gap-1.5">
        {entries.map((entry, i) => (
          <li key={entry.id} className="flex gap-2 text-sm">
            <span
              aria-hidden
              className="shrink-0 font-mono text-xs text-zinc-400 dark:text-zinc-600"
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <a
              href={`#${entry.id}`}
              className="text-zinc-600 underline-offset-4 transition-colors hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
