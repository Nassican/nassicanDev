import type { Metadata } from "next";
import Link from "next/link";
import { locales } from "@nassican/shared";
import { incompleteLocales, listPages } from "@/lib/pages";
import { createPage } from "./actions";

export const metadata: Metadata = { title: "Páginas" };

export default async function PaginasPage() {
  const pages = await listPages();
  const system = pages.filter((p) => p.kind === "system");
  const custom = pages.filter((p) => p.kind === "custom");

  function row(page: (typeof pages)[number]) {
    const missing = incompleteLocales(page, locales);
    const title =
      page.translations.find((t) => t.title.trim())?.title ?? page.route;

    return (
      <li key={page.id}>
        <Link
          href={`/contenido/paginas/${page.id}`}
          className="flex flex-wrap items-center gap-x-4 gap-y-2 px-2 py-3 transition-colors hover:bg-neutral-900/60"
        >
          <span className="min-w-0 flex-1 truncate text-sm">{title}</span>
          <span className="font-mono text-[11px] text-neutral-600">
            {page.route}
          </span>
          {page.translations.some((t) => t.noindex) ? (
            <span className="rounded bg-amber-950 px-2 py-0.5 font-mono text-[10px] uppercase text-amber-400">
              noindex
            </span>
          ) : null}
          {missing.length > 0 ? (
            <span className="rounded bg-amber-950 px-2 py-0.5 font-mono text-[10px] uppercase text-amber-400">
              falta {missing.join(", ")}
            </span>
          ) : null}
          <span
            className={`w-24 shrink-0 rounded px-2 py-0.5 text-center font-mono text-[10px] uppercase tracking-[0.1em] ${
              page.kind === "system"
                ? "bg-blue-950 text-blue-300"
                : page.status === "published"
                  ? "bg-green-950 text-green-400"
                  : "bg-neutral-900 text-neutral-500"
            }`}
          >
            {page.kind === "system"
              ? "del sitio"
              : page.status === "published"
                ? "publicada"
                : "borrador"}
          </span>
        </Link>
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Páginas</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Metadatos de las rutas que ya existen, y páginas creadas aquí.
          </p>
        </div>
        <form action={createPage}>
          <button
            type="submit"
            className="rounded border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 transition-colors hover:border-neutral-500"
          >
            Nueva página
          </button>
        </form>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">
          Rutas del sitio · solo SEO
        </h2>
        <ul className="flex flex-col divide-y divide-neutral-900 border-y border-neutral-900">
          {system.map(row)}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">
          Páginas creadas aquí
        </h2>
        {custom.length === 0 ? (
          <p className="rounded border border-dashed border-neutral-800 px-6 py-10 text-center text-sm text-neutral-500">
            Ninguna todavía. Una página nueva se sirve en su ruta en cuanto se
            publica.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-900 border-y border-neutral-900">
            {custom.map(row)}
          </ul>
        )}
      </section>
    </div>
  );
}
