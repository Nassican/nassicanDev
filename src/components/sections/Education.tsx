import SectionTitle from "@/components/ui/SectionTitle";
import Card from "@/components/ui/Card";
import { education } from "@/lib/data";
import type { EducationItem } from "@/lib/data";
import { BsArrowRight } from "react-icons/bs";

export default function Education() {
  return (
    <section id="education" className="mx-auto max-w-5xl px-4 py-16">
      <div className="mb-6 flex items-end justify-between gap-3">
        <SectionTitle>Educación</SectionTitle>
        <a
          href="/certificates"
          className="rounded-full flex items-center gap-1 border border-black/10 px-3 py-1.5 text-xs text-zinc-700 transition hover:bg-zinc-900/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/5"
        >
          Ver certificados <BsArrowRight className="h-4 w-4 " />
        </a>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {education.map((e: EducationItem) => (
          <Card key={e.title + e.org} className="bg-white dark:bg-black">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{e.period}</div>
                <div className="mt-1 text-sm font-medium">{e.title}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">{e.org}</div>
              </div>
              {e.link ? (
                <a
                  href={e.link}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-black/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-700 transition hover:bg-zinc-900/5 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
                >
                  Ver más
                </a>
              ) : (
                <span className="rounded-full border border-black/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-600 dark:border-white/10 dark:text-zinc-400">Formación</span>
              )}
            </div>
            <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">{e.desc}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
