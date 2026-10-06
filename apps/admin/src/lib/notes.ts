import "server-only";

import { db, prismaJson } from "@nassican/db";
import { describeLoss, markdownToBlocks } from "@nassican/shared";
import { freeSlug } from "@/lib/editorial";
import { parseTags, withoutWikiLinks, type NoteDraft } from "@/lib/note-draft";

export type NoteRow = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
  postId: string | null;
  updatedAt: string;
};

/**
 * Every note, bodies included. They are text typed by one person, so even a
 * few hundred are less than one diploma image — and having them all is what
 * lets search, tags and backlinks answer without a round trip.
 */
export async function listNotes(): Promise<NoteRow[]> {
  const rows = await db.note.findMany({ orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }] });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    tags: r.tags,
    pinned: r.pinned,
    postId: r.postId,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function saveNote(draft: NoteDraft): Promise<{ id: string; created: boolean }> {
  const data = { title: draft.title.trim(), body: draft.body, tags: parseTags(draft.tags) };
  if (draft.id) {
    await db.note.update({ where: { id: draft.id }, data });
    return { id: draft.id, created: false };
  }
  const note = await db.note.create({ data, select: { id: true } });
  return { id: note.id, created: true };
}

export async function setPinned(id: string, pinned: boolean): Promise<string> {
  return (await db.note.update({ where: { id }, data: { pinned }, select: { title: true } })).title;
}

/**
 * A note becomes a draft in Blogs, in Spanish, with the note's Markdown parsed
 * into blocks by the same parser the editor uses. What it had to simplify —
 * a link's address, bold text — is returned, so the operator hears it now and
 * not when the article is half written.
 */
export async function noteToDraft(
  id: string,
  authorId: string,
): Promise<{ postId: string; title: string; losses: string[]; existed: boolean }> {
  const note = await db.note.findUniqueOrThrow({ where: { id } });
  if (note.postId) return { postId: note.postId, title: note.title, losses: [], existed: true };

  const { blocks, losses } = markdownToBlocks(withoutWikiLinks(note.body));
  const slug = await freeSlug(note.title);

  const post = await db.$transaction(async (tx) => {
    const created = await tx.post.create({
      data: {
        slug,
        status: "draft",
        authorId,
        translations: {
          create: { locale: "es", title: note.title, description: "", body: prismaJson.body(blocks) },
        },
      },
      select: { id: true },
    });
    await tx.note.update({ where: { id }, data: { postId: created.id } });
    return created;
  });

  return { postId: post.id, title: note.title, losses: losses.map(describeLoss), existed: false };
}
