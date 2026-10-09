import Image from "next/image";
import CopyButton from "@/components/ui/CopyButton";
import Diagram from "@/components/ui/Diagram";
import { DIAGRAM_LANGUAGE, parseDiagram, tableOfContents, type ContentBlock } from "@/lib/data";

const text = "max-w-[68ch] text-[1.0625rem] leading-[1.75] text-zinc-700 dark:text-zinc-300";

/**
 * Renders a typed content body. Blog posts and project case studies share
 * this component, so an article and a case study read the same way.
 *
 * `copy` is the wording of the button on code blocks. It is passed in because
 * this component receives no dictionary, and without it the button is simply
 * not drawn — a page that has no words for it has no button.
 */
export default function Prose({
  blocks,
  copy,
}: {
  blocks: ContentBlock[];
  copy?: { label: string; done: string };
}) {
  /*
   * Ids come from the same function the table of contents uses, and in the same
   * pass, so a repeated heading gets the same suffix in both. Calling
   * `headingId` per block here instead would make the list point at anchors the
   * document never rendered.
   */
  const anchors = tableOfContents(blocks);
  let heading = 0;
  if (!blocks.length) return null;

  return (
    <div className="flex flex-col gap-6">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "heading": {
            const id = anchors[heading++]?.id;
            const Tag = block.level === 3 ? "h3" : "h2";
            return (
              <Tag
                key={i}
                id={id}
                className={`scroll-mt-28 font-semibold tracking-tight ${
                  block.level === 3 ? "pt-1 text-xl" : "mt-6 text-2xl sm:text-[1.75rem] sm:leading-tight"
                }`}
              >
                {/*
                  The heading is its own link, so a section can be shared by
                  clicking its title. The mark that says so appears on hover and
                  on keyboard focus, and is decoration: the link's name is the
                  heading's text.
                */}
                <a href={`#${id}`} className="group/anchor">
                  {block.text}
                  <span
                    aria-hidden
                    className="ml-2 font-normal text-zinc-400 opacity-0 transition-opacity group-hover/anchor:opacity-100 group-focus-visible/anchor:opacity-100 dark:text-zinc-500"
                  >
                    #
                  </span>
                </a>
              </Tag>
            );
          }

          case "paragraph":
            return (
              <p key={i} className={text}>
                {block.text}
              </p>
            );

          case "list": {
            const List = block.ordered ? "ol" : "ul";
            return (
              <List
                key={i}
                className={`space-y-2.5 pl-5 marker:text-zinc-400 dark:marker:text-zinc-500 ${text} ${
                  block.ordered ? "list-decimal" : "list-disc"
                }`}
              >
                {block.items.map((item, j) => (
                  <li key={j} className="pl-1.5">
                    {item}
                  </li>
                ))}
              </List>
            );
          }

          case "code": {
            /*
             * A `diagram` block is drawn; one that cannot be read stays the
             * code block it was, so a typo shows its text instead of a hole.
             */
            const diagram = block.language === DIAGRAM_LANGUAGE ? parseDiagram(block.code) : null;
            if (diagram) return <Diagram key={i} diagram={diagram} />;

            // «text» says nothing a reader needs; a real language does.
            const language = block.language && block.language !== "text" ? block.language : "";
            return (
              <div
                key={i}
                className="overflow-hidden rounded-2xl border border-black/10 bg-zinc-50 dark:border-white/10 dark:bg-white/[0.03]"
              >
                {language || copy ? (
                  <div className="flex min-h-9 items-center justify-between gap-3 border-b border-black/10 px-4 dark:border-white/10">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                      {language}
                    </span>
                    {copy ? (
                      <CopyButton
                        text={block.code}
                        label={copy.label}
                        done={copy.done}
                        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-zinc-600 transition-colors hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100"
                      />
                    ) : null}
                  </div>
                ) : null}
                <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed">
                  <code className="font-mono text-zinc-800 dark:text-zinc-200">{block.code}</code>
                </pre>
              </div>
            );
          }

          case "quote":
            return (
              <blockquote
                key={i}
                className={`rounded-r-xl border-l-2 border-zinc-900 bg-black/[0.03] py-3 pl-5 pr-4 dark:border-zinc-100 dark:bg-white/[0.04] ${text}`}
              >
                {block.text}
              </blockquote>
            );

          case "image":
            return (
              <figure key={i} className="flex flex-col gap-2">
                <Image
                  src={block.url}
                  alt={block.alt}
                  width={block.width ?? 1600}
                  height={block.height ?? 900}
                  sizes="(min-width: 768px) 768px, 100vw"
                  className="h-auto w-full rounded-2xl border border-black/10 dark:border-white/10"
                />
                {block.caption ? (
                  <figcaption className="max-w-[68ch] text-sm text-zinc-500 dark:text-zinc-400">
                    {block.caption}
                  </figcaption>
                ) : null}
              </figure>
            );
        }
      })}
    </div>
  );
}
