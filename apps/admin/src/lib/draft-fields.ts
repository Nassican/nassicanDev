/**
 * Reading the fields a hand-filled form has, for every module that has one.
 *
 * Extracted when Libros arrived, because the alternative was a second copy of
 * `parseNumber` — and the first copy had already shipped with a bug that existed
 * in two places at once and could be fixed in only one.
 *
 * Pure, and imported by client components, so nothing here may reach Prisma.
 */

/**
 * A number as it is written here, which is not how `Number()` reads one.
 *
 * In Colombia the dot groups thousands and the comma is the decimal mark, so
 * `34.225` is thirty-four thousand and not thirty-four point something. Feeding
 * it straight to `Number()` returned `34.225` and would have filed a 34.225 peso
 * purchase as costing 34 — silently, and in the direction that makes a backlog
 * look cheap. Worse, these modules *print* money in es-CO, so copying a figure
 * off the screen back into the field was the likeliest way to hit it.
 *
 *   "34.225"    -> 34225     every dot grouping three digits is a separator
 *   "1.234,56"  -> 1234.56   a comma present means the dots are separators
 *   "12,5"      -> 12.5
 *   "12.5"      -> 12.5      one or two digits after the dot: a decimal mark
 *
 * `"12.500"` therefore reads as twelve thousand five hundred, not twelve and a
 * half. For a price that is right; for a quantity it is the wrong guess, which
 * is why those fields suggest a comma.
 *
 * `null` for an empty field, because "not recorded" is not zero: zero hours is a
 * game opened and quit, and zero price would claim it was free.
 */
export function parseNumber(value: string): number | null {
  const cleaned = value.replace(/[^\d.,-]/g, "").trim();
  if (!cleaned) return null;

  let normalised: string;
  if (cleaned.includes(",")) {
    normalised = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    normalised = cleaned.replace(/\./g, "");
  } else {
    normalised = cleaned;
  }

  const n = Number(normalised);
  return Number.isFinite(n) ? n : null;
}

export function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * A partial date as it was known: "2024", "2024-08" or "2024-08-13".
 *
 * The same decision as the experience and education dates, and for the same
 * reason — you remember reading something in 2022 without remembering the day,
 * and a parser would either reject that or invent the first of January.
 */
const PARTIAL_DATE = /^(\d{4})(?:-(\d{2})(?:-(\d{2})(?:T(\d{2}):(\d{2}))?)?)?$/;

/**
 * A partial date, and — only on a full day — an optional time:
 * "2024-08-13T21:30". A time on «2024-08» would be a precision about the hour
 * with none about the day, so it is not a shape this accepts.
 *
 * The parts are checked for being a real calendar date, not only for having
 * the right number of digits: «2024-02-30» is eight digits and no day.
 */
export function isPartialDate(value: string): boolean {
  const match = PARTIAL_DATE.exec(value.trim());
  if (!match) return false;

  const [, , month, day, hour, minute] = match.map(Number);
  if (match[2] && (month < 1 || month > 12)) return false;
  if (match[3]) {
    const days = new Date(Date.UTC(Number(match[1]), month, 0)).getUTCDate();
    if (day < 1 || day > days) return false;
  }
  if (match[4] && (hour > 23 || minute > 59)) return false;
  return true;
}

/** True for a full day — the only shape a time can be added to. */
export function isFullDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && isPartialDate(value);
}

/** "2024-08-13T21:30" → { date: "2024-08-13", time: "21:30" }. */
export function splitDateTime(value: string): { date: string; time: string } {
  const [date, time = ""] = value.trim().split("T");
  return { date, time };
}

/**
 * The inverse, and the one place the rule lives: a time survives only next to a
 * full day. Typing «2024-08» over «2024-08-13T21:30» drops the hour rather than
 * storing a time against a month.
 */
export function joinDateTime(date: string, time: string): string {
  const day = date.trim();
  return time && isFullDay(day) ? `${day}T${time}` : day;
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

/**
 * How a partial date reads in a list: «2024», «ago 2024», «13 ago 2024»,
 * «13 ago 2024, 21:30». Built by hand rather than through `Date`, which would
 * invent the missing day and then move it across midnight by timezone.
 */
export function formatPartialDate(value: string | null | undefined): string {
  if (!value) return "";
  const match = PARTIAL_DATE.exec(value.trim());
  if (!match) return value;

  const [, year, month, day, hour, minute] = match;
  if (!month) return year;
  const name = MONTHS[Number(month) - 1] ?? month;
  if (!day) return `${name} ${year}`;
  const date = `${Number(day)} ${name} ${year}`;
  return hour ? `${date}, ${hour}:${minute}` : date;
}

export const PARTIAL_DATE_HINT = "2024 · 2024-08 · 2024-08-13";

/**
 * The problems shared by anything with a price, a date and a quantity.
 *
 * Returns every one rather than the first: a form that reveals its objections
 * one at a time makes you submit four times to learn four things.
 */
export function fieldProblems(
  fields: { label: string; value: string; kind: "date" | "amount" }[],
): string[] {
  const problems: string[] = [];

  for (const { label, value, kind } of fields) {
    const trimmed = value.trim();
    if (!trimmed) continue;

    if (kind === "date" && !isPartialDate(trimmed)) {
      problems.push(`La fecha de ${label} tiene que ser ${PARTIAL_DATE_HINT}.`);
      continue;
    }

    if (kind === "amount") {
      const n = parseNumber(trimmed);
      if (n === null || n < 0) problems.push(`${label} tiene que ser un número positivo.`);
    }
  }

  return problems;
}
