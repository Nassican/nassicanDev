"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  listParams,
  type ListFilters as Filters,
  type ListSort,
} from "@/lib/list-filters";

const field =
  "rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none";
const ghost =
  "rounded border border-neutral-800 px-2.5 py-1.5 text-xs text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-200";

const sortLabels: Record<ListSort, string> = {
  date: "Fecha",
  title: "Título",
  status: "Estado",
};

/**
 * One filter bar for articles, projects and pages.
 *
 * State lives in the URL, not in the component: a filtered list is then a link
 * worth keeping, the back button behaves, and reloading does not drop what you
 * were looking at.
 */
export default function ListFilters({
  base,
  filters,
  statuses,
  total,
  shown,
}: {
  /** The list's own path, e.g. `/contenido/blogs`. */
  base: string;
  filters: Filters;
  /** The states this list actually has, with their labels. */
  statuses: { value: string; label: string }[];
  total: number;
  shown: number;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(filters.search ?? "");

  const go = (next: Partial<Filters>) =>
    router.push(`${base}${listParams({ ...filters, ...next })}`);

  const filtered = shown !== total;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${field} min-w-[12rem] flex-1`}
          value={search}
          placeholder="Buscar por título o identificador…"
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") go({ search: search.trim() || null });
            // Escape clears without having to select and delete first.
            if (e.key === "Escape") {
              setSearch("");
              go({ search: null });
            }
          }}
          onBlur={() => {
            if ((filters.search ?? "") !== search.trim()) {
              go({ search: search.trim() || null });
            }
          }}
        />

        <select
          className={field}
          value={filters.status ?? ""}
          onChange={(e) => go({ status: e.target.value || null })}
        >
          <option value="">Todos los estados</option>
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <select
          className={field}
          value={filters.sort}
          onChange={(e) => go({ sort: e.target.value as ListSort })}
        >
          {(Object.keys(sortLabels) as ListSort[]).map((key) => (
            <option key={key} value={key}>
              {sortLabels[key]}
            </option>
          ))}
        </select>

        <button
          type="button"
          className={ghost}
          aria-label={
            filters.direction === "desc" ? "Orden descendente" : "Orden ascendente"
          }
          onClick={() =>
            go({ direction: filters.direction === "desc" ? "asc" : "desc" })
          }
        >
          {filters.direction === "desc" ? "↓" : "↑"}
        </button>

        {filtered ? (
          <button
            type="button"
            className={ghost}
            onClick={() => {
              setSearch("");
              router.push(base);
            }}
          >
            Limpiar
          </button>
        ) : null}
      </div>

      {/* Said out loud, because a list that silently hides rows is a list that
          makes you think you lost something. */}
      {filtered ? (
        <p className="text-[11px] text-neutral-600">
          {shown} de {total} · hay {total - shown} fuera del filtro
        </p>
      ) : null}
    </div>
  );
}
