"use server";

import { revalidatePath } from "next/cache";
import type { OpportunityStage } from "@nassican/db";
import { logAudit } from "@/lib/audit";
import { isFullDay, isPartialDate } from "@/lib/draft-fields";
import { addEntry, deleteEntry, saveOpportunity, setStage } from "@/lib/opportunities";
import { opportunityProblems, stageLabel, type OpportunityDraft } from "@/lib/opportunity-draft";
import { requireUser } from "@/lib/session";
import { TRASH_DAYS, moveToTrash } from "@/lib/trash";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

function refresh() {
  revalidatePath("/oportunidades");
  revalidatePath("/bitacora");
  revalidatePath("/");
}

export async function saveOpportunityAction(draft: OpportunityDraft): Promise<ActionResult> {
  const user = await requireUser();
  const problems = opportunityProblems(draft);
  if (problems.length > 0) return { ok: false, message: problems.join(" ") };

  const { id, created } = await saveOpportunity(draft);
  await logAudit({
    userId: user.id,
    action: created ? "create" : "update",
    entityType: "opportunity",
    entityId: id,
    diff: { title: draft.title.trim(), ...(created ? {} : { stage: draft.stage }) },
  });
  refresh();
  return { ok: true, message: created ? `«${draft.title.trim()}» añadida.` : `«${draft.title.trim()}» guardada.` };
}

export async function changeStage(id: string, stage: OpportunityStage): Promise<ActionResult> {
  const user = await requireUser();
  const title = await setStage(id, stage);
  await logAudit({ userId: user.id, action: "update", entityType: "opportunity", entityId: id, diff: { title, stage } });
  refresh();
  return { ok: true, message: `«${title}»: ${stageLabel(stage).toLowerCase()}.` };
}

export async function logConversation(
  id: string,
  entry: { at: string; text: string },
  next: { nextStep: string; nextStepOn: string } | null,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!entry.text.trim()) return { ok: false, message: "Escribe qué pasó." };
  if (!isPartialDate(entry.at.slice(0, 10))) return { ok: false, message: "La fecha de la nota no es válida." };
  if (next && next.nextStepOn.trim() && !isFullDay(next.nextStepOn.trim().slice(0, 10))) {
    return { ok: false, message: "La fecha del próximo paso tiene que ser un día concreto." };
  }

  const title = await addEntry(id, entry, next ?? undefined);
  await logAudit({ userId: user.id, action: "update", entityType: "opportunity", entityId: id, diff: { title, entry: true } });
  refresh();
  return { ok: true, message: next ? "Anotado, con su próximo paso." : "Anotado." };
}

export async function removeEntry(entryId: string): Promise<ActionResult> {
  await requireUser();
  await deleteEntry(entryId);
  refresh();
  return { ok: true, message: "Nota borrada." };
}

export async function deleteOpportunity(id: string, title: string): Promise<ActionResult> {
  const user = await requireUser();
  await moveToTrash("opportunity", id, user.id);
  await logAudit({ userId: user.id, action: "delete", entityType: "opportunity", entityId: id, diff: { title, trash: true } });
  refresh();
  return { ok: true, message: `«${title}» está en la papelera durante ${TRASH_DAYS} días, con su historial.` };
}
