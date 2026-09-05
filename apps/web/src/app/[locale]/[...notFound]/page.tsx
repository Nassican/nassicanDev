import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Prose from "@/components/Prose";
import { getCustomPage, getCustomPageRoutes } from "@/lib/data/pages";
import { isLocale, locales } from "@/lib/i18n/config";
import { pageMetadata } from "@/lib/seo";

type PageParams = { params: Promise<{ locale: string; notFound: string[] }> };

/**
 * Pages created in the panel are rendered here rather than through a route of
 * their own: a catch-all was already needed for 404s, and reusing it means a
 * custom page and a missing one are decided in the same place instead of
 * competing.
 */
export async function generateStaticParams() {
  const routes = await getCustomPageRoutes();

  return locales.flatMap((locale) => [
    { locale, notFound: ["404"] },
    ...routes.map((route) => ({
      locale,
      notFound: route.replace(/^\//, "").split("/"),
    })),
  ]);
}

function routeFrom(segments: string[]): string {
  return `/${segments.join("/")}`;
}

export async function generateMetadata({
  params,
}: PageParams): Promise<Metadata> {
  const { locale, notFound: segments } = await params;
  if (!isLocale(locale)) return {};

  const route = routeFrom(segments);
  const page = await getCustomPage(route, locale);
  if (!page) return { title: "404", robots: { index: false, follow: false } };

  return pageMetadata({
    locale,
    path: route,
    title: page.title,
    description: page.seo.description ?? page.title,
    override: page.seo,
  });
}

export default async function CatchAllPage({ params }: PageParams) {
  const { locale, notFound: segments } = await params;
  if (!isLocale(locale)) notFound();

  const page = await getCustomPage(routeFrom(segments), locale);
  if (!page) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-24">
      <h1 className="text-3xl font-semibold tracking-tight">{page.title}</h1>
      <div className="mt-10">
        <Prose blocks={page.body} />
      </div>
    </main>
  );
}
