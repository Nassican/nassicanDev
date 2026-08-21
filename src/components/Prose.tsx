import { headingId, type ContentBlock } from "@/lib/data";

/**
 * Renders a typed content body. Blog posts and project case studies share
 * this component, so an article and a case study read the same way.
 */
export default function Prose({ blocks }: { blocks: ContentBlock[] }) {
  if (!blocks.length) return null;

  return (
    <div className="flex flex-col gap-6">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "heading":
            return (
              <h2
                key={i}
                id={headingId(block.text)}
                className="scroll-mt-28 pt-2 text-lg font-semibold tracking-tight"
              >
                {block.text}
              </h2>
            );

          case "paragraph":
            return (
              <p
                key={i}
                className="max-w-[68ch] leading-relaxed text-zinc-700 dark:text-zinc-300"
              >
                {block.text}
              </p>
            );

          case "list": {
            const List = block.ordered ? "ol" : "ul";
            return (
              <List
                key={i}
                className={`max-w-[68ch] space-y-2 pl-5 text-zinc-700 dark:text-zinc-300 ${
                  block.ordered ? "list-decimal" : "list-disc"
                }`}
              >
                {block.items.map((item, j) => (
                  <li key={j} className="leading-relaxed pl-1">
                    {item}
                  </li>
                ))}
              </List>
            );
          }

          case "code":
            return (
              <pre
                key={i}
                className="overflow-x-auto rounded-2xl border border-black/10 bg-zinc-50 p-4 text-[13px] leading-relaxed dark:border-white/10 dark:bg-white/[0.03]"
              >
                <code className="font-mono text-zinc-800 dark:text-zinc-200">
                  {block.code}
                </code>
              </pre>
            );

          case "quote":
            return (
              <blockquote
                key={i}
                className="max-w-[68ch] border-l-2 border-black/20 pl-4 text-zinc-600 italic dark:border-white/20 dark:text-zinc-400"
              >
                {block.text}
              </blockquote>
            );
        }
      })}
    </div>
  );
}
