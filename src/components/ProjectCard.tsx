import Image from "next/image";
import Link from "next/link";
import { BsArrowRight } from "react-icons/bs";
import Card from "@/components/ui/Card";
import SkillIcon from "@/components/ui/SkillIcon";
import type { ProjectItem } from "@/lib/data";
import type { Dictionary } from "@/lib/i18n";
import { localePath, type Locale } from "@/lib/i18n/config";

/**
 * Shared between the homepage grid and `/projects`, so a card never drifts
 * between the two places it is rendered.
 */
export default function ProjectCard({
  project,
  locale,
  t,
}: {
  project: ProjectItem;
  locale: Locale;
  t: Dictionary;
}) {
  const c = project.content[locale];
  const href = localePath(locale, `/projects/${project.slug}`);

  return (
    <Card className="flex flex-col">
      {project.image ? (
        <Link href={href} className="mb-3 block overflow-hidden rounded-xl">
          <div className="relative aspect-video w-full">
            <Image
              src={project.image}
              alt={`${project.title} — ${c.tagline}`}
              fill
              sizes="(min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-500 hover:scale-[1.03]"
            />
          </div>
        </Link>
      ) : (
        <div className="mb-3 aspect-video w-full rounded-xl bg-zinc-100 dark:bg-zinc-900" />
      )}

      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-medium">
          <Link href={href} className="underline-offset-4 hover:underline">
            {project.title}
          </Link>
        </h3>
        <div className="flex shrink-0 gap-3 text-sm">
          <a className="underline" href={project.demo} target="_blank" rel="noreferrer">
            {t.projects.demo}
          </a>
          {project.repo && project.repo !== "#" ? (
            <a className="underline" href={project.repo} target="_blank" rel="noreferrer">
              {t.projects.code}
            </a>
          ) : (
            <span className="rounded-full border border-black/10 px-2 py-0.5 text-xs text-zinc-600 dark:border-white/10 dark:text-zinc-400">
              {t.projects.private}
            </span>
          )}
        </div>
      </div>

      <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{c.tagline}</p>

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

      <Link
        href={href}
        className="group mt-4 inline-flex items-center gap-1.5 self-start text-sm text-zinc-700 underline-offset-4 transition hover:underline dark:text-zinc-300"
      >
        {project.comingSoon ? t.projects.comingSoon : t.projects.caseStudy}
        <BsArrowRight
          className="h-3.5 w-3.5 transition group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>
    </Card>
  );
}
