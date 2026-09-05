"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { localeNames, type ContentBlock, type Locale } from "@nassican/shared";
import BlockEditor from "@/components/BlockEditor";
import CoverPicker from "@/components/CoverPicker";
import {
  isLocaleComplete,
  type ProjectDraft,
  type ProjectTranslationDraft,
} from "@/lib/project-draft";
import type { ActionResult } from "@/app/(panel)/contenido/proyectos/actions";

const field =
  "w-full rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none";

const label =
  "font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500";

const button =
  "rounded border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export default function ProjectEditor({
  initial,
  technologies,
  actions,
}: {
  initial: ProjectDraft;
  technologies: { key: string; name: string; hex: string }[];
  actions: {
    save: (draft: ProjectDraft) => Promise<ActionResult>;
    publish: (draft: ProjectDraft) => Promise<ActionResult>;
    unpublish: (id: string) => Promise<ActionResult>;
    remove: (id: string) => Promise<void>;
  };
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<ProjectDraft>(initial);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState<Locale>(draft.translations[0].locale);

  function patch(locale: Locale, next: Partial<ProjectTranslationDraft>) {
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

  function toggleTech(key: string) {
    setDraft((d) => ({
      ...d,
      stack: d.stack.includes(key)
        ? d.stack.filter((k) => k !== key)
        : [...d.stack, key],
    }));
  }

  const current = draft.translations.find((t) => t.locale === active)!;
  const published = draft.status === "published";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">
            {draft.title.trim() || "Proyecto sin nombre"}
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
          {draft.comingSoon ? (
            <span className="rounded bg-amber-950 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-amber-400">
              sin caso de estudio
            </span>
          ) : null}
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
              if (!confirm("¿Eliminar este proyecto? No se puede deshacer.")) return;
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

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <span className={label}>Nombre</span>
          <input
            className={field}
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
          <span className="text-[11px] text-neutral-600">
            Nombre propio: igual en los dos idiomas
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={label}>Slug</span>
          <input
            className={field}
            value={draft.slug}
            onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
          />
          <span className="text-[11px] text-neutral-600">
            nassican.com/projects/{draft.slug || "…"}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={label}>Año mostrado</span>
          <input
            className={field}
            value={draft.yearLabel}
            placeholder="2025 o 2023 – 2024"
            onChange={(e) => setDraft({ ...draft, yearLabel: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={label}>Fecha (orden y sitemap)</span>
          <input
            type="date"
            className={field}
            value={draft.date}
            onChange={(e) => setDraft({ ...draft, date: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={label}>Demo</span>
          <input
            className={field}
            value={draft.demoUrl}
            placeholder="https://…"
            onChange={(e) => setDraft({ ...draft, demoUrl: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={label}>Repositorio</span>
          <input
            className={field}
            value={draft.repoUrl}
            placeholder="Vacío si es privado"
            onChange={(e) => setDraft({ ...draft, repoUrl: e.target.value })}
          />
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={draft.featured}
            onChange={(e) => setDraft({ ...draft, featured: e.target.checked })}
          />
          Destacado en la portada
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={draft.comingSoon}
            onChange={(e) =>
              setDraft({ ...draft, comingSoon: e.target.checked })
            }
          />
          Caso de estudio pendiente
        </label>
      </section>

      <section className="flex flex-col gap-2">
        <span className={label}>Portada</span>
        <CoverPicker
          url={draft.coverUrl}
          onChange={(media) =>
            setDraft({
              ...draft,
              coverMediaId: media?.id ?? null,
              coverUrl: media?.url ?? null,
            })
          }
        />
      </section>

      <section className="flex flex-col gap-2">
        <span className={label}>Stack ({draft.stack.length})</span>
        <div className="flex flex-wrap gap-1.5">
          {technologies.map((tech) => {
            const on = draft.stack.includes(tech.key);
            return (
              <button
                key={tech.key}
                type="button"
                onClick={() => toggleTech(tech.key)}
                aria-pressed={on}
                className={`rounded border px-2 py-1 text-xs transition-colors ${
                  on
                    ? "border-neutral-500 bg-neutral-800 text-neutral-100"
                    : "border-neutral-800 text-neutral-500 hover:border-neutral-600"
                }`}
              >
                <span
                  aria-hidden
                  className="mr-1.5 inline-block size-2 rounded-full align-middle"
                  style={{ backgroundColor: tech.hex }}
                />
                {tech.name}
              </button>
            );
          })}
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
                aria-label={isLocaleComplete(t) ? "completo" : "incompleto"}
                className={`size-1.5 rounded-full ${
                  isLocaleComplete(t) ? "bg-green-500" : "bg-amber-500"
                }`}
              />
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={label}>Descripción de una línea</span>
          <input
            className={field}
            value={current.tagline}
            onChange={(e) => patch(active, { tagline: e.target.value })}
          />
          <span className="text-[11px] text-neutral-600">
            Lo único obligatorio. Se usa en tarjetas, metadatos y la imagen de
            Open Graph
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={label}>Resumen</span>
          <textarea
            className={`${field} min-h-20`}
            value={current.summary}
            onChange={(e) => patch(active, { summary: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={label}>Rol</span>
          <input
            className={field}
            value={current.role}
            onChange={(e) => patch(active, { role: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={label}>Puntos destacados</span>
          <textarea
            className={`${field} min-h-24`}
            value={current.highlights.join("\n")}
            placeholder="Uno por línea"
            onChange={(e) =>
              patch(active, { highlights: e.target.value.split("\n") })
            }
          />
          <span className="text-[11px] text-neutral-600">
            Uno por línea · barra lateral del caso de estudio
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={label}>Caso de estudio</span>
          <BlockEditor
            blocks={current.body}
            onChange={(body: ContentBlock[]) => patch(active, { body })}
          />
        </div>
      </section>
    </div>
  );
}
