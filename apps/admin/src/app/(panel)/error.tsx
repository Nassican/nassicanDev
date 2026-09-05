"use client";

import { useEffect } from "react";

/**
 * What a failed query looks like instead of Next's default error page.
 *
 * It exists because the failures this panel actually sees are transient:
 * a dropped connection to Neon, a timeout on a cold compute. Those deserve a
 * button, not a stack trace - and `reset()` re-runs the server component,
 * which is exactly the retry the situation calls for.
 */
export default function PanelError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is the only thread back to the server-side log for a failure
    // whose message production deliberately hides.
    console.error("panel error", error.digest ?? "", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center">
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-600">
          No se pudo cargar
        </p>
        <h1 className="text-lg font-semibold tracking-tight">
          Algo falló al leer los datos
        </h1>
        <p className="mx-auto max-w-sm text-sm text-neutral-500">
          Suele ser la conexión con la base, que se cae sola y vuelve.
          Reintentar es casi siempre suficiente.
        </p>
        {error.digest ? (
          <p className="font-mono text-[10px] text-neutral-700">
            {error.digest}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={reset}
        className="rounded border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 transition-colors hover:border-neutral-500"
      >
        Reintentar
      </button>
    </div>
  );
}
