import { isPartialDate, parseNumber } from "@/lib/draft-fields";

/**
 * Editing one field from a list row: what each field accepts.
 *
 * The same readers the forms use — `parseNumber` reads «34.225» as thirty-four
 * thousand, the bug the games module already paid for once — so a value typed
 * in a row and the same value typed in the editor can never be stored apart.
 */

export type QuickKind = "money" | "decimal" | "integer" | "date";

export type QuickParsed = { ok: true; value: number | string | null } | { ok: false; message: string };

/** Blank is «no lo sé», never zero: the rule every library in the panel keeps. */
export function parseQuick(kind: QuickKind, raw: string): QuickParsed {
  const text = raw.trim();
  if (!text) return { ok: true, value: null };

  if (kind === "date") {
    return isPartialDate(text)
      ? { ok: true, value: text }
      : { ok: false, message: `«${text}» no es una fecha: 2024, 2024-08 o 2024-08-13.` };
  }

  const value = parseNumber(text);
  if (value === null || value < 0) return { ok: false, message: `«${text}» no es un número válido.` };
  if (kind === "integer" && !Number.isInteger(value)) {
    return { ok: false, message: `«${text}» tiene que ser un número entero.` };
  }
  return { ok: true, value };
}

/** How a stored value is shown back in its field. */
export function quickText(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value);
}
