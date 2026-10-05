import { locales, type Locale } from "@nassican/shared";
import { fold } from "@/lib/list-filters";

/**
 * What the library shows, decided without a database: which folder, which
 * filter, which order, which page. Pure, so the URL can carry it and the test
 * can check it.
 */

export const MEDIA_PAGE_SIZE = 48;

export type MediaFilter = "all" | "missing-alt" | "in-use" | "unused";
export type MediaSort = "recent" | "oldest" | "largest" | "smallest";
export type MediaViewMode = "grid" | "list";
/** A folder id, every image, or the ones filed nowhere. */
export type FolderScope = "all" | "none" | string;

export type LibraryState = {
  folder: FolderScope;
  filter: MediaFilter;
  sort: MediaSort;
  view: MediaViewMode;
  q: string;
  /** Zero-based. */
  page: number;
};

/** The fields the library reads off an image, and nothing else. */
export type LibraryRow = {
  id: string;
  url: string;
  sizeBytes: number;
  createdAt: string;
  folderId: string | null;
  text: Record<Locale, { alt: string; caption: string }>;
  usage: { label: string }[];
};

const filters: MediaFilter[] = ["all", "missing-alt", "in-use", "unused"];
const sorts: MediaSort[] = ["recent", "oldest", "largest", "smallest"];

/** Reads the address, falling back to defaults for anything unknown. */
export function parseLibraryState(params: { get(name: string): string | null }): LibraryState {
  const pick = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T =>
    value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
  const page = Number.parseInt(params.get("pagina") ?? "", 10);
  const folder = params.get("carpeta");
  return {
    folder: folder === "sin" ? "none" : folder || "all",
    filter: pick(params.get("filtro"), filters, "all"),
    sort: pick(params.get("orden"), sorts, "recent"),
    view: pick(params.get("vista"), ["grid", "list"] as const, "grid"),
    q: params.get("q") ?? "",
    page: Number.isFinite(page) && page > 1 ? page - 1 : 0,
  };
}

/** The address for a state, leaving defaults out so a plain library is a plain URL. */
export function libraryQuery(state: LibraryState): string {
  const params = new URLSearchParams();
  if (state.folder !== "all") params.set("carpeta", state.folder === "none" ? "sin" : state.folder);
  if (state.filter !== "all") params.set("filtro", state.filter);
  if (state.sort !== "recent") params.set("orden", state.sort);
  if (state.view !== "grid") params.set("vista", state.view);
  if (state.q.trim()) params.set("q", state.q);
  if (state.page > 0) params.set("pagina", String(state.page + 1));
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function missingAlt(row: Pick<LibraryRow, "text">): Locale[] {
  return locales.filter((l) => !row.text[l]?.alt.trim());
}

export function inFolder(row: Pick<LibraryRow, "folderId">, folder: FolderScope): boolean {
  if (folder === "all") return true;
  if (folder === "none") return row.folderId === null;
  return row.folderId === folder;
}

export function passesFilter(row: LibraryRow, filter: MediaFilter): boolean {
  if (filter === "missing-alt") return missingAlt(row).length > 0;
  if (filter === "in-use") return row.usage.length > 0;
  if (filter === "unused") return row.usage.length === 0;
  return true;
}

/**
 * The images to show, in order: folder, then filter, then search, then sort.
 * Search reads alt text and captions in both languages, where the image is
 * used and its address, without accents — «diseno» finds «Diseño».
 */
export function selectMedia<T extends LibraryRow>(rows: T[], state: LibraryState): T[] {
  const needle = fold(state.q);
  const matches = rows.filter((row) => {
    if (!inFolder(row, state.folder) || !passesFilter(row, state.filter)) return false;
    if (!needle) return true;
    const haystack = [
      row.url,
      ...locales.flatMap((l) => [row.text[l]?.alt ?? "", row.text[l]?.caption ?? ""]),
      ...row.usage.map((u) => u.label),
    ].join(" ");
    return fold(haystack).includes(needle);
  });

  const byDate = (a: T, b: T) => b.createdAt.localeCompare(a.createdAt);
  return matches.sort((a, b) => {
    if (state.sort === "oldest") return -byDate(a, b);
    if (state.sort === "largest") return b.sizeBytes - a.sizeBytes || byDate(a, b);
    if (state.sort === "smallest") return a.sizeBytes - b.sizeBytes || byDate(a, b);
    return byDate(a, b);
  });
}

/** One page of the selection, with the page clamped to what exists. */
export function pageOf<T>(rows: T[], page: number, size = MEDIA_PAGE_SIZE): { rows: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const clamped = Math.min(Math.max(page, 0), pages - 1);
  return { rows: rows.slice(clamped * size, clamped * size + size), page: clamped, pages };
}

export function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}
