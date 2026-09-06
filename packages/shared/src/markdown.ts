import type { ContentBlock } from "./content";

/**
 * Markdown as a way to *type* a body, never as a way to store one.
 *
 * The storage decision does not change: bodies stay `ContentBlock[]`, the
 * public site keeps its one renderer, and nothing ships a Markdown parser to a
 * visitor. What this adds is a second keyboard for the same content - paste a
 * draft written elsewhere, restructure three sections without six clicks - and
 * then hands back blocks.
 *
 * **The conversion is not symmetric, and that is the thing to understand.**
 *
 *   normaliseBody(b) -> markdown -> blocks   returns normaliseBody(b) exactly.
 *   markdown -> blocks                       keeps only what a block can hold.
 *
 * A block carries plain text with no inline marks, so `**negrita**`, links
 * written as `[texto](url)`, tables and nested lists have nowhere to go. They
 * are not silently dropped and they are not stored as literal asterisks either
 * - the parser strips the syntax, keeps the words, and *reports* every line it
 * had to simplify so the decision stays with the person writing.
 */

/**
 * The canonical shape of a body.
 *
 * Two spellings of the same list exist in the database - `ordered: false` and
 * no `ordered` at all - because the type says `ordered?: boolean` and both the
 * import script and the block editor were within their rights. They render
 * identically, but Markdown has no way to spell the difference, so a round
 * trip has to pick one.
 *
 * It picks absence, and this function is what makes the choice explicit rather
 * than a surprise found by diffing a row after someone toggled a view. It is
 * a normalisation, never a loss: nothing it removes changes what is drawn.
 */
export function normaliseBody(blocks: ContentBlock[]): ContentBlock[] {
  return blocks.map((block) => {
    if (block.type === "list") {
      const { ordered, ...rest } = block;
      return ordered ? { ...rest, ordered: true } : rest;
    }
    if (block.type === "image" && !block.caption) {
      const { caption, ...rest } = block;
      void caption;
      return rest;
    }
    if (block.type === "code" && !block.language) {
      const { language, ...rest } = block;
      void language;
      return rest;
    }
    return block;
  });
}

export type MarkdownLoss = {
  /** 1-based line in the Markdown source. */
  line: number;
  kind: "emphasis" | "link" | "table" | "nested-list" | "html" | "unknown-image";
  detail: string;
};

export type ParseResult = {
  blocks: ContentBlock[];
  losses: MarkdownLoss[];
};

const lossLabels: Record<MarkdownLoss["kind"], string> = {
  emphasis: "negrita o cursiva",
  link: "enlace con texto",
  table: "tabla",
  "nested-list": "lista anidada",
  html: "HTML",
  "unknown-image": "imagen desconocida",
};

export function describeLoss(loss: MarkdownLoss): string {
  return `Línea ${loss.line}: ${lossLabels[loss.kind]} — ${loss.detail}`;
}

// ---------------------------------------------------------------- serialise

const fence = "```";

/**
 * Blocks to Markdown.
 *
 * Every block type has an exact representation, which is why this direction
 * loses nothing. Images keep their real `/media/<checksum>.webp` URL so the
 * text is valid Markdown on its own, and the parser recognises them again by
 * that URL.
 */
export function blocksToMarkdown(blocks: ContentBlock[]): string {
  const parts = blocks.map((block) => {
    switch (block.type) {
      case "heading":
        return `## ${block.text}`;
      case "paragraph":
        return block.text;
      case "quote":
        return block.text
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n");
      case "list":
        return block.items
          .map((item, i) => (block.ordered ? `${i + 1}. ${item}` : `- ${item}`))
          .join("\n");
      case "code":
        return `${fence}${block.language ?? ""}\n${block.code}\n${fence}`;
      case "image":
        return block.caption
          ? `![${block.alt}](${block.url} "${block.caption}")`
          : `![${block.alt}](${block.url})`;
    }
  });

  return parts.join("\n\n");
}

// -------------------------------------------------------------------- parse

/** Strips inline syntax a block cannot hold, recording what it removed. */
function flatten(
  text: string,
  line: number,
  losses: MarkdownLoss[],
): string {
  let out = text;

  // Links first: the label is the part worth keeping, and the address would
  // otherwise survive as noise in the middle of a sentence.
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label: string, href: string) => {
    losses.push({
      line,
      kind: "link",
      detail: `se conserva «${label}», se pierde ${href}`,
    });
    return label;
  });

  if (/<[a-z][^>]*>/i.test(out)) {
    losses.push({ line, kind: "html", detail: "las etiquetas se eliminan" });
    out = out.replace(/<[^>]+>/g, "");
  }

  const before = out;
  out = out
    .replace(/\*\*\*([^*]+)\*\*\*/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1$2")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1");

  if (out !== before) {
    losses.push({ line, kind: "emphasis", detail: "se conserva el texto, no el énfasis" });
  }

  return out.trim();
}

/**
 * Markdown to blocks.
 *
 * A deliberately small parser: the grammar is exactly the block set, so
 * anything else is reported rather than half-supported. Pulling in a real
 * Markdown library would parse far more than this can store, which would move
 * the loss from a message the writer reads to a surprise on the published page.
 *
 * `knownImages` maps a URL back to the media row it came from. Images survive a
 * round trip because of it; one typed by hand points at nothing the library
 * knows, and is reported instead of invented.
 */
export function markdownToBlocks(
  source: string,
  knownImages: Map<string, Extract<ContentBlock, { type: "image" }>> = new Map(),
): ParseResult {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ContentBlock[] = [];
  const losses: MarkdownLoss[] = [];

  let i = 0;
  const paragraph: string[] = [];
  let paragraphLine = 1;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = flatten(paragraph.join(" "), paragraphLine, losses);
    if (text) blocks.push({ type: "paragraph", text });
    paragraph.length = 0;
  };

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();
    const lineNumber = i + 1;

    if (line === "") {
      flushParagraph();
      i += 1;
      continue;
    }

    // ---- code fence ------------------------------------------------------
    if (line.startsWith(fence)) {
      flushParagraph();
      const language = line.slice(3).trim() || undefined;
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith(fence)) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1; // closing fence
      blocks.push({ type: "code", code: code.join("\n"), ...(language ? { language } : {}) });
      continue;
    }

    // ---- heading ---------------------------------------------------------
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      const text = flatten(heading[2], lineNumber, losses);
      if (text) blocks.push({ type: "heading", text });
      i += 1;
      continue;
    }

    // ---- image on its own line ------------------------------------------
    const image = /^!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)$/.exec(line);
    if (image) {
      flushParagraph();
      const [, alt, url, caption] = image;
      const known = knownImages.get(url);
      if (known) {
        blocks.push({
          ...known,
          alt: alt || known.alt,
          ...(caption ? { caption } : {}),
        });
      } else {
        losses.push({
          line: lineNumber,
          kind: "unknown-image",
          detail: `${url} no está en la biblioteca; insértala con el botón de imagen`,
        });
      }
      i += 1;
      continue;
    }

    // ---- table -----------------------------------------------------------
    if (line.startsWith("|") && line.endsWith("|")) {
      flushParagraph();
      losses.push({
        line: lineNumber,
        kind: "table",
        detail: "no hay bloque de tabla; se guarda como texto",
      });
      const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
      // A separator row carries no words, so it becomes nothing.
      if (!cells.every((c) => /^:?-+:?$/.test(c))) {
        blocks.push({ type: "paragraph", text: flatten(cells.join(" · "), lineNumber, losses) });
      }
      i += 1;
      continue;
    }

    // ---- quote -----------------------------------------------------------
    if (line.startsWith(">")) {
      flushParagraph();
      const quoted: string[] = [];
      const startedAt = lineNumber;
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoted.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      const text = flatten(quoted.join(" "), startedAt, losses);
      if (text) blocks.push({ type: "quote", text });
      continue;
    }

    // ---- list ------------------------------------------------------------
    const bullet = /^([-*+]|\d+\.)\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      const ordered = /\d/.test(bullet[1]);
      const items: string[] = [];
      const startedAt = lineNumber;

      while (i < lines.length) {
        const current = lines[i];
        const trimmed = current.trim();
        const match = /^([-*+]|\d+\.)\s+(.*)$/.exec(trimmed);
        if (!match) break;

        // Indentation means a nested list, which a flat `items: string[]`
        // cannot express. The text is kept at the top level and reported.
        if (/^\s{2,}/.test(current)) {
          losses.push({
            line: i + 1,
            kind: "nested-list",
            detail: "se aplana al mismo nivel",
          });
        }

        items.push(flatten(match[2], i + 1, losses));
        i += 1;
      }

      if (items.length > 0) {
        blocks.push({ type: "list", items, ...(ordered ? { ordered: true } : {}) });
      } else {
        losses.push({ line: startedAt, kind: "unknown-image", detail: "lista vacía" });
      }
      continue;
    }

    // ---- ordinary text ---------------------------------------------------
    if (paragraph.length === 0) paragraphLine = lineNumber;
    paragraph.push(line);
    i += 1;
  }

  flushParagraph();
  return { blocks, losses };
}

/** Every image in a body, keyed by URL, for the parser to recognise again. */
export function imageIndex(
  blocks: ContentBlock[],
): Map<string, Extract<ContentBlock, { type: "image" }>> {
  const map = new Map<string, Extract<ContentBlock, { type: "image" }>>();
  for (const block of blocks) {
    if (block.type === "image") map.set(block.url, block);
  }
  return map;
}
