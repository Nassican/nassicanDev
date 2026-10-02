/**
 * Searching, filtering and sorting the content lists — one implementation for
 * articles, projects and pages.
 *
 * They want the same three things and differ only in where the title lives, so
 * the shape they have in common is passed in as a reader rather than copied
 * into three list pages that then drift.
 *
 * Pure: no database, no React. The filters live in the URL for the same reason
 * they do in Finanzas — a filtered view is a link you can keep, and the back
 * button behaves.
 */

export type ListSort = "date" | "title" | "status";
export type SortDirection = "asc" | "desc";

export type ListFilters = {
  search: string | null;
  /** `published` | `draft` | … or null for every state. */
  status: string | null;
  sort: ListSort;
  direction: SortDirection;
};

export const defaultListFilters: ListFilters = {
  search: null,
  status: null,
  sort: "date",
  direction: "desc",
};

/** What every list can say about one of its rows. */
export type ListFacets = {
  title: string;
  /** The slug or route — searched too, because it is often what you remember. */
  handle: string;
  status: string;
  /** ISO date, or null for something never published. */
  date: string | null;
};

const sorts: ListSort[] = ["date", "title", "status"];

export function listFiltersFromParams(
  params: Record<string, string | string[] | undefined>,
): ListFilters {
  const one = (key: string): string | null => {
    const value = params[key];
    const first = Array.isArray(value) ? value[0] : value;
    return first?.trim() ? first.trim() : null;
  };

  const sort = one("sort");
  const direction = one("dir");

  return {
    search: one("q"),
    status: one("status"),
    sort: sorts.includes(sort as ListSort) ? (sort as ListSort) : "date",
    direction: direction === "asc" ? "asc" : "desc",
  };
}

/** Only what differs from the default, so a clean list has a clean URL. */
export function listParams(filters: ListFilters): string {
  const params = new URLSearchParams();
  if (filters.search) params.set("q", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.sort !== "date") params.set("sort", filters.sort);
  if (filters.direction !== "desc") params.set("dir", filters.direction);
  const query = params.toString();
  return query ? `?${query}` : "";
}

/**
 * Accents are not a filter.
 *
 * Typing "paginas" must find "Páginas": on a Spanish site, requiring the
 * accent to search is requiring the user to spell what they are looking for
 * before they have found it.
 */
export function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Filters and sorts, returning the original rows so the caller keeps whatever
 * extra it needs to render.
 *
 * Sorting is stable and always falls back to the title, so two drafts with no
 * date do not swap places between renders.
 */
export function filterList<T>(
  items: T[],
  filters: ListFilters,
  read: (item: T) => ListFacets,
): T[] {
  const needle = filters.search ? fold(filters.search) : null;

  const kept = items.filter((item) => {
    const facets = read(item);
    if (filters.status && facets.status !== filters.status) return false;
    if (!needle) return true;
    return (
      fold(facets.title).includes(needle) || fold(facets.handle).includes(needle)
    );
  });

  const sign = filters.direction === "asc" ? 1 : -1;

  return [...kept].sort((a, b) => {
    const left = read(a);
    const right = read(b);

    if (filters.sort === "title") {
      return sign * left.title.localeCompare(right.title, "es");
    }
    if (filters.sort === "status") {
      const byStatus = left.status.localeCompare(right.status);
      if (byStatus !== 0) return sign * byStatus;
      return left.title.localeCompare(right.title, "es");
    }

    // Undated rows are new drafts: they belong at the top of a newest-first
    // list, not silently at the bottom.
    const l = left.date ? Date.parse(left.date) : Number.POSITIVE_INFINITY;
    const r = right.date ? Date.parse(right.date) : Number.POSITIVE_INFINITY;
    if (l !== r) return sign * (l - r);
    return left.title.localeCompare(right.title, "es");
  });
}
