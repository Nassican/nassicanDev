/**
 * A layered diagram, typed as text.
 *
 * Bodies have no diagram block and do not get one: a `code` block whose
 * language is `diagram` holds the text below, and the site draws it. So the
 * editor, the Markdown view and the stored shape are untouched — the only thing
 * that knows a diagram exists is the renderer, and anything it cannot read
 * falls back to the code block it already was.
 *
 *   # Dos aplicaciones, dos paquetes y una base de datos
 *   Sitio público | nassican.com | apps/web
 *   Panel de gestión | app.nassican.com | apps/admin
 *   --- importan ---
 *   packages/shared | tipos y funciones puras
 *   packages/db | esquema y cliente de datos
 *   ---
 *   PostgreSQL
 *
 * One box per line, its title first and any details after a `|`. A line of
 * dashes starts the next layer, optionally naming the arrow that leads to it.
 * `#` is the caption.
 *
 * **Layers and nothing else, on purpose.** Arbitrary boxes and arrows need a
 * layout engine, and the ones that exist are hundreds of kilobytes of client
 * JavaScript for a figure that never changes. ASCII art was the alternative,
 * and it is what this replaces: its lines do not join in a system font and it
 * is cut off on a phone. Layers cover what an article about software usually
 * has to show, and they are drawn in plain HTML that wraps.
 */

export const DIAGRAM_LANGUAGE = "diagram";

export type DiagramNode = { title: string; details: string[] };

export type DiagramTier = {
  nodes: DiagramNode[];
  /** What the arrow into this layer says. Null for the first, or when unnamed. */
  link: string | null;
};

export type Diagram = { caption: string | null; tiers: DiagramTier[] };

const SEPARATOR = /^-{3,}\s*(.*?)\s*-*$/;

/**
 * Null when the text is not a diagram this can draw — nothing in it, or a
 * layer with no boxes. The caller then shows the text as it was written, which
 * is better than a figure with a hole in it.
 */
export function parseDiagram(source: string): Diagram | null {
  let caption: string | null = null;
  const tiers: DiagramTier[] = [{ nodes: [], link: null }];

  for (const raw of source.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith("#")) {
      caption = line.replace(/^#+\s*/, "") || null;
      continue;
    }

    const separator = SEPARATOR.exec(line);
    if (separator) {
      tiers.push({ nodes: [], link: separator[1] || null });
      continue;
    }

    const [title, ...details] = line.split("|").map((part) => part.trim());
    if (!title) return null;
    tiers[tiers.length - 1].nodes.push({ title, details: details.filter(Boolean) });
  }

  if (tiers.some((tier) => tier.nodes.length === 0)) return null;
  return { caption, tiers };
}
