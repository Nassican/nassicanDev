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
 * Server-rendered and plain `<a>`: no scroll spy, no observer, no state. The
 * list that follows the reader is `ReadingTimeline`; on a wide screen that one
 * is always in the margin, so this box steps aside there (`xl:hidden`) rather
 * than say the same thing twice.
 *
 * Sections are numbered and subsections are not: the number is how you say
 * «part three», and a subsection is found under its section, not counted.
 */
export default function TableOfContents({
  entries,
  label,
}: {
  entries: TocEntry[];
  label: string;
}) {
  if (entries.length < 2) return null;

  // The number of the section an entry is, counting only sections up to it.
  const sectionNumber = (index: number) => entries.slice(0, index + 1).filter((e) => e.level !== 3).length;

  return (
    <nav
      aria-label={label}
      className="mb-10 rounded-2xl border border-black/10 bg-black/[0.02] p-5 xl:hidden dark:border-white/10 dark:bg-white/[0.02]"
    >
      <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
        {label}
      </h2>
      <ol className="flex flex-col gap-1.5">
        {entries.map((entry, index) => {
          const sub = entry.level === 3;
          return (
            <li key={entry.id} className={`flex gap-2 ${sub ? "pl-7 text-[13px]" : "text-sm"}`}>
              {sub ? null : (
                <span aria-hidden className="w-5 shrink-0 font-mono text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                  {String(sectionNumber(index)).padStart(2, "0")}
                </span>
              )}
              <a
                href={`#${entry.id}`}
                className={`underline-offset-4 transition-colors hover:text-zinc-900 hover:underline dark:hover:text-zinc-100 ${
                  sub ? "text-zinc-600 dark:text-zinc-400" : "text-zinc-800 dark:text-zinc-200"
                }`}
              >
                {entry.text}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
