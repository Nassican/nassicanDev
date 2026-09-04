import SectionTitle from "@/components/ui/SectionTitle";
import type { Dictionary } from "@/lib/i18n";

export default function About({ t }: { t: Dictionary }) {
  const cards = [
    { label: t.about.frontendLabel, text: t.about.frontend },
    { label: t.about.backendLabel, text: t.about.backend },
  ];

  return (
    <section id="about" className="mx-auto max-w-5xl scroll-mt-24 px-4 py-16 md:scroll-mt-28">
      <SectionTitle className="mb-4">{t.about.title}</SectionTitle>
      <div className="grid gap-6 md:grid-cols-2">
        {cards.map((card) => (
          <div key={card.label} className="border-t border-black/15 pt-4 dark:border-white/15">
            <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {card.label}
            </h3>
            <p className="text-zinc-700 dark:text-zinc-300">{card.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
