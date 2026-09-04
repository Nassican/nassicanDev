import Link from "next/link";
import { BsArrowRight } from "react-icons/bs";
import SectionTitle from "@/components/ui/SectionTitle";
import PostCard from "@/components/PostCard";
import { publishedPosts } from "@/lib/data";
import type { Dictionary } from "@/lib/i18n";
import { localePath, type Locale } from "@/lib/i18n/config";

/** Homepage teaser for the blog. Renders nothing while there are no posts. */
export default function LatestPosts({
  locale,
  t,
}: {
  locale: Locale;
  t: Dictionary;
}) {
  const latest = publishedPosts.slice(0, 2);
  if (!latest.length) return null;

  return (
    <section
      id="blog"
      className="mx-auto max-w-5xl scroll-mt-24 px-4 py-16 md:scroll-mt-28"
    >
      <div className="mb-6 flex items-end justify-between gap-3">
        <SectionTitle>{t.blog.latest}</SectionTitle>
        <Link
          href={localePath(locale, "/blog")}
          aria-label={t.nav.blog}
          className="flex shrink-0 items-center gap-1 rounded-full border border-black/10 px-3 py-1.5 text-xs text-zinc-700 transition hover:bg-zinc-900/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/5"
        >
          {t.blog.viewAll} <BsArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {latest.map((p) => (
          <PostCard key={p.slug} post={p} locale={locale} t={t} />
        ))}
      </div>
    </section>
  );
}
