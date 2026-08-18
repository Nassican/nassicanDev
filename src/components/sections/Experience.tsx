import SectionTitle from "@/components/ui/SectionTitle";
import SkillIcon from "@/components/ui/SkillIcon";
import { experience } from "@/lib/data";

export default function Experience() {
  return (
    <section
      id="experience"
      className="mx-auto max-w-5xl scroll-mt-24 px-4 py-16 md:scroll-mt-28"
    >
      <SectionTitle className="mb-8">Experiencia</SectionTitle>
      <ol>
        {experience.map((item) => {
          const ongoing = !item.end;
          return (
            <li
              key={item.title + item.period}
              // The rail is drawn per item so it stops at the last dot
              // instead of dangling below the list.
              className="relative pb-10 pl-8 last:pb-0 before:absolute before:bottom-0 before:left-[5px] before:top-5 before:w-px before:bg-black/10 last:before:hidden dark:before:bg-white/10"
            >
              <span
                className={`absolute left-0 top-[7px] h-2.5 w-2.5 rounded-full border-2 ${
                  ongoing
                    ? "border-zinc-900 bg-zinc-900 dark:border-zinc-100 dark:bg-zinc-100"
                    : "border-zinc-300 bg-white dark:border-zinc-700 dark:bg-black"
                }`}
                aria-hidden
              />
              <div className="flex flex-wrap items-center gap-2">
                <time
                  dateTime={item.start}
                  className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
                >
                  {item.period}
                </time>
                {ongoing && (
                  <span className="rounded-full border border-black/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-700 dark:border-white/10 dark:text-zinc-300">
                    Actual
                  </span>
                )}
              </div>
              <h3 className="mt-1.5 text-base font-medium">{item.title}</h3>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                {item.org}
              </div>
              <p className="mt-2 max-w-[65ch] text-sm text-zinc-700 dark:text-zinc-300">
                {item.desc}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                {item.stack.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 rounded-full border border-black/10 px-2 py-0.5 dark:border-white/10"
                  >
                    <SkillIcon name={s} className="h-3.5 w-3.5" />
                    {s}
                  </span>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
