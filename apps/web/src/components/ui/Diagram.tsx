import type { Diagram as DiagramData } from "@nassican/shared";

/**
 * A layered diagram: rows of boxes, an arrow between each row and the next.
 *
 * Drawn in HTML and not in SVG so it wraps — on a phone a row of three boxes
 * becomes two lines instead of a figure to scroll sideways — and so the words
 * in it are real text: selectable, translatable, and read in order as a list of
 * lists. The arrows are decoration; what they say, when they say something, is
 * a label a screen reader meets between the two layers.
 *
 * Server-rendered. A figure that never changes has no reason to ship a script.
 */
export default function Diagram({ diagram }: { diagram: DiagramData }) {
  return (
    <figure className="flex flex-col gap-3">
      <div className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-6 sm:px-8 dark:border-white/10 dark:bg-white/[0.03]">
        <ol className="flex flex-col items-center">
          {diagram.tiers.map((tier, i) => (
            <li key={i} className="flex w-full flex-col items-center">
              {i > 0 ? <Arrow label={tier.link} /> : null}
              <ul className="flex w-full flex-wrap justify-center gap-3">
                {tier.nodes.map((node, j) => (
                  <li
                    key={j}
                    className="min-w-[8.5rem] max-w-[17rem] flex-1 rounded-xl border border-black/15 bg-white px-4 py-3 text-center shadow-sm dark:border-white/15 dark:bg-zinc-900"
                  >
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{node.title}</p>
                    {node.details.map((detail, k) => (
                      <p
                        key={k}
                        className="mt-0.5 break-words font-mono text-[11px] leading-snug text-zinc-600 dark:text-zinc-400"
                      >
                        {detail}
                      </p>
                    ))}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
      {diagram.caption ? (
        <figcaption className="max-w-[68ch] text-sm text-zinc-500 dark:text-zinc-400">{diagram.caption}</figcaption>
      ) : null}
    </figure>
  );
}

function Arrow({ label }: { label: string | null }) {
  return (
    // The label hangs off the arrow rather than sitting beside it in the flow,
    // so the arrow stays on the centre line whether or not it is named.
    <div className="relative flex justify-center py-1.5">
      <svg
        width="12"
        height="30"
        viewBox="0 0 12 30"
        aria-hidden
        className="text-zinc-400 dark:text-zinc-500"
      >
        <path
          d="M6 0v27M1.5 22.5 6 27l4.5-4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label ? (
        <span className="absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap text-[11px] text-zinc-600 dark:text-zinc-400">
          {label}
        </span>
      ) : null}
    </div>
  );
}
