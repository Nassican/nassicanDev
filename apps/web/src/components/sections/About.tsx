import SectionTitle from "@/components/ui/SectionTitle";
import type { Dictionary } from "@/lib/i18n";
import Link from "next/link";
import type { Profile } from "@/lib/data/profile";
import { identityLead } from "@/lib/identity";
import { localePath, type Locale } from "@/lib/i18n/config";

export default function About({
  t,
  locale,
  profile,
}: {
  t: Dictionary;
  locale: Locale;
  profile: Profile;
}) {
  const cards = [
    { label: t.about.frontendLabel, text: t.about.frontend },
    { label: t.about.backendLabel, text: t.about.backend },
  ];

  return (
    <section id="about" className="mx-auto max-w-5xl scroll-mt-24 px-4 py-16 md:scroll-mt-28">
      <SectionTitle className="mb-4">{t.about.title}</SectionTitle>
      <p className="mb-4 max-w-prose text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
        {identityLead(locale, profile.name)}{" "}
        {locale === "es"
          ? "Aquí presento mis proyectos de software, las tecnologías con las que trabajo y mi trayectoria."
          : "Here I share my software projects, the technologies I work with and my professional background."}
      </p>
      <Link
        className="mb-6 inline-block text-sm font-medium underline underline-offset-4"
        href={localePath(locale, "/profile")}
      >
        {locale === "es" ? "Conoce mi perfil profesional" : "Explore my professional profile"}
      </Link>
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
