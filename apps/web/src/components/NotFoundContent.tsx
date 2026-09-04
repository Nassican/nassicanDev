"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { getDictionary } from "@/lib/i18n";
import {
  defaultLocale,
  htmlLang,
  localePath,
  locales,
  type Locale,
} from "@/lib/i18n/config";

function localeFromPath(pathname: string): Locale {
  const segment = pathname.split("/")[1];
  return locales.includes(segment as Locale)
    ? (segment as Locale)
    : defaultLocale;
}

export default function NotFoundContent() {
  const pathname = usePathname();
  const locale = localeFromPath(pathname ?? "/");
  const t = getDictionary(locale);

  useEffect(() => {
    document.documentElement.lang = htmlLang[locale];
  }, [locale]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-start justify-center gap-5 px-4 py-24">
      <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
        404
      </p>
      <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
        {t.notFound.title}
      </h1>
      <p className="max-w-[55ch] text-zinc-700 dark:text-zinc-300">
        {t.notFound.description}
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <Link
          href={localePath(locale, "/")}
          className="inline-flex h-11 items-center rounded-full bg-foreground px-5 text-sm text-background transition-colors hover:bg-black/80 dark:hover:bg-white/80"
        >
          {t.notFound.back}
        </Link>
        <Link
          href={localePath(locale, "/projects")}
          className="inline-flex h-11 items-center rounded-full border border-black/20 px-5 text-sm transition-colors hover:bg-black/5 dark:border-white/30 dark:hover:bg-white/10"
        >
          {t.nav.projects}
        </Link>
      </div>
    </main>
  );
}
