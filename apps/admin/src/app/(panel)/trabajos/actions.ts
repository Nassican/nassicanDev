"use server";

import { revalidatePath } from "next/cache";
import type { ClientProjectStatus } from "@nassican/db";
import { calendarDate } from "@nassican/shared";
import { logAudit } from "@/lib/audit";
import { clientProjectProblems, statusLabel, type ClientProjectDraft } from "@/lib/client-project-draft";
import { addEntry, deleteEntry, saveClientProject, setFinishedAt, setStatus } from "@/lib/client-projects";
import { isPartialDate } from "@/lib/draft-fields";
import { parseQuick } from "@/lib/quick-edit";
import { requireUser } from "@/lib/session";
import { getTimezone } from "@/lib/site-config";
import { TRASH_DAYS, moveToTrash } from "@/lib/trash";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

function refresh() {
  revalidatePath("/trabajos");
  revalidatePath("/bitacora");
  revalidatePath("/");
}

export async function saveClientProjectAction(draft: ClientProjectDraft): Promise<ActionResult> {
  const user = await requireUser();
  const problems = clientProjectProblems(draft);
  if (problems.length > 0) return { ok: false, message: problems.join(" ") };

  const { id, created } = await saveClientProject(draft);
  await logAudit({
    userId: user.id,
    action: created ? "create" : "update",
    entityType: "client_project",
    entityId: id,
    diff: { title: draft.title.trim() },
  });
  refresh();
  return { ok: true, message: created ? `«${draft.title.trim()}» añadido.` : `«${draft.title.trim()}» guardado.` };
}

export async function changeClientProjectStatus(id: string, status: ClientProjectStatus): Promise<ActionResult> {
  const user = await requireUser();
  const today = calendarDate(await getTimezone());
  const { title } = await setStatus(id, status, today);
  await logAudit({ userId: user.id, action: "update", entityType: "client_project", entityId: id, diff: { title, status } });
  refresh();
  return { ok: true, message: `«${title}»: ${statusLabel(status).toLowerCase()}.` };
}

/** «¿Lo terminaste hoy?» — «today» is resolved here, in the configured timezone. */
export async function setClientProjectFinishedAt(id: string, raw: string): Promise<ActionResult> {
  await requireUser();
  const text = raw === "today" ? calendarDate(await getTimezone()) : raw;
  const parsed = parseQuick("date", text);
  if (!parsed.ok || typeof parsed.value !== "string") return { ok: false, message: parsed.ok ? "Falta la fecha." : parsed.message };
  const title = await setFinishedAt(id, parsed.value);
  refresh();
  return { ok: true, message: `«${title}» terminado el ${parsed.value}.` };
}

export async function logProgress(
  projectId: string,
  entry: { at: string; text: string; hours: string },
): Promise<ActionResult> {
  const user = await requireUser();
  if (!entry.text.trim()) return { ok: false, message: "Escribe qué avanzaste." };
  if (!isPartialDate(entry.at.slice(0, 10)) || entry.at.slice(0, 10).length !== 10) {
    return { ok: false, message: "El avance necesita un día concreto." };
  }
  const hours = parseQuick("decimal", entry.hours);
  if (!hours.ok) return hours;

  const { title, started } = await addEntry(projectId, {
    at: entry.at,
    text: entry.text,
    hours: typeof hours.value === "number" ? hours.value : null,
  });
  await logAudit({
    userId: user.id,
    action: "update",
    entityType: "client_project",
    entityId: projectId,
    diff: { title, entry: true, ...(started ? { status: "in_progress" } : {}) },
  });
  refresh();
  return { ok: true, message: started ? `Avance anotado, y «${title}» pasó a en marcha.` : "Avance anotado." };
}

export async function removeProgress(entryId: string): Promise<ActionResult> {
  await requireUser();
  await deleteEntry(entryId);
  refresh();
  return { ok: true, message: "Avance borrado." };
}

export async function deleteClientProject(id: string, title: string): Promise<ActionResult> {
  const user = await requireUser();
  await moveToTrash("client_project", id, user.id);
  await logAudit({ userId: user.id, action: "delete", entityType: "client_project", entityId: id, diff: { title, trash: true } });
  refresh();
  return { ok: true, message: `«${title}» está en la papelera durante ${TRASH_DAYS} días, con sus avances.` };
}
