import Link from "next/link";
import { buttonClassName } from "@/components/ui/Button";
import { getProfile } from "@/lib/data/profile";
import type { Dictionary } from "@/lib/i18n";
import { localePath, type Locale } from "@/lib/i18n/config";

export default async function Hero({
  locale,
  t,
}: {
  locale: Locale;
  t: Dictionary;
}) {
  const profile = await getProfile();
  return (
    <section className="relative mx-auto flex min-h-dvh max-w-5xl flex-col items-start justify-center gap-6 border-b border-black/10 px-4 pt-24 dark:border-white/10">
      <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
        {t.hero.badge}
      </p>
      <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
        {profile.name}
      </h1>
      <p className="max-w-2xl text-base text-zinc-700 dark:text-zinc-300">
        {t.hero.description}
      </p>
      <div className="flex gap-3">
        <Link
          href={localePath(locale, "/projects")}
          aria-label={t.nav.projects}
          className={buttonClassName()}
        >
          {t.hero.viewProjects}
        </Link>
        <a
          href="#contact"
          aria-label={t.nav.contact}
          className={buttonClassName("outline")}
        >
          {t.hero.contact}
        </a>
      </div>
      <a
        href="#about"
        aria-label={t.nav.about}
        className="group absolute bottom-6 left-1/2 -translate-x-1/2 text-xs font-medium text-zinc-600 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
      >
        <span className="mr-2 align-middle">{t.hero.scroll}</span>
        <svg
          className="inline h-4 w-4 animate-scroll-cue align-middle"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </a>
    </section>
  );
}
