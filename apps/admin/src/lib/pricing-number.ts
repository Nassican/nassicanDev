import { parseNumber } from "./draft-fields";

/** Group the editable integer without losing a trailing comma, zeros or a minus. */
export function pricingNumberEdit(raw: string, caret = raw.length) {
  const clean = raw.replace(/[^\d,-]/g, "");
  const negative = clean.startsWith("-") ? "-" : "";
  const [integer = "", ...decimals] = clean.replace(/-/g, "").split(",");
  const digits = integer.replace(/^0+(?=\d)/, "");
  const value =
    negative +
    digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".") +
    (decimals.length ? `,${decimals.join("")}` : "");
  const meaningful = raw.slice(0, caret).replace(/[^\d,-]/g, "").length;
  let position = 0;
  let seen = 0;
  while (position < value.length && seen < meaningful) {
    if (value[position] !== ".") seen++;
    position++;
  }
  return { value, caret: position };
}

/** Pasted dot decimals retain their value; Colombian grouped amounts also work. */
export function pricingNumberPaste(raw: string): string | null {
  if (!/\d/.test(raw)) return null;
  const number = parseNumber(raw);
  return number === null ? null : number.toLocaleString("es-CO", { maximumFractionDigits: 10 });
}
