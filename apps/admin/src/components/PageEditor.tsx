"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { locales, localeNames, type ContentBlock, type Locale } from "@nassican/shared";
import BlockEditor from "@/components/BlockEditor";
import { incompleteLocales, type PageDraft, type PageTranslationDraft } from "@/lib/page-draft";
import type { ActionResult } from "@/app/(panel)/contenido/paginas/actions";

const field =
  "w-full rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none";
const label =
  "font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500";
const button =
  "rounded border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export default function PageEditor({
  initial,
  actions,
}: {
  initial: PageDraft;
  actions: {
    save: (d: PageDraft) => Promise<ActionResult>;
    publish: (d: PageDraft) => Promise<ActionResult>;
    unpublish: (id: string) => Promise<ActionResult>;
    remove: (id: string) => Promise<ActionResult>;
  };
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState<Locale>(draft.translations[0].locale);

  const system = draft.kind === "system";
  const published = draft.status === "published";
  const current = draft.translations.find((t) => t.locale === active)!;
  const missing = incompleteLocales(draft, locales);

  function patch(locale: Locale, next: Partial<PageTranslationDraft>) {
    setDraft((d) => ({
      ...d,
      translations: d.translations.map((t) =>
        t.locale === locale ? { ...t, ...next } : t,
      ),
    }));
  }

  function run(action: () => Promise<ActionResult>) {
    setResult(null);
    startTransition(async () => {
      const outcome = await action();
      setResult(outcome);
      if (outcome.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">
            {current.title.trim() || draft.route}
          </h1>
          <span
            className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] ${
              system
                ? "bg-blue-950 text-blue-300"
                : published
                  ? "bg-green-950 text-green-400"
                  : "bg-neutral-900 text-neutral-500"
            }`}
          >
            {system ? "ruta del sitio" : published ? "publicada" : "borrador"}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => actions.save(draft))}
            className={`${button} border-neutral-700 text-neutral-200 hover:border-neutral-500`}
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>

          {!system ? (
            <>
              {published ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => actions.unpublish(draft.id))}
                  className={`${button} border-neutral-700 text-neutral-400 hover:border-neutral-500`}
                >
                  Despublicar
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => actions.publish(draft))}
                  className={`${button} border-green-800 bg-green-950/60 text-green-300 hover:border-green-600`}
                >
                  Publicar
                </button>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (!confirm("¿Eliminar esta página? No se puede deshacer.")) return;
                  run(() => actions.remove(draft.id));
                }}
                className={`${button} border-red-900/70 text-red-400 hover:border-red-600`}
              >
                Eliminar
              </button>
            </>
          ) : null}
        </div>
      </header>

      {system ? (
        <p className="rounded border border-blue-950 bg-blue-950/20 px-4 py-3 text-sm text-blue-200">
          Esta ruta existe en el código del sitio. Aquí solo se editan sus
          metadatos: el contenido se cambia en su módulo correspondiente.
        </p>
      ) : null}

      {result ? (
        <p
          role="status"
          className={`rounded border px-4 py-3 text-sm ${
            result.ok
              ? "border-green-900/60 bg-green-950/30 text-green-300"
              : "border-red-900/60 bg-red-950/30 text-red-300"
          }`}
        >
          {result.message}
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <span className={label}>Ruta</span>
          <input
            className={field}
            value={draft.route}
            disabled={system}
            onChange={(e) => setDraft({ ...draft, route: e.target.value })}
          />
          <span className="text-[11px] text-neutral-600">
            nassican.com{draft.route}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={label}>Prioridad en el sitemap</span>
          <input
            className={field}
            type="number"
            step="0.1"
            min="0"
            max="1"
            value={draft.sitemapPriority ?? ""}
            placeholder="0.8"
            onChange={(e) =>
              setDraft({
                ...draft,
                sitemapPriority: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={label}>Frecuencia de cambio</span>
          <input
            className={field}
            value={draft.sitemapChangefreq}
            placeholder="monthly"
            onChange={(e) =>
              setDraft({ ...draft, sitemapChangefreq: e.target.value })
            }
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex gap-1 border-b border-neutral-900">
          {draft.translations.map((t) => (
            <button
              key={t.locale}
              type="button"
              onClick={() => setActive(t.locale)}
              className={`flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors ${
                active === t.locale
                  ? "border-neutral-300 text-neutral-100"
                  : "border-transparent text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {localeNames[t.locale]}
              {!system ? (
                <span
                  aria-label={missing.includes(t.locale) ? "incompleto" : "completo"}
                  className={`size-1.5 rounded-full ${
                    missing.includes(t.locale) ? "bg-amber-500" : "bg-green-500"
                  }`}
                />
              ) : null}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={label}>{system ? "Nombre en el panel" : "Título"}</span>
          <input
            className={field}
            value={current.title}
            onChange={(e) => patch(active, { title: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={label}>Título SEO</span>
          <input
            className={field}
            value={current.seoTitle}
            placeholder="Vacío = usa el título de la página"
            onChange={(e) => patch(active, { seoTitle: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={label}>Meta descripción</span>
          <textarea
            className={`${field} min-h-20`}
            value={current.seoDescription}
            onChange={(e) => patch(active, { seoDescription: e.target.value })}
          />
          <span className="text-[11px] text-neutral-600">
            {current.seoDescription.length} caracteres · por debajo de 160 es lo
            que Google muestra entero
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={label}>Palabras clave</span>
          <input
            className={field}
            value={current.keywords.join(", ")}
            placeholder="separadas por comas"
            onChange={(e) =>
              patch(active, { keywords: e.target.value.split(",") })
            }
          />
        </div>

        <label className="flex w-fit items-center gap-2 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={current.noindex}
            onChange={(e) => patch(active, { noindex: e.target.checked })}
          />
          No indexar esta versión
        </label>

        {!system ? (
          <div className="flex flex-col gap-1.5">
            <span className={label}>Contenido</span>
            <BlockEditor
              blocks={current.body}
              onChange={(body: ContentBlock[]) => patch(active, { body })}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
