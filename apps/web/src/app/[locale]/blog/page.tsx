import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PostCard from "@/components/PostCard";
import { getPublishedPosts } from "@/lib/data/posts";
import { getDictionary } from "@/lib/i18n";
import { isLocale, locales } from "@/lib/i18n/config";
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

  return pageMetadata({
    locale,
    path: "/blog",
    title: t.blog.title,
    description: t.blog.metaDescription,
  });
}

export default async function BlogPage({ params }: PageParams) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  const posts = await getPublishedPosts();

  return (
    <main className="mx-auto max-w-5xl px-4 py-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(blogJsonLd(locale, posts)),
        }}
      />

      <header className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight">{t.blog.title}</h1>
        <p className="mt-3 max-w-[60ch] text-zinc-700 dark:text-zinc-300">
          {t.blog.listDescription}
        </p>
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
        <div className="grid gap-4 sm:grid-cols-2">
          {posts.map((p) => (
            <PostCard key={p.slug} post={p} locale={locale} t={t} />
          ))}
        </div>
      )}
    </main>
  );
}
