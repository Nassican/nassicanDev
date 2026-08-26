import Link from "next/link";
import { getDictionary } from "@/lib/i18n";
import { defaultLocale, localePath } from "@/lib/i18n/config";

/**
 * `not-found` cannot read the `[locale]` param, so it answers in the default
 * language. The layout above it still renders the localized chrome for the
 * branch the request landed on.
 */
export default function NotFound() {
  const t = getDictionary(defaultLocale);

  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-3xl flex-col items-start justify-center gap-4 px-4 py-24">
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
        404
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">
        {t.notFound.title}
      </h1>
      <p className="max-w-[55ch] text-zinc-700 dark:text-zinc-300">
        {t.notFound.description}
      </p>
      <Link
        href={localePath(defaultLocale, "/")}
        className="mt-2 inline-flex items-center rounded-full bg-foreground px-5 py-2.5 text-sm text-background transition hover:opacity-90"
      >
        {t.notFound.back}
      </Link>
    </main>
  );
}
