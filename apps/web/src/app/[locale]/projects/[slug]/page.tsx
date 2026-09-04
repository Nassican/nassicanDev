import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BsArrowLeft, BsArrowUpRight, BsGithub } from "react-icons/bs";
import Prose from "@/components/Prose";
import SkillIcon from "@/components/ui/SkillIcon";
import { getProject, projects } from "@/lib/data";
import { getDictionary } from "@/lib/i18n";
import { isLocale, locales, localePath } from "@/lib/i18n/config";
import { pageMetadata, projectJsonLd } from "@/lib/seo";

type PageParams = { params: Promise<{ locale: string; slug: string }> };

/** Every project exists in every language, so the matrix is a full product. */
export function generateStaticParams() {
  return locales.flatMap((locale) =>
    projects.map((project) => ({ locale, slug: project.slug })),
  );
}

export async function generateMetadata({
  params,
}: PageParams): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const project = getProject(slug);
  if (!project) return {};
  const c = project.content[locale];

  return pageMetadata({
    locale,
    path: `/projects/${project.slug}`,
    title: project.title,
    description: c.tagline,
    type: "article",
    publishedTime: project.date,
    tags: project.stack,
  });
}

export default async function ProjectPage({ params }: PageParams) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const project = getProject(slug);
  if (!project) notFound();

  const t = getDictionary(locale);
  const c = project.content[locale];

  return (
    <main className="mx-auto max-w-5xl px-4 py-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(projectJsonLd(locale, project)),
        }}
      />

      <Link
        href={localePath(locale, "/projects")}
        className="inline-flex items-center gap-1.5 rounded-full border border-black/10 px-3 py-1.5 text-xs text-zinc-700 transition hover:bg-zinc-900/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/5"
      >
        <BsArrowLeft className="h-4 w-4" aria-hidden />
        {t.projects.back}
      </Link>

      <header className="mt-8">
        <h1 className="text-3xl font-semibold tracking-tight">
          {project.title}
        </h1>
        <p className="mt-3 max-w-[60ch] text-zinc-700 dark:text-zinc-300">
          {c.tagline}
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={project.demo}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm text-background transition hover:opacity-90"
          >
            {t.projects.liveSite}
            <BsArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </a>
          {project.repo && project.repo !== "#" && (
            <a
              href={project.repo}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-black/10 px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-900/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/5"
            >
              <BsGithub className="h-4 w-4" aria-hidden />
              {t.projects.sourceCode}
            </a>
          )}
        </div>
      </header>

      {project.image && (
        <div className="relative mt-10 aspect-video w-full overflow-hidden rounded-2xl border border-black/10 dark:border-white/10">
          <Image
            src={project.image}
            alt={`${project.title} - ${c.tagline}`}
            fill
            sizes="(min-width: 1024px) 64rem, 100vw"
            className="object-cover"
            priority
          />
        </div>
      )}

      <div className="mt-12 grid gap-10 md:grid-cols-3">
        {/* Case study, or a placeholder while it is still unwritten */}
        <article className="md:col-span-2">
          {project.comingSoon ? (
            <div className="rounded-2xl border border-dashed border-black/15 bg-white/40 px-6 py-12 backdrop-blur-sm dark:border-white/15 dark:bg-white/[0.02]">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
                {t.projects.comingSoon}
              </p>
              <p className="mt-3 max-w-[52ch] text-sm text-zinc-600 dark:text-zinc-400">
                {t.projects.comingSoonBody}
              </p>
            </div>
          ) : (
            <>
              {c.summary && (
                <p className="max-w-[68ch] leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {c.summary}
                </p>
              )}
              {c.body && (
                <div className="mt-8">
                  <Prose blocks={c.body} />
                </div>
              )}
            </>
          )}
        </article>

        {/* Facts sidebar */}
        <aside className="flex flex-col gap-6 md:sticky md:top-28 md:self-start">
          {c.role && (
            <div>
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
                {t.projects.role}
              </h2>
              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                {c.role}
              </p>
            </div>
          )}

          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
              {t.projects.year}
            </h2>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
              {project.year}
            </p>
          </div>

          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
              {t.projects.stack}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              {project.stack.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 rounded-full border border-black/10 px-2 py-0.5 dark:border-white/10"
                >
                  <SkillIcon name={s} className="h-3.5 w-3.5" />
                  {s}
                </span>
              ))}
            </div>
          </div>

          {c.highlights && c.highlights.length > 0 && (
            <div>
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
                {t.projects.highlights}
              </h2>
              <ul className="mt-2 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                {c.highlights.map((h) => (
                  <li key={h} className="flex gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zinc-400 dark:bg-zinc-600" aria-hidden />
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
