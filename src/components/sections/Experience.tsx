import SectionTitle from "@/components/ui/SectionTitle";
import Card from "@/components/ui/Card";
import { experience } from "@/lib/data";

export default function Experience() {
  return (
    <section
      id="experience"
      className="mx-auto max-w-5xl scroll-mt-24 px-4 py-16 md:scroll-mt-28 min-h-dvh snap-start"
    >
      <SectionTitle className="mb-6">Experiencia</SectionTitle>
      <ol className="relative border-l border-black/10 dark:border-white/10">
        {experience.map((item) => (
          <li key={item.title + item.period} className="mb-10 ml-4">
            <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-black/20 bg-white dark:border-white/20 dark:bg-black" />
            <Card className="bg-white dark:bg-black">
              <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {item.period}
              </div>
              <div className="mt-1 text-sm font-medium">
                {item.title} · {item.org}
              </div>
              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                {item.desc}
              </p>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}
