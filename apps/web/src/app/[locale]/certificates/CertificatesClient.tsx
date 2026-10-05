"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BsArrowLeft, BsArrowsAngleExpand, BsBoxArrowUpRight, BsX } from "react-icons/bs";
import Select from "@/components/ui/Select";
import type { Certificate } from "@/lib/data";
import type { Dictionary } from "@/lib/i18n";
import { localePath, type Locale } from "@/lib/i18n/config";

const chip = "rounded-full border border-black/10 px-2 py-0.5 dark:border-white/10";

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
  const [viewing, setViewing] = useState<Certificate | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const providers = useMemo(() => {
    return Array.from(new Set(certificates.map((c) => c.provider))).sort();
  }, [certificates]);

  // Categories are translated, so the option values are the localised strings
  // and the list re-derives when the language changes.
  const categories = useMemo(() => {
    return Array.from(new Set(certificates.map((c) => c.category[locale]))).sort();
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

  /*
   * The native <dialog> in modal mode: focus is trapped, Escape closes it and
   * the page behind is inert, all without a library. Opening is a side effect
   * on the DOM — `showModal()` — so it follows the state from an effect.
   */
  useEffect(() => {
    if (viewing && !dialog.current?.open) dialog.current?.showModal();
  }, [viewing]);

  const clear = () => {
    setQ("");
    setProvider("all");
    setCategory("all");
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-24">
      <div className="mb-6 flex items-end justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{t.certificates.title}</h1>
        <Link
          href={`${localePath(locale, "/")}#education`}
          className="flex items-center gap-1 rounded-full border border-black/10 px-3 py-1.5 text-xs text-zinc-700 transition hover:bg-zinc-900/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/5"
        >
          <BsArrowLeft className="h-4 w-4" /> {t.certificates.backToEducation}
        </Link>
      </div>

      {/* Translucent card rather than a filled bar: `dark:bg-black/50` over the
          near-black page read as a separate black slab floating over the list. */}
      <div className="sticky top-20 z-20 mb-6 rounded-2xl border border-black/10 bg-white/80 p-3 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/[0.04]">
        <div className="grid gap-3 sm:grid-cols-5">
          <input
            placeholder={t.certificates.searchPlaceholder}
            aria-label={t.certificates.searchPlaceholder}
            className="h-11 rounded-full border border-black/10 bg-transparent px-4 text-sm outline-none transition focus:border-black/30 dark:border-white/10 dark:focus:border-white/30 sm:col-span-2"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Select
            label={t.certificates.provider}
            value={provider}
            onChange={setProvider}
            options={[{ value: "all", label: t.certificates.allProviders }, ...providers.map((p) => ({ value: p, label: p }))]}
          />
          <Select
            label={t.certificates.category}
            value={category}
            onChange={setCategory}
            options={[{ value: "all", label: t.certificates.allCategories }, ...categories.map((c) => ({ value: c, label: c }))]}
          />
          <button
            type="button"
            onClick={clear}
            className="h-11 rounded-full border border-black/10 px-3 text-sm text-zinc-700 transition hover:bg-zinc-900/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/5"
          >
            {t.certificates.clear}
          </button>
        </div>
        <div className="mt-2 px-1 text-xs text-zinc-600 dark:text-zinc-400" aria-live="polite">
          {list.length} {list.length === 1 ? t.certificates.resultOne : t.certificates.resultMany}
        </div>
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{t.certificates.noResults}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <li
              key={c.url}
              className="flex flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm transition-colors hover:border-black/20 dark:border-white/10 dark:bg-black dark:hover:border-white/30"
            >
              {c.image ? (
                <button
                  type="button"
                  onClick={() => setViewing(c)}
                  aria-label={`${t.certificates.enlarge}: ${c.title[locale]}`}
                  className="group relative block overflow-hidden border-b border-black/10 bg-zinc-100 dark:border-white/10 dark:bg-zinc-900"
                >
                  {/*
                    Unoptimised on purpose: the diploma is already WebP at its
                    final size, stored by checksum under an immutable URL.
                    Re-encoding it would spend image-optimisation quota to save
                    nothing.
                  */}
                  <Image
                    src={c.image.url}
                    alt={c.image.alt[locale]}
                    width={c.image.width}
                    height={c.image.height}
                    unoptimized
                    placeholder={c.image.blurDataUrl ? "blur" : "empty"}
                    blurDataURL={c.image.blurDataUrl ?? undefined}
                    sizes="(min-width: 1024px) 20rem, (min-width: 640px) 50vw, 100vw"
                    className="h-auto w-full transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                  <span className="absolute right-2 bottom-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    <BsArrowsAngleExpand className="h-3.5 w-3.5" aria-hidden />
                  </span>
                </button>
              ) : null}

              <div className="flex flex-1 flex-col gap-3 p-4">
                <h2 className="text-sm font-medium leading-snug">{c.title[locale]}</h2>
                <div className="mt-auto flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className={chip}>{c.provider}</span>
                  <span className={chip}>{c.category[locale]}</span>
                  {c.date ? <span>{c.date}</span> : null}
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${t.certificates.verifyOn} ${c.provider}: ${c.title[locale]}`}
                    className="ml-auto inline-flex items-center gap-1 rounded-full border border-black/10 px-2.5 py-1 text-[11px] text-zinc-600 transition hover:bg-zinc-900/5 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
                  >
                    {t.certificates.view}
                    <BsBoxArrowUpRight className="h-3 w-3" aria-hidden />
                  </a>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <dialog
        ref={dialog}
        onClose={() => setViewing(null)}
        // A click on the backdrop lands on the dialog element itself.
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
        aria-label={viewing?.title[locale]}
        className="m-auto w-[min(56rem,calc(100vw-2rem))] rounded-2xl border border-black/10 bg-white p-0 text-zinc-900 shadow-2xl backdrop:bg-black/70 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-100"
      >
        {viewing?.image ? (
          <div className="flex flex-col">
            <Image
              src={viewing.image.url}
              alt={viewing.image.alt[locale]}
              width={viewing.image.width}
              height={viewing.image.height}
              unoptimized
              className="h-auto max-h-[75vh] w-full object-contain"
            />
            <div className="flex flex-wrap items-center gap-3 border-t border-black/10 p-4 dark:border-white/10">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{viewing.title[locale]}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {[viewing.provider, viewing.category[locale], viewing.date].filter(Boolean).join(" · ")}
                </p>
              </div>
              <a
                href={viewing.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-black/10 px-3 py-1.5 text-xs transition hover:bg-zinc-900/5 dark:border-white/10 dark:hover:bg-white/5"
              >
                {t.certificates.verifyOn} {viewing.provider}
                <BsBoxArrowUpRight className="h-3 w-3" aria-hidden />
              </a>
              <button
                type="button"
                onClick={() => dialog.current?.close()}
                aria-label={t.certificates.close}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 transition hover:bg-zinc-900/5 dark:border-white/10 dark:hover:bg-white/5"
              >
                <BsX className="h-5 w-5" aria-hidden />
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
