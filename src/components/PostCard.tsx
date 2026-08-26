import Link from "next/link";
import { BsArrowRight } from "react-icons/bs";
import Card from "@/components/ui/Card";
import { readingMinutes, type Post } from "@/lib/data";
import { formatDate } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";
import { localePath, type Locale } from "@/lib/i18n/config";

/** Shared between the homepage teaser and `/blog`. */
export default function PostCard({
  post,
  locale,
  t,
}: {
  post: Post;
  locale: Locale;
  t: Dictionary;
}) {
  const c = post.content[locale];
  const href = localePath(locale, `/blog/${post.slug}`);

  return (
    <Card className="flex flex-col">
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <time dateTime={post.date}>{formatDate(locale, post.date)}</time>
        <span aria-hidden>·</span>
        <span>
          {readingMinutes(c.body)} {t.blog.readingTime}
        </span>
      </div>

      <h3 className="mt-2 text-base font-medium">
        <Link
          href={href}
          aria-label={c.title}
          className="underline-offset-4 hover:underline"
        >
          {c.title}
        </Link>
      </h3>

      <p className="mt-2 flex-1 text-sm text-zinc-700 dark:text-zinc-300">
        {c.description}
      </p>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        {post.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-black/10 px-2 py-0.5 dark:border-white/10"
          >
            {tag}
          </span>
        ))}
      </div>

      <Link
        href={href}
        aria-label={c.title}
        className="group mt-4 inline-flex items-center gap-1.5 self-start text-sm text-zinc-700 underline-offset-4 transition hover:underline dark:text-zinc-300"
      >
        {t.blog.readMore}
        <BsArrowRight
          className="h-3.5 w-3.5 transition group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>
    </Card>
  );
}
