"use server";

import { revalidatePath } from "next/cache";
import type { IdeaStage } from "@nassican/db";
import { logAudit } from "@/lib/audit";
import { createIdea, ideaToDraft, setStage, updateIdea } from "@/lib/editorial";
import { ideaProblems } from "@/lib/editorial-draft";
import { requireUser } from "@/lib/session";
import { TRASH_DAYS, moveToTrash } from "@/lib/trash";

export type ActionResult =
  | { ok: true; message: string; href?: string }
  | { ok: false; message: string };

function refresh() {
  revalidatePath("/contenido/calendario");
  revalidatePath("/contenido/blogs");
  revalidatePath("/");
}

/** A server action is a public endpoint: the rules run here as well. */
export async function saveIdea(
  id: string | null,
  fields: { title: string; targetDate: string; note: string },
): Promise<ActionResult> {
  const user = await requireUser();
  const problems = ideaProblems(fields);
  if (problems.length > 0) return { ok: false, message: problems.join(" ") };

  const saved = id ? (await updateIdea(id, fields), id) : await createIdea(fields);
  await logAudit({ userId: user.id, action: id ? "update" : "create", entityType: "idea", entityId: saved, diff: { title: fields.title.trim() } });
  refresh();
  return { ok: true, message: `«${fields.title.trim()}» ${id ? "guardada" : "apuntada"}.` };
}

export async function moveIdea(id: string, stage: IdeaStage): Promise<ActionResult> {
  await requireUser();
  const title = await setStage(id, stage);
  refresh();
  return { ok: true, message: `«${title}» ${stage === "research" ? "en investigación" : "de vuelta a ideas"}.` };
}

/** «Escribir»: the idea becomes a draft in Blogs, and the answer says where. */
export async function startWriting(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const { postId, title } = await ideaToDraft(id, user.id);
  await logAudit({ userId: user.id, action: "create", entityType: "post", entityId: postId, diff: { label: title, fromIdea: true } });
  refresh();
  return { ok: true, message: `«${title}» ya es un borrador en Blogs.`, href: `/contenido/blogs/${postId}` };
}

export async function deleteIdea(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const trashed = await moveToTrash("idea", id, user.id);
  if (trashed) {
    await logAudit({ userId: user.id, action: "delete", entityType: "idea", entityId: id, diff: { title: trashed.label, trash: true } });
  }
  refresh();
  return { ok: true, message: `En la papelera durante ${TRASH_DAYS} días.` };
}
