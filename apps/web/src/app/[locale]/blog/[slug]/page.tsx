import { serializeJsonLd } from "@nassican/shared";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getProfile } from "@/lib/data/profile";
import { notFound } from "next/navigation";
import { BsArrowLeft } from "react-icons/bs";
import Prose from "@/components/Prose";
import { readingMinutes } from "@/lib/data";
import { getPost, getPublishedPosts } from "@/lib/data/posts";
import { formatDate } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";
import { isLocale, locales, localePath } from "@/lib/i18n/config";
import { postJsonLd } from "@/lib/seo";
import { pageMetadata } from "@/lib/page-metadata";

type PageParams = { params: Promise<{ locale: string; slug: string }> };

/**
 * Every post exists in every language, so the matrix is a full product.
 * A post published after this build has no entry here and renders on demand,
 * which is what `dynamicParams` gives by default.
 */
export async function generateStaticParams() {
  const posts = await getPublishedPosts();
  return locales.flatMap((locale) =>
    posts.map((post) => ({ locale, slug: post.slug })),
  );
}

export async function generateMetadata({
  params,
}: PageParams): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const post = await getPost(slug);
  if (!post) return {};
  const c = post.content[locale];

  return pageMetadata({
    locale,
    path: `/blog/${post.slug}`,
    title: c.title,
    description: c.description,
    type: "article",
    override: c.seo,
    image: post.image,
    availableLocales: locales.filter((l) => !post.content[l].seo.noindex),
    publishedTime: post.date,
    modifiedTime: post.updated ?? post.date,
    tags: post.tags,
  });
}

export default async function PostPage({ params }: PageParams) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const post = await getPost(slug);
  if (!post) notFound();

  const profile = await getProfile();
  const t = getDictionary(locale);
  const c = post.content[locale];

  return (
    <main className="mx-auto max-w-3xl px-4 py-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(postJsonLd(locale, post)),
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

      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        {locale === "es" ? "Por " : "By "}<Link href={localePath(locale, "/")} rel="author" className="underline">{profile.name}</Link>
      </p>
      {post.image ? <Image src={post.image} alt={c.title} width={1200} height={630} sizes="(min-width: 768px) 48rem, 100vw" className="mb-8 h-auto w-full rounded-xl" /> : null}
      <article>
        <Prose blocks={c.body} />
      </article>
    </main>
  );
}
