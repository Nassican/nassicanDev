"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BsSearch, BsX } from "react-icons/bs";
import Toast from "@/components/Toast";
import { fold } from "@/lib/list-filters";
import type { SkillsSummary, TechnologyRow } from "@/lib/skills";
import type { ActionResult, IconChoice } from "@/app/(panel)/habilidades/actions";

const field =
  "rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none";
const labelClass = "font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500";

/**
 * Technologies and their brand icons.
 *
 * **The whole module exists because one colour per technology was never enough.**
 * The public site drew every icon from `react-icons/si`, which is a single path,
 * and tinted it with the stored hex — so Vite, whose mark is a cyan-to-purple
 * gradient over a yellow bolt, came out entirely yellow. Devicon ships an
 * `original` variant that *is* the brand logo, gradients and all, and a `plain`
 * one for when a flat single colour is what the layout wants.
 *
 * So there are two things to set per technology and they do different jobs: the
 * **icon** is the drawing, and the **hex** is only the chip's tint and glow
 * around it. Picking a colour icon stops the hex mattering to the glyph.
 */
export default function SkillsModule({
  summary,
  actions,
}: {
  summary: SkillsSummary;
  actions: {
    find: (query: string) => Promise<IconChoice[]>;
    preview: (
      name: string,
      variant: string,
      key: string,
    ) => Promise<{ ok: true; svg: string } | { ok: false; message: string }>;
    choose: (id: string, key: string, name: string, variant: string) => Promise<ActionResult>;
    clear: (id: string) => Promise<ActionResult>;
    setColor: (id: string, hex: string) => Promise<ActionResult>;
  };
}) {
  const router = useRouter();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [picking, setPicking] = useState<TechnologyRow | null>(null);
  const [query, setQuery] = useState("");

  function run(action: () => Promise<ActionResult>, onOk?: () => void) {
    setResult(null);
    startTransition(async () => {
      const outcome = await action();
      setResult(outcome);
      if (outcome.ok) {
        onOk?.();
        router.refresh();
      }
    });
  }

  const shown = query
    ? summary.technologies.filter((t) => fold(t.name).includes(fold(query)))
    : summary.technologies;

  const missing = summary.technologies.length - summary.withIcon;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Habilidades</h1>
          <p className="mt-1 text-sm text-neutral-500">
            El icono es el dibujo; el color solo tiñe la ficha a su alrededor. Con
            la variante a color, el logo sale con sus propios colores y el hex deja
            de afectarlo.
          </p>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500">
          {summary.withIcon} de {summary.technologies.length} con logo
          {missing > 0 ? ` · ${missing} sin elegir` : ""}
        </span>
      </header>

      {summary.technologies.length > 6 ? (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setQuery("")}
          placeholder="Buscar una tecnología…"
          className={`${field} max-w-sm`}
        />
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((tech) => (
          <li
            key={tech.id}
            className="flex items-center gap-3 rounded-lg border border-neutral-900 p-3"
          >
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded"
              style={{
                // The tint, not the glyph: a colour icon ignores this entirely.
                backgroundColor: `${tech.hex}14`,
                color: tech.hex,
              }}
            >
              <TechIcon tech={tech} />
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-neutral-200">{tech.name}</span>
              <span className="block truncate font-mono text-[10px] text-neutral-600">
                {tech.deviconName
                  ? `${tech.deviconName}-${tech.deviconVariant}`
                  : "sin logo · react-icons monocolor"}
                {tech.uses > 0 ? ` · ${tech.uses} usos` : ""}
              </span>
            </span>

            <span className="flex shrink-0 items-center gap-1">
              <input
                type="color"
                aria-label={`Color de ${tech.name}`}
                defaultValue={tech.hex}
                disabled={pending}
                onBlur={(e) => {
                  if (e.target.value.toLowerCase() !== tech.hex.toLowerCase()) {
                    run(() => actions.setColor(tech.id, e.target.value));
                  }
                }}
                className="size-7 cursor-pointer rounded border border-neutral-800 bg-transparent"
              />
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setPicking(tech);
                  setQuery("");
                }}
                className="rounded border border-neutral-800 px-2 py-1 text-[11px] text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-200"
              >
                {tech.iconSvg ? "Cambiar" : "Elegir"}
              </button>
            </span>
          </li>
        ))}
      </ul>

      {summary.groups.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className={labelClass}>Grupos</h2>
          <ul className="flex flex-col gap-1 text-[11px] text-neutral-600">
            {summary.groups.map((group) => (
              <li key={group.id}>
                <span className="text-neutral-400">
                  {group.labels.find((l) => l.locale === "es")?.label ?? group.key}
                </span>
                {" · "}
                {group.members.length}{" "}
                {group.members.length === 1 ? "tecnología" : "tecnologías"}
                {group.labels.length < 2 ? " · falta traducción" : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {picking ? (
        <IconPicker
          tech={picking}
          pending={pending}
          actions={actions}
          onClose={() => setPicking(null)}
          onChosen={(name, variant) =>
            run(
              () => actions.choose(picking.id, picking.key, name, variant),
              () => setPicking(null),
            )
          }
          onClear={() => run(() => actions.clear(picking.id), () => setPicking(null))}
        />
      ) : null}

      <Toast result={result} onDismiss={() => setResult(null)} />
    </div>
  );
}

/**
 * The stored markup when there is one, and nothing when there is not.
 *
 * `dangerouslySetInnerHTML` with a name that earns it: the markup went through
 * `sanitiseSvg` before it was stored, the source is devicon's CDN and only an
 * operator can put it there. Rendering it as a string is the only way to inline
 * an SVG, and inlining is what lets its gradients work.
 */
function TechIcon({ tech }: { tech: TechnologyRow }) {
  if (!tech.iconSvg) {
    return (
      <span aria-hidden className="font-mono text-[10px] uppercase">
        {tech.name.slice(0, 2)}
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className="size-6"
      dangerouslySetInnerHTML={{ __html: tech.iconSvg }}
    />
  );
}

/**
 * Search devicon, see the real logo, then commit.
 *
 * The preview is not decoration: `original` and `plain` differ in exactly the way
 * that matters here, and no label can tell you whether a given brand's coloured
 * version looks right at 24 pixels.
 */
function IconPicker({
  tech,
  pending,
  actions,
  onClose,
  onChosen,
  onClear,
}: {
  tech: TechnologyRow;
  pending: boolean;
  actions: {
    find: (query: string) => Promise<IconChoice[]>;
    preview: (
      name: string,
      variant: string,
      key: string,
    ) => Promise<{ ok: true; svg: string } | { ok: false; message: string }>;
  };
  onClose: () => void;
  onChosen: (name: string, variant: string) => void;
  onClear: () => void;
}) {
  const [term, setTerm] = useState(tech.name);
  const [hits, setHits] = useState<IconChoice[] | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [searching, startSearch] = useTransition();

  function search(value: string) {
    startSearch(async () => {
      const found = await actions.find(value);
      setHits(found);

      /*
       * Previews are fetched for the first few hits only. Twenty logos is twenty
       * requests, and the list is scanned by name long before it is scanned by
       * picture.
       */
      const first = found.slice(0, 8);
      const loaded: Record<string, string> = {};
      for (const hit of first) {
        const variant = hit.variants.includes("original")
          ? "original"
          : hit.variants[0];
        if (!variant) continue;
        const result = await actions.preview(hit.name, variant, tech.key);
        if (result.ok) loaded[`${hit.name}-${variant}`] = result.svg;
      }
      setPreviews(loaded);
    });
  }

  return (
    <div className="fixed inset-0 z-[85] flex items-start justify-center p-4 pt-[8vh]">
      <div aria-hidden className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Elegir el logo de ${tech.name}`}
        className="relative flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 shadow-lg"
      >
        <header className="flex items-center gap-2 border-b border-neutral-900 p-3">
          <h2 className="flex-1 text-sm font-semibold">Logo de {tech.name}</h2>
          {tech.iconSvg ? (
            <button
              type="button"
              disabled={pending}
              onClick={onClear}
              className="rounded border border-neutral-800 px-2 py-1 text-[11px] text-neutral-400 transition-colors hover:border-red-800 hover:text-red-400"
            >
              Quitar
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="rounded p-1 text-neutral-500 hover:text-neutral-200"
          >
            <BsX className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <div className="flex gap-2 border-b border-neutral-900 p-3">
          <input
            value={term}
            autoFocus
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search(term)}
            placeholder="vite, tailwind, postgres…"
            className={`${field} flex-1`}
          />
          <button
            type="button"
            disabled={searching}
            onClick={() => search(term)}
            className="inline-flex items-center gap-1.5 rounded border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 transition-colors hover:border-neutral-500 disabled:opacity-50"
          >
            <BsSearch className="h-3.5 w-3.5" aria-hidden />
            {searching ? "Buscando…" : "Buscar"}
          </button>
        </div>

        <div className="min-h-32 flex-1 overflow-y-auto p-3">
          {hits === null ? (
            <p className="py-8 text-center text-sm text-neutral-500">
              Busca el nombre de la tecnología. Son 578 logos, 559 con versión a
              color.
            </p>
          ) : hits.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">
              Nada coincide con «{term}».
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {hits.map((hit) => (
                <li key={hit.name} className="flex items-center gap-3 rounded px-2 py-2">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded bg-neutral-900">
                    {previews[
                      `${hit.name}-${hit.variants.includes("original") ? "original" : hit.variants[0]}`
                    ] ? (
                      <span
                        aria-hidden
                        className="size-6"
                        dangerouslySetInnerHTML={{
                          __html:
                            previews[
                              `${hit.name}-${hit.variants.includes("original") ? "original" : hit.variants[0]}`
                            ],
                        }}
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="size-3 rounded-full"
                        style={{ backgroundColor: hit.color }}
                      />
                    )}
                  </span>

                  <span className="min-w-0 flex-1 truncate text-sm text-neutral-300">
                    {hit.name}
                  </span>

                  <span className="flex shrink-0 gap-1">
                    {hit.variants.map((variant) => (
                      <button
                        key={variant}
                        type="button"
                        disabled={pending}
                        onClick={() => onChosen(hit.name, variant)}
                        title={
                          variant === "original"
                            ? "El logo con sus colores de marca"
                            : "Una sola forma, se tiñe con el color de la ficha"
                        }
                        className={`rounded border px-2 py-1 text-[11px] transition-colors ${
                          variant === "original"
                            ? "border-green-800 bg-green-950/40 text-green-300 hover:border-green-600"
                            : "border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200"
                        }`}
                      >
                        {variant === "original" ? "a color" : variant}
                      </button>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
