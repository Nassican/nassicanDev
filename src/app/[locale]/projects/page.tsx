import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProjectCard from "@/components/ProjectCard";
import { projectsByDate } from "@/lib/data";
import { getDictionary } from "@/lib/i18n";
import { isLocale, locales } from "@/lib/i18n/config";
import { pageMetadata, projectsJsonLd } from "@/lib/seo";

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
    path: "/projects",
    title: t.projects.listTitle,
    description: t.projects.metaDescription,
  });
}

export default async function ProjectsPage({ params }: PageParams) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);

  return (
    <main className="mx-auto max-w-5xl px-4 py-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(projectsJsonLd(locale)),
        }}
      />

      <header className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t.projects.listTitle}
        </h1>
        <p className="mt-3 max-w-[60ch] text-zinc-700 dark:text-zinc-300">
          {t.projects.listDescription}
        </p>
      </header>

      {projectsByDate.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {t.projects.empty}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projectsByDate.map((p) => (
            <ProjectCard key={p.slug} project={p} locale={locale} t={t} />
          ))}
        </div>
      )}
    </main>
  );
}
