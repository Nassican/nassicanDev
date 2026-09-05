import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "No encontrado" };

/**
 * Rendered outside the `(panel)` group, so it never runs `requireUser()`.
 *
 * That is deliberate: a wrong address should answer the same way whether or
 * not there is a session, and rendering the module tree around a 404 would
 * tell anyone who guessed a URL what the panel is made of.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-600">
          Error 404
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Esta dirección no existe
        </h1>
        <p className="mx-auto max-w-sm text-sm text-neutral-500">
          El módulo que buscas puede haber cambiado de sitio, o todavía no
          existe. El menú del panel muestra los que sí.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link
          href="/"
          className="rounded border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 transition-colors hover:border-neutral-500"
        >
          Volver al panel
        </Link>
        <a
          href="https://www.nassican.com"
          target="_blank"
          rel="noreferrer"
          className="rounded border border-neutral-800 px-3 py-1.5 text-sm text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-200"
        >
          Ver el sitio público
        </a>
      </div>
    </main>
  );
}
