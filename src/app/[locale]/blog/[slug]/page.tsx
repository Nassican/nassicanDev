import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BsArrowLeft } from "react-icons/bs";
import Prose from "@/components/Prose";
import { getPost, publishedPosts, readingMinutes } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";
import { isLocale, locales, localePath } from "@/lib/i18n/config";
import { pageMetadata, postJsonLd } from "@/lib/seo";

type PageParams = { params: Promise<{ locale: string; slug: string }> };

/** Every post exists in every language, so the matrix is a full product. */
export function generateStaticParams() {
  return locales.flatMap((locale) =>
    publishedPosts.map((post) => ({ locale, slug: post.slug })),
  );
}

export async function generateMetadata({
  params,
}: PageParams): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const post = getPost(slug);
  if (!post) return {};
  const c = post.content[locale];

  return pageMetadata({
    locale,
    path: `/blog/${post.slug}`,
    title: c.title,
    description: c.description,
    type: "article",
    publishedTime: post.date,
    modifiedTime: post.updated ?? post.date,
    tags: post.tags,
  });
}

export default async function PostPage({ params }: PageParams) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const post = getPost(slug);
  if (!post) notFound();

  const t = getDictionary(locale);
  const c = post.content[locale];

  return (
    <main className="mx-auto max-w-3xl px-4 py-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(postJsonLd(locale, post)),
        }}
      />

      <Link
        href={localePath(locale, "/blog")}
        className="inline-flex items-center gap-1.5 rounded-full border border-black/10 px-3 py-1.5 text-xs text-zinc-700 transition hover:bg-zinc-900/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/5"
      >
        <BsArrowLeft className="h-4 w-4" aria-hidden />
        {t.blog.back}
      </Link>

      <header className="mt-8 mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">{c.title}</h1>
        <p className="mt-3 text-zinc-700 dark:text-zinc-300">{c.description}</p>

        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <time dateTime={post.date}>
            {t.blog.published} {formatDate(locale, post.date)}
          </time>
          {post.updated && post.updated !== post.date && (
            <>
              <span aria-hidden>·</span>
              <time dateTime={post.updated}>
                {t.blog.updated} {formatDate(locale, post.updated)}
              </time>
            </>
          )}
          <span aria-hidden>·</span>
          <span>
            {readingMinutes(c.body)} {t.blog.readingTime}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-black/10 px-2 py-0.5 dark:border-white/10"
            >
              {tag}
            </span>
          ))}
        </div>
      </header>

      <article>
        <Prose blocks={c.body} />
      </article>
    </main>
  );
}
