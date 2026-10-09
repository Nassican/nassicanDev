import { serializeJsonLd } from "@nassican/shared";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getProfile } from "@/lib/data/profile";
import { notFound } from "next/navigation";
import { BsChevronRight } from "react-icons/bs";
import ArticleFooter from "@/components/blog/ArticleFooter";
import Prose from "@/components/Prose";
import TableOfContents from "@/components/ui/TableOfContents";
import ReadingTimeline from "@/components/ui/ReadingTimeline";
import { readingMinutes, relatedBySharedTags, tableOfContents } from "@/lib/data";
import { getListedPosts, getPost, getPublishedPosts } from "@/lib/data/posts";
import { formatDate } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";
import { isLocale, locales, localePath } from "@/lib/i18n/config";
import { postJsonLd, siteUrl } from "@/lib/seo";
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

  const [profile, listed] = await Promise.all([getProfile(), getListedPosts()]);
  const t = getDictionary(locale);
  const c = post.content[locale];
  const toc = tableOfContents(c.body);
  const avatar = profile.avatar ?? "/brand/LogoNassican.png";
  const minutes = readingMinutes(c.body);

  return (
    /*
     * Three columns on a wide screen — an empty one, the text, and the timeline
     * on the right. The empty one is the timeline's width, so the text stays on
     * the centre line it has everywhere else.
     * The timeline is sticky inside this grid rather than fixed to the window,
     * which is what makes it stop with the article instead of riding over the
     * footer.
     */
    <main className="mx-auto max-w-3xl px-4 py-24 xl:grid xl:max-w-[78rem] xl:grid-cols-[13rem_minmax(0,46rem)_13rem] xl:justify-center xl:gap-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(postJsonLd(locale, post)),
        }}
      />

      <ReadingTimeline entries={toc} label={t.blog.toc} progressLabel={t.blog.readingProgress} />

      <div className="min-w-0 xl:col-start-2 xl:row-start-1">
        {/* The same trail the structured data declares, minus the page itself: its title is the next line. */}
        <nav aria-label={t.breadcrumb.label}>
          <ol className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
            <li>
              <Link href={localePath(locale, "/")} className="underline-offset-4 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100">
                {t.breadcrumb.home}
              </Link>
            </li>
            <li aria-hidden>
              <BsChevronRight className="h-2.5 w-2.5" />
            </li>
            <li>
              <Link href={localePath(locale, "/blog")} className="underline-offset-4 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100">
                {t.blog.title}
              </Link>
            </li>
          </ol>
        </nav>

        <header className="mt-8 mb-10">
          {post.tags[0] ? (
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
              {post.tags[0]}
            </p>
          ) : null}
          <h1 className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl sm:leading-[1.08]">
            {c.title}
          </h1>
          <p className="mt-5 text-pretty text-lg leading-relaxed text-zinc-600 sm:text-xl sm:leading-relaxed dark:text-zinc-300">
            {c.description}
          </p>

          {/* Who and when, in one line: the two things a reader checks before deciding to trust the rest. */}
          <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3 border-y border-black/10 py-4 dark:border-white/10">
            <Image src={avatar} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-full object-cover" />
            <div className="min-w-0 flex-1">
              <Link
                href={localePath(locale, "/")}
                rel="author"
                className="text-sm font-semibold underline-offset-4 hover:underline"
              >
                {profile.name}
              </Link>
              {profile.title[locale] ? (
                <p className="truncate text-xs text-zinc-600 dark:text-zinc-400">{profile.title[locale]}</p>
              ) : null}
            </div>
            {/* Its own line on a phone: beside the name it squeezed the name into three lines. */}
            <div className="w-full text-xs text-zinc-600 sm:w-auto sm:text-right dark:text-zinc-400">
              <p>
                <time dateTime={post.date}>{formatDate(locale, post.date)}</time>
                <span aria-hidden> · </span>
                {minutes} {t.blog.readingTime}
              </p>
              {post.updated && post.updated !== post.date ? (
                <p className="mt-0.5">
                  {t.blog.updated} <time dateTime={post.updated}>{formatDate(locale, post.updated)}</time>
                </p>
              ) : null}
            </div>
          </div>
        </header>

        {post.image ? (
          <Image
            src={post.image}
            alt={c.title}
            width={1200}
            height={630}
            sizes="(min-width: 768px) 46rem, 100vw"
            priority
            className="mb-10 h-auto w-full rounded-2xl border border-black/10 dark:border-white/10"
          />
        ) : null}

        {/*
          Above the article where there is no margin to put it in. Wide screens
          have the timeline beside the text instead, and this hides itself.
        */}
        <TableOfContents entries={toc} label={t.blog.toc} />

        {/* `data-reading-root` is what the timeline measures progress against. */}
        <article data-reading-root>
          <Prose blocks={c.body} copy={{ label: t.blog.copyCode, done: t.blog.codeCopied }} />
        </article>

        <ArticleFooter
          post={post}
          related={relatedBySharedTags(post, listed)}
          profile={profile}
          avatar={avatar}
          url={`${siteUrl}${localePath(locale, `/blog/${post.slug}`)}`}
          locale={locale}
          t={t}
        />
      </div>
    </main>
  );
}
