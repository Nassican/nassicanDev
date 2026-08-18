import SectionTitle from "@/components/ui/SectionTitle";
import Card from "@/components/ui/Card";
import { education } from "@/lib/data";
import type { EducationItem } from "@/lib/data";
import { BsArrowRight, BsArrowUpRight, BsMortarboard } from "react-icons/bs";

export default function Education() {
  return (
    <section
      id="education"
      className="mx-auto max-w-5xl scroll-mt-24 px-4 py-16 md:scroll-mt-28"
    >
      <div className="mb-6 flex items-end justify-between gap-3">
        <SectionTitle>Educación</SectionTitle>
        <a
          href="/certificates"
          className="flex shrink-0 items-center gap-1 rounded-full border border-black/10 px-3 py-1.5 text-xs text-zinc-700 transition hover:bg-zinc-900/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/5"
        >
          Ver certificados <BsArrowRight className="h-4 w-4" aria-hidden />
        </a>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {education.map((e: EducationItem) => {
          const completed = e.status === "completed";
          return (
            <Card
              key={e.title + e.org}
              className="flex flex-col bg-white dark:bg-black"
            >
              <div className="flex items-start gap-3">
                <BsMortarboard
                  className="mt-0.5 h-5 w-5 shrink-0 text-zinc-400 dark:text-zinc-500"
                  aria-hidden
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <time
                      dateTime={completed ? (e.end ?? e.start) : e.start}
                      className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
                    >
                      {e.period}
                    </time>
                    <span className="rounded-full border border-black/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-700 dark:border-white/10 dark:text-zinc-300">
                      {completed ? "Culminada" : "En curso"}
                    </span>
                  </div>
                  <h3 className="mt-1 text-sm font-medium">{e.title}</h3>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {e.org}
                  </div>
                </div>
              </div>
              <p className="mt-3 flex-1 text-sm text-zinc-700 dark:text-zinc-300">
                {e.desc}
              </p>
              {e.link && (
                <a
                  href={e.link}
                  target="_blank"
                  rel="noreferrer"
                  className="group mt-4 inline-flex items-center gap-1.5 self-start text-sm text-zinc-700 underline-offset-4 transition hover:underline dark:text-zinc-300"
                >
                  Ver perfil en {e.org}
                  <BsArrowUpRight
                    className="h-3.5 w-3.5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    aria-hidden
                  />
                </a>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
