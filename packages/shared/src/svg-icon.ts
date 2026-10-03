/**
 * Preparing a brand SVG to be inlined next to other brand SVGs.
 *
 * Lives in `packages/shared` because both applications need it to agree: the
 * panel stores what this produces and the public site renders it. If they
 * disagreed, the stored markup would be right and the page wrong, or the other
 * way round, with nothing to say which.
 *
 * Two jobs, and the first is not the obvious one.
 */

/**
 * Attributes that can run code, and elements that can fetch it.
 *
 * The markup here comes from a fixed source and only an operator can add it, so
 * this is not the last line of defence — but it is inlined into every visitor's
 * page, and "nobody untrusted can reach it" is a sentence that stops being true
 * one refactor at a time.
 */
const DANGEROUS_ELEMENTS = /<\s*(script|foreignObject|iframe|use|image|a)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>|<\s*(script|foreignObject|iframe|use|image)\b[^>]*\/?>/gi;
const EVENT_ATTRIBUTES = /\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const EXTERNAL_REFS = /\s+(href|xlink:href)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;

export function sanitiseSvg(markup: string): string {
  return markup
    .replace(DANGEROUS_ELEMENTS, "")
    .replace(EVENT_ATTRIBUTES, "")
    .replace(EXTERNAL_REFS, "")
    .trim();
}

/**
 * Renames every `id` in the document and every reference to it.
 *
 * **This is the one that breaks silently.** Devicon numbers its gradients `a`,
 * `b`, `c` in every single file, so Vite's `url(#a)` and Node's `url(#a)` are the
 * same name. Inline both on one page — which the skills section does by
 * definition — and the second icon paints itself with the first one's gradient.
 * Vite comes out green. Nothing errors, nothing warns, and it reads as "the
 * colours are wrong" rather than as an id collision.
 *
 * The prefix is the technology key, which is already unique in the table.
 */
export function namespaceSvgIds(markup: string, prefix: string): string {
  const safe = prefix.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();

  const ids = [...markup.matchAll(/\sid\s*=\s*"([^"]+)"/g)].map((m) => m[1]);
  if (ids.length === 0) return markup;

  let result = markup;
  // Longest first, so renaming `a` cannot corrupt a reference to `ab`.
  for (const id of [...new Set(ids)].sort((x, y) => y.length - x.length)) {
    const renamed = `${safe}-${id}`;
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    result = result
      .replace(new RegExp(`(\\sid\\s*=\\s*")${escaped}(")`, "g"), `$1${renamed}$2`)
      .replace(new RegExp(`url\\(#${escaped}\\)`, "g"), `url(#${renamed})`)
      // Referenced from an attribute rather than a `url()`, which clip paths and
      // masks both do.
      .replace(new RegExp(`(="#)${escaped}(")`, "g"), `$1${renamed}$2`);
  }

  return result;
}

/**
 * Makes the markup usable as an inline icon at any size.
 *
 * Strips the fixed `width`/`height` devicon ships so CSS decides, and keeps
 * `viewBox`, without which the thing has no intrinsic shape at all.
 */
export function fitSvg(markup: string): string {
  return markup
    .replace(/<svg\b([^>]*)>/i, (_, attrs: string) => {
      const cleaned = attrs
        .replace(/\s+(width|height)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
        .trim();
      return `<svg ${cleaned} width="100%" height="100%" focusable="false" aria-hidden="true">`;
    })
    .trim();
}

/** Everything, in the order the pieces depend on each other. */
export function prepareIconSvg(markup: string, key: string): string {
  return fitSvg(namespaceSvgIds(sanitiseSvg(markup), key));
}

/** Whether a string is plausibly an SVG document at all. */
export function looksLikeSvg(markup: string): boolean {
  return /^\s*<svg[\s>]/i.test(markup) && /<\/svg\s*>\s*$/i.test(markup);
}

/**
 * Turns a prepared icon into a `<symbol>` for a sprite.
 *
 * **Measured, not guessed.** Inlining the markup once per chip made the home page
 * 53.7% inline SVG — 371 KB of it, of which 275 KB was the same handful of logos
 * repeated, because the marquee duplicates its list to loop seamlessly. Docker's
 * 4.5 KB mark appeared ten times. A sprite defines each one once and the chips
 * reference it.
 *
 * It fixes a second thing that was wrong but not visibly so: ten copies of one
 * icon meant ten elements with `id="docker-a"`. That is invalid, and it happened
 * to render correctly only because `url(#docker-a)` resolves to the first match
 * in document order and all ten were identical.
 */
export function svgToSymbol(markup: string, id: string): string {
  const open = markup.match(/<svg\b([^>]*)>/i);
  if (!open) return "";

  const viewBox = open[1].match(/viewBox\s*=\s*"([^"]+)"/i)?.[1] ?? "0 0 24 24";
  const inner = markup.replace(/^[\s\S]*?<svg\b[^>]*>/i, "").replace(/<\/svg\s*>\s*$/i, "");

  return `<symbol id="${id}" viewBox="${viewBox}">${inner}</symbol>`;
}

/** The id a technology's symbol gets, in one place so both sides agree. */
export function iconSymbolId(key: string): string {
  return `tech-${key.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`;
}

/**
 * The whole sprite: every distinct icon once, hidden.
 *
 * `aria-hidden` and zero size rather than `display:none`, which in some browsers
 * stops the referenced gradients resolving at all.
 */
export function buildIconSprite(icons: { key: string; svg: string }[]): string {
  const symbols = icons
    .map(({ key, svg }) => svgToSymbol(svg, iconSymbolId(key)))
    .filter(Boolean)
    .join("");

  if (!symbols) return "";

  return `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden"><defs>${symbols}</defs></svg>`;
}

/**
 * Repaints an icon in one colour, inherited from the text around it.
 *
 * Two different problems, one answer.
 *
 * **A logo can be invisible.** Express's mark is a single path with *no* `fill`
 * attribute at all, and SVG's default fill is black — so on a dark background it
 * is a black shape on near-black. The brand hex does not save it either: the
 * brand colour *is* black.
 *
 * **And a page of brand palettes clashes.** Twenty-three logos in their own
 * colours is twenty-three palettes arguing with the site's.
 *
 * So `mono` strips every colour and lets the glyph inherit `currentColor`, which
 * already flips white-on-dark and black-on-light with the theme. `fill="none"`
 * survives on purpose: it means *do not paint this*, which is structure and not
 * colour — repainting it would fill in holes the logo needs.
 */
export function monochromeSvg(markup: string): string {
  return (
    markup
      // Gradients and filters become unreferenced the moment their fills go.
      .replace(/<defs\b[^>]*>[\s\S]*?<\/defs\s*>/gi, "")
      .replace(/<(linearGradient|radialGradient|filter)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
      // Colour attributes go; `none` stays, because it is shape and not colour.
      .replace(/\s(fill|stroke)\s*=\s*"(?!none")[^"]*"/gi, "")
      .replace(/\s(fill|stroke)\s*=\s*'(?!none')[^']*'/gi, "")
      /*
       * The same two properties written as inline style. The value is captured
       * on its own: anchoring inside the whole `style="…"` attribute puts `^` on
       * the `s` of `style`, so the first declaration never matched.
       */
      .replace(/style\s*=\s*"([^"]*)"/gi, (_, value: string) => {
        const kept = value
          .split(";")
          .filter((part) => !/^\s*(fill|stroke)\s*:\s*(?!none)/i.test(part))
          .filter((part) => part.trim() !== "")
          .join(";");
        return kept ? `style="${kept}"` : "";
      })
      // One declaration on the root, which every child without its own inherits.
      .replace(/<svg\b([^>]*)>/i, (_, attrs: string) => `<svg${attrs} fill="currentColor">`)
      .trim()
  );
}
