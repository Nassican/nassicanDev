"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { localeNames, type ContentBlock, type Locale } from "@nassican/shared";
import BlockEditor from "@/components/BlockEditor";
import {
  isLocaleComplete,
  type PostDraft,
  type PostTranslationDraft,
} from "@/lib/post-draft";
import type { ActionResult } from "@/app/(panel)/contenido/blogs/actions";

const field =
  "w-full rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none";

const label =
  "font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500";

const button =
  "rounded border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export default function PostEditor({
  initial,
  actions,
}: {
  initial: PostDraft;
  actions: {
    save: (draft: PostDraft) => Promise<ActionResult>;
    publish: (draft: PostDraft) => Promise<ActionResult>;
    unpublish: (id: string) => Promise<ActionResult>;
    remove: (id: string) => Promise<void>;
  };
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<PostDraft>(initial);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState<Locale>(draft.translations[0].locale);

  function patchTranslation(
    locale: Locale,
    patch: Partial<PostTranslationDraft>,
  ) {
    setDraft((d) => ({
      ...d,
      translations: d.translations.map((t) =>
        t.locale === locale ? { ...t, ...patch } : t,
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

  const current = draft.translations.find((t) => t.locale === active)!;
  const published = draft.status === "published";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">
            {current.title.trim() || "Artículo sin título"}
          </h1>
          <span
            className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] ${
              published
                ? "bg-green-950 text-green-400"
                : "bg-neutral-900 text-neutral-500"
            }`}
          >
            {published ? "publicado" : "borrador"}
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
              if (!confirm("¿Eliminar este artículo? No se puede deshacer.")) return;
              startTransition(() => actions.remove(draft.id));
            }}
            className={`${button} border-red-900/70 text-red-400 hover:border-red-600`}
          >
            Eliminar
          </button>
        </div>
      </header>

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

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <span className={label}>Slug</span>
          <input
            className={field}
            value={draft.slug}
            onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
          />
          <span className="text-[11px] text-neutral-600">
            nassican.com/blog/{draft.slug || "…"}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={label}>Fecha de publicación</span>
          <input
            type="date"
            className={field}
            value={draft.publishedAt ? draft.publishedAt.slice(0, 10) : ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                publishedAt: e.target.value
                  ? new Date(e.target.value).toISOString()
                  : null,
              })
            }
          />
          <span className="text-[11px] text-neutral-600">
            Vacío = ahora al publicar
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={label}>Etiquetas</span>
          <input
            className={field}
            value={draft.tags.join(", ")}
            placeholder="Next.js, PostgreSQL"
            onChange={(e) =>
              setDraft({ ...draft, tags: e.target.value.split(",") })
            }
          />
          <span className="text-[11px] text-neutral-600">
            Si coinciden con una tecnología, resuelven su icono
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={label}>Portada</span>
          <label className="flex items-center gap-2 py-2 text-sm text-neutral-300">
            <input
              type="checkbox"
              checked={draft.featured}
              onChange={(e) => setDraft({ ...draft, featured: e.target.checked })}
            />
            Destacado
          </label>
          <span className="text-[11px] text-neutral-600">
            Imagen de portada: pendiente de Multimedia
          </span>
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
              <span
                aria-label={
                  isLocaleComplete(t) ? "completo" : "incompleto"
                }
                className={`size-1.5 rounded-full ${
                  isLocaleComplete(t) ? "bg-green-500" : "bg-amber-500"
                }`}
              />
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={label}>Título</span>
          <input
            className={field}
            value={current.title}
            onChange={(e) => patchTranslation(active, { title: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={label}>Descripción</span>
          <textarea
            className={`${field} min-h-20`}
            value={current.description}
            onChange={(e) =>
              patchTranslation(active, { description: e.target.value })
            }
          />
          <span className="text-[11px] text-neutral-600">
            {current.description.length} caracteres · por debajo de 160 es lo
            que Google muestra entero
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={label}>Cuerpo</span>
          <BlockEditor
            blocks={current.body}
            onChange={(body: ContentBlock[]) =>
              patchTranslation(active, { body })
            }
          />
        </div>
      </section>
    </div>
  );
}
