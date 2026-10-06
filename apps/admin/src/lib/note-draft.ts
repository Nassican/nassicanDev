import { fold } from "@/lib/list-filters";

/**
 * Notes, the part that needs no database: tags, links between notes, and a
 * reader for the Markdown they are typed in.
 *
 * Not the article parser. That one turns Markdown into blocks and, on purpose,
 * drops link addresses — an article's blocks have nowhere to keep them. In a
 * note the saved link is often the whole point, so notes read their own subset
 * and keep every address, every [[link]] and every bare URL.
 */

export const MAX_TITLE = 200;

export type NoteDraft = { id: string; title: string; body: string; tags: string };

export function emptyNote(title = ""): NoteDraft {
  return { id: "", title, body: "", tags: "" };
}

export function noteProblems(draft: NoteDraft): string[] {
  const problems: string[] = [];
  if (!draft.title.trim()) problems.push("La nota necesita un título.");
  if (draft.title.trim().length > MAX_TITLE) problems.push(`El título pasa de ${MAX_TITLE} caracteres.`);
  return problems;
}

/**
 * «Next.js, aprendizaje, next.js» → ["aprendizaje", "next.js"]: lower case,
 * no leading «#», no repeats, in the order first typed. One spelling per tag,
 * or the filter grows two buttons for one idea.
 */
export function parseTags(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/[,\n]/)) {
    const tag = raw.trim().replace(/^#+/, "").toLowerCase().replace(/\s+/g, " ").slice(0, 40);
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out;
}

const WIKI = /\[\[([^\]\n]+)\]\]/g;

/** The titles a body links to with [[…]], as typed. */
export function wikiLinks(body: string): string[] {
  return [...new Set([...body.matchAll(WIKI)].map((m) => m[1].trim()).filter(Boolean))];
}

/** Notes whose body links to this title — matched without case or accents. */
export function backlinks<T extends { id: string; title: string; body: string }>(notes: T[], target: T): T[] {
  const key = fold(target.title);
  return notes.filter((n) => n.id !== target.id && wikiLinks(n.body).some((t) => fold(t) === key));
}

export function findByTitle<T extends { title: string }>(notes: T[], title: string): T | undefined {
  const key = fold(title);
  return notes.find((n) => fold(n.title) === key);
}

/** The first words of a body, without its markup, for the list. */
export function excerpt(body: string, length = 120): string {
  const plain = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(WIKI, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[#>\-*\d.\s]+/gm, "")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > length ? `${plain.slice(0, length - 1).trimEnd()}…` : plain;
}

// ---------------------------------------------------------------- the reader

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "em"; text: string }
  | { kind: "code"; text: string }
  | { kind: "link"; text: string; href: string }
  | { kind: "wiki"; title: string };

export type NoteBlock =
  | { type: "heading"; level: 1 | 2 | 3; inline: Inline[] }
  | { type: "paragraph"; inline: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] }
  | { type: "quote"; inline: Inline[] }
  | { type: "code"; language: string; code: string };

/**
 * Inline markup, left to right: code first (its contents are literal), then
 * [[wiki]], [label](url), bare URLs, **strong** and *em*. Anything unrecognised
 * stays as the text it was.
 */
export function parseInline(text: string): Inline[] {
  const pattern =
    /`([^`]+)`|\[\[([^\]\n]+)\]\]|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s<]+[^\s<.,;:!?)])|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*/g;
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    if (m.index > last) out.push({ kind: "text", text: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ kind: "code", text: m[1] });
    else if (m[2] !== undefined) out.push({ kind: "wiki", title: m[2].trim() });
    else if (m[3] !== undefined) out.push({ kind: "link", text: m[3], href: m[4] });
    else if (m[5] !== undefined) out.push({ kind: "link", text: m[5], href: m[5] });
    else if (m[6] !== undefined) out.push({ kind: "strong", text: m[6] });
    else if (m[7] !== undefined) out.push({ kind: "em", text: m[7] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

export function parseNote(body: string): NoteBlock[] {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const blocks: NoteBlock[] = [];
  const paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length > 0) blocks.push({ type: "paragraph", inline: parseInline(paragraph.join(" ")) });
    paragraph.length = 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      flush();
      const language = trimmed.slice(3).trim();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) code.push(lines[i++]);
      blocks.push({ type: "code", language, code: code.join("\n") });
      continue;
    }
    if (!trimmed) {
      flush();
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flush();
      blocks.push({ type: "heading", level: heading[1].length as 1 | 2 | 3, inline: parseInline(heading[2]) });
      continue;
    }
    const item = /^([-*]|\d+[.)])\s+(.*)$/.exec(trimmed);
    if (item) {
      flush();
      const ordered = /\d/.test(item[1]);
      const prev = blocks.at(-1);
      if (prev?.type === "list" && prev.ordered === ordered) prev.items.push(parseInline(item[2]));
      else blocks.push({ type: "list", ordered, items: [parseInline(item[2])] });
      continue;
    }
    if (trimmed.startsWith(">")) {
      flush();
      const text = trimmed.replace(/^>\s?/, "");
      const prev = blocks.at(-1);
      if (prev?.type === "quote") prev.inline.push({ kind: "text", text: " " }, ...parseInline(text));
      else blocks.push({ type: "quote", inline: parseInline(text) });
      continue;
    }
    paragraph.push(trimmed);
  }
  flush();
  return blocks;
}

/** For the article a note becomes: [[links]] read as their title. */
export function withoutWikiLinks(body: string): string {
  return body.replace(WIKI, "$1");
}
