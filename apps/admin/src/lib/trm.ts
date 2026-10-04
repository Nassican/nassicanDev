import "server-only";

/**
 * The official COP/USD rate (TRM), from the Superintendencia Financiera's open
 * data. Free, no key, and the same figure the bank statement is measured
 * against.
 *
 * Cached for twelve hours by `fetch` itself: the rate changes once a day, and a
 * page that waited on a government API every time it opened would be slower
 * than the figure is worth. Null when it cannot be read, and the page then
 * shows each currency on its own rather than converting with a stale guess.
 */
export type Trm = { value: number; date: string };

const URL =
  "https://www.datos.gov.co/resource/32sa-8pi3.json?$order=vigenciadesde%20DESC&$limit=1";

export async function getTrm(): Promise<Trm | null> {
  try {
    const response = await fetch(URL, {
      next: { revalidate: 43_200 },
      signal: AbortSignal.timeout(4000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;

    const [row] = (await response.json()) as { valor?: string; vigenciadesde?: string }[];
    const value = Number(row?.valor);
    if (!Number.isFinite(value) || value <= 0) return null;

    return { value, date: (row?.vigenciadesde ?? "").slice(0, 10) };
  } catch {
    return null;
  }
}
