import { serializeJsonLd } from "@nassican/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BsRss } from "react-icons/bs";
import PostCard from "@/components/PostCard";
import { getListedPosts } from "@/lib/data/posts";
import { getProfile } from "@/lib/data/profile";
import { getPageSeo } from "@/lib/data/pages";
import { getDictionary } from "@/lib/i18n";
import { isLocale, locales, localePath } from "@/lib/i18n/config";
import { blogJsonLd, pageMetadata } from "@/lib/seo";

type PageParams = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: PageParams): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);

  const override = await getPageSeo("/blog", locale);

  return pageMetadata({
    locale,
    path: "/blog",
    override,
    title: t.blog.title,
    description: t.blog.metaDescription,
  });
}

export default async function BlogPage({ params }: PageParams) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  const [posts, profile] = await Promise.all([getListedPosts(), getProfile()]);
  const [newest, ...rest] = posts;

  return (
    <main className="mx-auto max-w-5xl px-4 py-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(blogJsonLd(locale, posts, profile)),
        }}
      />

      <header className="mb-12 flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{t.blog.title}</h1>
          <p className="mt-4 max-w-[60ch] text-lg leading-relaxed text-zinc-600 dark:text-zinc-300">
            {t.blog.listDescription}
          </p>
        </div>
        {/* A plain `<a>`: the feed is not a page of this app, and `Link` would try to prefetch it as one. */}
        <a
          href={localePath(locale, "/rss.xml")}
          aria-label={t.blog.rss}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-black/10 px-3 py-1.5 text-xs text-zinc-700 transition hover:bg-zinc-900/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/5"
        >
          <BsRss className="h-3.5 w-3.5" aria-hidden />
          RSS
        </a>
      </header>

      {posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/15 bg-white/40 px-6 py-14 text-center backdrop-blur-sm dark:border-white/15 dark:bg-white/[0.02]">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
            {t.blog.comingSoon}
          </p>
          <p className="mx-auto mt-3 max-w-[46ch] text-sm text-zinc-600 dark:text-zinc-400">
            {t.blog.comingSoonBody}
          </p>
        </div>
      ) : (
        /*
         * The newest post gets the width of the page, the rest share it. A list
         * of identical cards says every article matters the same; the first
         * thing a returning reader wants is what is new.
         */
        <div className="flex flex-col gap-5">
          <PostCard post={newest} locale={locale} t={t} featured />
          {rest.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((p) => (
                <PostCard key={p.slug} post={p} locale={locale} t={t} />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </main>
  );
}
