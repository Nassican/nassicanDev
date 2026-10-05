import type { ContentStatus, IdeaStage } from "@nassican/db";
import { isPartialDate } from "@/lib/draft-fields";
import { addDays, mondayOf } from "@/lib/journal-draft";

/**
 * The editorial calendar: which column a piece belongs to, and where it falls
 * in a month.
 *
 * Pure and shared with the client. One board holds two kinds of thing — ideas,
 * which are not articles yet, and posts, which are — and the rule that keeps
 * them honest is that **once an idea has a post, the post decides**: its status
 * and its date, never the idea's stage.
 */

export type ColumnKey = "idea" | "research" | "writing" | "scheduled" | "published";

export const columns: { key: ColumnKey; label: string; hint: string }[] = [
  { key: "idea", label: "Ideas", hint: "Apuntadas, sin empezar" },
  { key: "research", label: "Investigando", hint: "Reuniendo material" },
  { key: "writing", label: "Escribiendo", hint: "Ya son un borrador en Blogs" },
  { key: "scheduled", label: "Programado", hint: "Con fecha de publicación futura" },
  { key: "published", label: "Publicado", hint: "En el sitio" },
];

export type BoardItem = {
  /** The idea's id, or the post's when there is no idea. */
  id: string;
  ideaId: string | null;
  postId: string | null;
  title: string;
  note: string | null;
  stage: IdeaStage | null;
  postStatus: ContentStatus | null;
  /** ISO instant of the post's publication, when it has one. */
  publishedAt: string | null;
  /** What the idea aimed at: partial date text. */
  targetDate: string | null;
  /**
   * Where it falls on the calendar, as a partial date: the local publication
   * day for a post that has one, the target otherwise.
   */
  when: string | null;
};

/** The column a piece belongs to, or null for what the board does not show. */
export function columnOf(item: BoardItem, now: Date): ColumnKey | null {
  if (!item.postId) return item.stage === "research" ? "research" : "idea";

  switch (item.postStatus) {
    case "draft":
      return "writing";
    case "scheduled":
      return "scheduled";
    case "published":
      // A future publication date is a schedule, whatever the status says.
      return item.publishedAt && new Date(item.publishedAt) > now ? "scheduled" : "published";
    default:
      return null; // archived
  }
}

/** A month as weeks, Monday first, padded with the neighbouring days. */
export function monthGrid(month: string): string[][] {
  const first = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const last = `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;

  const weeks: string[][] = [];
  for (let start = mondayOf(first); start <= last; start = addDays(start, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(start, i)));
  }
  return weeks;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/**
 * Where each piece goes in `month`: on its day, or — when only the month is
 * known — in a strip of its own. A target of «2026-11» is a real plan and has
 * to be visible in November, but pinning it to the 1st would make it look due
 * on a day nobody chose.
 */
export function placeInMonth(
  items: BoardItem[],
  month: string,
): { byDay: Map<string, BoardItem[]>; monthOnly: BoardItem[] } {
  const byDay = new Map<string, BoardItem[]>();
  const monthOnly: BoardItem[] = [];

  for (const item of items) {
    if (!item.when || !isPartialDate(item.when) || !item.when.startsWith(month)) continue;
    const day = item.when.slice(0, 10);
    if (day.length === 10) {
      byDay.set(day, [...(byDay.get(day) ?? []), item]);
    } else {
      monthOnly.push(item);
    }
  }

  return { byDay, monthOnly };
}

/**
 * Whether a piece is late: its target passed and it is not out. Judged at the
 * target's own precision — «2026-10» is late only once October is over.
 */
export function isLate(item: BoardItem, column: ColumnKey | null, today: string): boolean {
  if (column === "published" || column === "scheduled" || !item.targetDate) return false;
  const target = item.targetDate.slice(0, 10);
  return target < today.slice(0, target.length);
}

/** «2026-10» → «octubre de 2026». */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}

export function ideaProblems(fields: { title: string; targetDate: string }): string[] {
  const problems: string[] = [];
  if (!fields.title.trim()) problems.push("Falta el título de la idea.");
  if (fields.targetDate.trim() && !isPartialDate(fields.targetDate.trim())) {
    problems.push("La fecha objetivo tiene que ser 2026, 2026-11 o 2026-11-15.");
  }
  return problems;
}
