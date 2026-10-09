import Image from "next/image";
import Link from "next/link";
import { BsArrowRight } from "react-icons/bs";
import { readingMinutes, type Post } from "@/lib/data";
import { formatDate } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";
import { localePath, type Locale } from "@/lib/i18n/config";

/**
 * One article in a list. Shared between the homepage teaser and `/blog`.
 *
 * The whole card is the link — the title's link is stretched over it — so
 * there is one target and one name, the title, instead of a title link and a
 * «read more» link that a screen reader meets as two.
 *
 * `featured` is the newest post at the top of the index: wider, with a larger
 * title, and its cover beside the text when it has one. A post without a cover
 * is the same card without the picture, not a card with a grey box.
 */
export default function PostCard({
  post,
  locale,
  t,
  featured = false,
}: {
  post: Post;
  locale: Locale;
  t: Dictionary;
  featured?: boolean;
}) {
  const c = post.content[locale];
  const href = localePath(locale, `/blog/${post.slug}`);
  const Title = featured ? "h2" : "h3";

  return (
    <article
      className={`group relative flex overflow-hidden rounded-2xl border border-black/10 shadow-sm transition-colors hover:border-black/25 dark:border-white/10 dark:hover:border-white/30 ${
        featured && post.image ? "flex-col md:flex-row" : "flex-col"
      }`}
    >
      {post.image ? (
        <div className={`relative aspect-[1200/630] shrink-0 ${featured ? "md:w-1/2" : ""}`}>
          <Image
            src={post.image}
            alt=""
            fill
            sizes={featured ? "(min-width: 768px) 32rem, 100vw" : "(min-width: 640px) 31rem, 100vw"}
            className="object-cover"
          />
        </div>
      ) : null}

      <div className={`flex min-w-0 flex-1 flex-col ${featured ? "p-6 sm:p-8" : "p-5"}`}>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
          {featured ? <span className="text-zinc-900 dark:text-zinc-100">{t.blog.newest}</span> : null}
          {featured && post.tags[0] ? <span aria-hidden>·</span> : null}
          {post.tags[0] ? <span>{post.tags[0]}</span> : null}
        </p>

        <Title
          className={`mt-2 text-balance font-semibold tracking-tight ${
            featured ? "text-2xl sm:text-3xl sm:leading-tight" : "text-lg leading-snug"
          }`}
        >
          <Link href={href} className="underline-offset-4 after:absolute after:inset-0 group-hover:underline">
            {c.title}
          </Link>
        </Title>

        <p
          className={`mt-2 flex-1 text-zinc-600 dark:text-zinc-400 ${
            featured ? "max-w-[60ch] text-base leading-relaxed" : "line-clamp-3 text-sm leading-relaxed"
          }`}
        >
          {c.description}
        </p>

        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-zinc-600 dark:text-zinc-400">
          <span>
            <time dateTime={post.date}>{formatDate(locale, post.date)}</time>
            <span aria-hidden> · </span>
            {readingMinutes(c.body)} {t.blog.readingTime}
          </span>
          {/* Decoration: the card is already the link, and its name is the title. */}
          <span aria-hidden className="inline-flex shrink-0 items-center gap-1.5 text-zinc-900 dark:text-zinc-100">
            {/* In a third of the page there is room for the date or for these words, not both. */}
            {featured ? t.blog.readMore : null}
            <BsArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </article>
  );
}
