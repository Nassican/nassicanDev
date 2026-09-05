"use client";

import { useState } from "react";

/**
 * Paging over a list that is already in hand.
 *
 * These lists arrive bounded from the server - the last N runs, the last N
 * audit entries - so paging is slicing, not fetching. At this distance from the
 * database, going back for page two would cost a round trip to show rows we
 * already had.
 *
 * The page is clamped while rendering rather than corrected in an effect: when
 * the list shrinks under you - a sync finished, a row was deleted - an effect
 * would render the empty page once before fixing it.
 */
export function usePage<T>(items: T[], perPage: number) {
  const [requested, setPage] = useState(0);

  const pages = Math.max(1, Math.ceil(items.length / perPage));
  const page = Math.min(Math.max(requested, 0), pages - 1);
  const from = page * perPage;

  return {
    rows: items.slice(from, from + perPage),
    page,
    pages,
    setPage,
    from,
    total: items.length,
  };
}

export function Pager({
  page,
  pages,
  from,
  shown,
  total,
  label,
  onPage,
}: {
  page: number;
  pages: number;
  from: number;
  shown: number;
  total: number;
  /** Plural noun for the things being paged: "entradas", "ejecuciones". */
  label: string;
  onPage: (page: number) => void;
}) {
  if (total === 0) return null;

  const button =
    "rounded border border-neutral-800 px-2 py-0.5 text-xs text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-200 disabled:opacity-30 disabled:hover:border-neutral-800";

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="font-mono text-[10px] text-neutral-600">
        {from + 1}–{from + shown} de {total} {label}
      </p>

      {pages > 1 ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={button}
            disabled={page === 0}
            onClick={() => onPage(page - 1)}
            aria-label="Página anterior"
          >
            ‹
          </button>
          <span className="px-1 font-mono text-[10px] tabular-nums text-neutral-500">
            {page + 1} / {pages}
          </span>
          <button
            type="button"
            className={button}
            disabled={page >= pages - 1}
            onClick={() => onPage(page + 1)}
            aria-label="Página siguiente"
          >
            ›
          </button>
        </div>
      ) : null}
    </div>
  );
}
