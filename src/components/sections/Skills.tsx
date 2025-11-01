import { skills } from "@/lib/data";
import SectionTitle from "@/components/ui/SectionTitle";
import SkillIcon from "@/components/ui/SkillIcon";

export default function Skills() {
  return (
    <section id="skills" className="w-full scroll-mt-24 px-0 py-12 md:scroll-mt-28">
      <SectionTitle className="mb-6 px-4 mx-auto max-w-5xl">Tecnologías</SectionTitle>

      {/* Showcase de iconos: filas amplias */}
      <div className="space-y-6">
        {Object.entries(skills).map(([group, list], idx) => (
          <div
            key={group}
            className={`marquee ${idx % 2 === 0 ? "marquee-animate-rtl" : "marquee-animate-ltr"}`}
          >
            <div className="px-4">
              <div className="mb-2 w-full text-center text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{group}</div>
            </div>
            <div className="marquee-track gap-6 px-4 py-2">
              {[...list, ...list, ...list, ...list, ...list].map((item, i) => (
                <span
                  key={`${item}-${i}`}
                  className="group relative inline-flex items-center gap-3 rounded-full border border-black/10 px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-foreground hover:text-background dark:border-white/10 dark:text-zinc-200"
                >
                  <SkillIcon name={item} className="h-8 w-8" />
                  <span className="hidden sm:inline">{item}</span>
                  <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-black/10 bg-white px-2 py-1 text-[11px] text-black opacity-0 shadow-sm transition-opacity group-hover:opacity-100 dark:border-white/10 dark:bg-black dark:text-white">
                    {item}
                  </span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
