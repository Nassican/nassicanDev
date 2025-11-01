import SectionTitle from "@/components/ui/SectionTitle";
import Card from "@/components/ui/Card";
import { projects } from "@/lib/data";
import Image from "next/image";
import SkillIcon from "@/components/ui/SkillIcon";

export default function Projects() {
  return (
    <section id="projects" className="mx-auto max-w-5xl scroll-mt-24 px-4 py-16 md:scroll-mt-28">
      <SectionTitle className="mb-6">Proyectos</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        {projects.map((p) => (
          <Card key={p.title}>
            {p.image ? (
              <a href={p.demo} target="_blank" rel="noreferrer" className="mb-3 block overflow-hidden rounded-xl">
                <div className="relative aspect-video w-full">
                  <Image
                    src={p.image}
                    alt={p.title}
                    fill
                    sizes="(min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                    priority={false}
                  />
                </div>
              </a>
            ) : (
              <div className="mb-3 aspect-video w-full rounded-xl bg-zinc-100 dark:bg-zinc-900" />
            )}
            <div className="flex items-center justify-between">
              <h3 className="text-base font-medium">{p.title}</h3>
              <div className="flex gap-3 text-sm">
                <a className="underline" href={p.demo} target="_blank" rel="noreferrer">Demo</a>
                {p.repo && p.repo !== "#" ? (
                  <a className="underline" href={p.repo} target="_blank" rel="noreferrer">Código</a>
                ) : (
                  <span className="rounded-full border border-black/10 px-2 py-0.5 text-xs text-zinc-600 dark:border-white/10 dark:text-zinc-400">Privado</span>
                )}
              </div>
            </div>
            <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{p.description}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              {p.stack.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 rounded-full border border-black/10 px-2 py-0.5 dark:border-white/10">
                  <SkillIcon name={s} className="h-3.5 w-3.5" />
                  {s}
                </span>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
