"use client";
import { useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import type { Certificate } from "@/lib/data";

import Link from "next/link";
import { BsArrowLeft } from "react-icons/bs";
import type { Dictionary } from "@/lib/i18n";
import { localePath, type Locale } from "@/lib/i18n/config";

export default function CertificatesClient({
  locale,
  t,
  certificates,
}: {
  locale: Locale;
  t: Dictionary;
  /** Passed down rather than imported: this is a client component and the
   *  certificates now come from the database. */
  certificates: Certificate[];
}) {
  const [q, setQ] = useState("");
  const [provider, setProvider] = useState("all");
  const [category, setCategory] = useState("all");

  const providers = useMemo(() => {
    return Array.from(new Set(certificates.map((c) => c.provider))).sort();
  }, [certificates]);

  // Categories are translated, so the option values are the localised strings
  // and the list re-derives when the language changes.
  const categories = useMemo(() => {
    return Array.from(
      new Set(certificates.map((c) => c.category[locale])),
    ).sort();
  }, [certificates, locale]);

  const list = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return certificates.filter((c) => {
      const okProvider = provider === "all" || c.provider === provider;
      const okCategory = category === "all" || c.category[locale] === category;
      const okQuery =
        !ql ||
        c.title[locale].toLowerCase().includes(ql) ||
        c.provider.toLowerCase().includes(ql) ||
        c.category[locale].toLowerCase().includes(ql);
      return okProvider && okCategory && okQuery;
    });
  }, [certificates, q, provider, category, locale]);

  const clear = () => {
    setQ("");
    setProvider("all");
    setCategory("all");
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-24">
      <div className="mb-6 flex items-end justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">
          {t.certificates.title}
        </h1>
        <Link
          href={`${localePath(locale, "/")}#education`}
          className="rounded-full flex items-center gap-1 border border-black/10 px-3 py-1.5 text-xs text-zinc-700 transition hover:bg-zinc-900/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/5"
        >
          <BsArrowLeft className="h-4 w-4" /> {t.certificates.backToEducation}
        </Link>
      </div>

      {/* Translucent card rather than a filled bar: `dark:bg-black/50` over the
          near-black page read as a separate black slab floating over the list. */}
      <div className="sticky top-20 z-10 mb-6 rounded-2xl border border-black/10 bg-white/80 p-3 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/[0.04]">
        <div className="grid gap-3 sm:grid-cols-5">
          <input
            placeholder={t.certificates.searchPlaceholder}
            aria-label={t.certificates.searchPlaceholder}
            className="h-11 rounded-full border border-black/10 bg-transparent px-4 text-sm outline-none transition focus:border-black/30 dark:border-white/10 dark:focus:border-white/30 sm:col-span-2"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="relative">
            <select
              aria-label={t.certificates.allProviders}
              className="h-11 w-full appearance-none rounded-full border border-black/10 bg-transparent px-3 pr-9 text-sm outline-none transition focus:border-black/30 dark:border-white/10 dark:focus:border-white/30"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              <option value="all">{t.certificates.allProviders}</option>
              {providers.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-zinc-600 dark:text-zinc-300">
              <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd"/></svg>
            </span>
          </div>
          <div className="relative">
            <select
              aria-label={t.certificates.allCategories}
              className="h-11 w-full appearance-none rounded-full border border-black/10 bg-transparent px-3 pr-9 text-sm outline-none transition focus:border-black/30 dark:border-white/10 dark:focus:border-white/30"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">{t.certificates.allCategories}</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-zinc-600 dark:text-zinc-300">
              <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd"/></svg>
            </span>
          </div>
          <button
            onClick={clear}
            className="h-11 rounded-full border border-black/10 px-3 text-sm text-zinc-700 transition hover:bg-zinc-900/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/5"
          >
            {t.certificates.clear}
          </button>
        </div>
        <div className="mt-2 px-1 text-xs text-zinc-600 dark:text-zinc-400">
          {list.length}{" "}
          {list.length === 1
            ? t.certificates.resultOne
            : t.certificates.resultMany}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {list.length === 0 && (
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            {t.certificates.noResults}
          </div>
        )}
        {list.map((c: Certificate) => (
          <Card key={c.title[locale] + c.provider} className="bg-white dark:bg-black">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium">{c.title[locale]}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="rounded-full border border-black/10 px-2 py-0.5 dark:border-white/10">{c.provider}</span>
                  <span className="rounded-full border border-black/10 px-2 py-0.5 dark:border-white/10">{c.category[locale]}</span>
                  {c.date && <span>{c.date}</span>}
                </div>
              </div>
              <a
                href={c.url}
                target="_blank"
                rel="noreferrer"
                aria-label={`${t.certificates.view}: ${c.title[locale]}`}
                className="rounded-full border border-black/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-600 transition hover:bg-zinc-900/5 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
              >
                {t.certificates.view}
              </a>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
