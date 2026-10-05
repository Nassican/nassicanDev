import "server-only";

import { db, prismaJson, type IdeaStage } from "@nassican/db";
import { calendarDate } from "@nassican/shared";
import { blankToNull } from "@/lib/draft-fields";
import type { BoardItem } from "@/lib/editorial-draft";
import { slugify } from "@/lib/post-draft";
import { getTimezone } from "@/lib/site-config";

/**
 * The editorial calendar, read and written.
 *
 * One board from two tables: ideas, and posts. A post written from an idea is
 * shown once, as the post, with the idea's target alongside. A post written
 * straight in Blogs is on the board too — the calendar is about what comes out,
 * not about where it was started.
 */

/** How far back published posts stay on the board: enough to see a rhythm. */
const PUBLISHED_DAYS = 90;

export type EditorialView = {
  today: string;
  /** "2026-10": the month the calendar shows. */
  month: string;
  /** The server's clock, so «scheduled or published» is judged at the real time. */
  now: string;
  items: BoardItem[];
  cadence: { last30: number; lastPublished: string | null };
};

export async function getEditorial(month: string | undefined): Promise<EditorialView> {
  const timezone = await getTimezone();
  const today = calendarDate(timezone);
  const shown = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : today.slice(0, 7);
  const since = new Date(Date.now() - PUBLISHED_DAYS * 86_400_000);

  const [ideas, posts] = await Promise.all([
    db.contentIdea.findMany({ orderBy: { createdAt: "desc" } }),
    db.post.findMany({
      where: {
        OR: [
          { status: { in: ["draft", "scheduled"] } },
          { status: "published", publishedAt: { gte: since } },
        ],
      },
      select: {
        id: true,
        slug: true,
        status: true,
        publishedAt: true,
        translations: { where: { locale: "es" }, select: { title: true } },
      },
    }),
  ]);

  const byPost = new Map(ideas.filter((i) => i.postId).map((i) => [i.postId!, i]));
  const localDay = (at: Date | null) => (at ? calendarDate(timezone, at) : null);

  const items: BoardItem[] = [
    ...ideas
      .filter((i) => !i.postId)
      .map((i) => ({
        id: i.id,
        ideaId: i.id,
        postId: null,
        title: i.title,
        note: i.note,
        stage: i.stage,
        postStatus: null,
        publishedAt: null,
        targetDate: i.targetDate,
        when: i.targetDate,
      })),
    ...posts.map((p) => {
      const idea = byPost.get(p.id);
      const dated = (p.status === "published" || p.status === "scheduled") && p.publishedAt;
      return {
        id: p.id,
        ideaId: idea?.id ?? null,
        postId: p.id,
        title: p.translations[0]?.title.trim() || idea?.title || p.slug,
        note: idea?.note ?? null,
        stage: idea?.stage ?? null,
        postStatus: p.status,
        publishedAt: p.publishedAt?.toISOString() ?? null,
        targetDate: idea?.targetDate ?? null,
        // Once it has a publication date, that is when it comes out.
        when: dated ? localDay(p.publishedAt) : (idea?.targetDate ?? null),
      };
    }),
  ];

  const published = posts
    .filter((p) => p.status === "published" && p.publishedAt && p.publishedAt <= new Date())
    .map((p) => p.publishedAt!)
    .sort((a, b) => b.getTime() - a.getTime());

  return {
    today,
    month: shown,
    now: new Date().toISOString(),
    items,
    cadence: {
      last30: published.filter((d) => d.getTime() > Date.now() - 30 * 86_400_000).length,
      lastPublished: localDay(published[0] ?? null),
    },
  };
}

export async function createIdea(fields: { title: string; targetDate: string; note: string }): Promise<string> {
  const idea = await db.contentIdea.create({
    data: { title: fields.title.trim(), targetDate: blankToNull(fields.targetDate), note: blankToNull(fields.note) },
    select: { id: true },
  });
  return idea.id;
}

export async function updateIdea(
  id: string,
  fields: { title: string; targetDate: string; note: string },
): Promise<void> {
  await db.contentIdea.update({
    where: { id },
    data: { title: fields.title.trim(), targetDate: blankToNull(fields.targetDate), note: blankToNull(fields.note) },
  });
}

export async function setStage(id: string, stage: IdeaStage): Promise<string> {
  return (await db.contentIdea.update({ where: { id }, data: { stage }, select: { title: true } })).title;
}

/**
 * Turns an idea into a real draft in Blogs and links the two.
 *
 * The slug comes from the title, readable from the first save, with a numeric
 * suffix when another post already has it. The Spanish translation starts with
 * the idea's title and an empty body; English is left for the editor, where
 * the publish rule will ask for it.
 */
export async function ideaToDraft(id: string, authorId: string): Promise<{ postId: string; title: string }> {
  const idea = await db.contentIdea.findUniqueOrThrow({ where: { id } });
  if (idea.postId) return { postId: idea.postId, title: idea.title };

  const base = slugify(idea.title) || `borrador-${Date.now().toString(36)}`;
  const taken = new Set(
    (await db.post.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } })).map((p) => p.slug),
  );
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;

  const post = await db.$transaction(async (tx) => {
    const created = await tx.post.create({
      data: {
        slug,
        status: "draft",
        authorId,
        translations: {
          create: { locale: "es", title: idea.title, description: "", body: prismaJson.body([]) },
        },
      },
      select: { id: true },
    });
    await tx.contentIdea.update({ where: { id }, data: { postId: created.id } });
    return created;
  });

  return { postId: post.id, title: idea.title };
}

/** For «Hoy»: what aimed at today or earlier and has not come out. */
export async function lateEditorial(today: string): Promise<{ title: string; targetDate: string; postId: string | null }[]> {
  const ideas = await db.contentIdea.findMany({
    where: { targetDate: { not: null } },
    select: { title: true, targetDate: true, postId: true, post: { select: { status: true } } },
  });

  return ideas
    .filter((i) => i.post?.status !== "published" && i.post?.status !== "scheduled")
    .filter((i) => {
      const target = i.targetDate!.slice(0, 10);
      // A day is due on the day itself. A month or a year is due only once it is
      // over: «2026-10» is not late on the 5th of October, and saying so would
      // be the first thing anyone learns to ignore.
      return target.length === 10 ? target <= today : target < today.slice(0, target.length);
    })
    .map((i) => ({ title: i.title, targetDate: i.targetDate!, postId: i.postId }));
}
