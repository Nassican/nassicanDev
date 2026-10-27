"use server";

import { revalidatePath } from "next/cache";
import { db, type PricingNetwork } from "@nassican/db";
import type { PricingSnapshot, PricingStatus } from "@nassican/shared";
import { requireUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { fieldProblems, parseNumber } from "@/lib/draft-fields";
import {
  pricingClientProblems,
  pricingQuoteProblems,
  type PricingClientDraft,
  type PricingQuoteDraft,
} from "@/lib/pricing-draft";
import { pricingSnapshot, savePricingClient, savePricingQuote } from "@/lib/pricing";
import { setPricingQuoteStatus } from "@/lib/pricing";
import { moveToTrash, TRASH_DAYS } from "@/lib/trash";
import { savePricingFinancial } from "@/lib/pricing";
import { financialProblems, readFinancial } from "@/lib/pricing-financial";
import type { PricingFinancialDraft } from "@/lib/pricing-draft";

export type PricingActionResult = { ok: boolean; message: string; id?: string };
export async function saveFinancialAction(
  draft: PricingFinancialDraft,
): Promise<PricingActionResult> {
  const user = await requireUser();
  const problems = financialProblems(draft);
  if (problems.length) return { ok: false, message: problems.join(" ") };
  const row = await savePricingFinancial(draft, readFinancial(draft));
  await logAudit({
    userId: user.id,
    action: draft.id ? "update" : "create",
    entityType: "pricing_financial",
    entityId: row.id,
    diff: { title: `Periodo ${row.start} a ${row.end}` },
  });
  refresh();
  return { ok: true, message: "Periodo financiero guardado.", id: row.id };
}
function refresh() {
  for (const path of [
    "/precios",
    "/precios/cotizaciones",
    "/precios/mercado",
    "/precios/regiones",
    "/precios/parametros",
    "/trabajos",
    "/personal",
    "/",
    "/bitacora",
  ])
    revalidatePath(path);
}
export async function saveClientAction(draft: PricingClientDraft): Promise<PricingActionResult> {
  const user = await requireUser();
  const problems = pricingClientProblems(draft);
  if (problems.length) return { ok: false, message: problems.join(" ") };
  const row = await savePricingClient(draft);
  await logAudit({
    userId: user.id,
    action: draft.id ? "update" : "create",
    entityType: "pricing_client",
    entityId: row.id,
    diff: { title: row.name },
  });
  refresh();
  return { ok: true, message: "Cliente guardado.", id: row.id };
}
export async function previewQuoteAction(
  draft: PricingQuoteDraft,
): Promise<{ ok: true; snapshot: PricingSnapshot } | { ok: false; message: string }> {
  await requireUser();
  const problems = pricingQuoteProblems(draft, false);
  if (problems.length) return { ok: false, message: problems.join(" ") };
  return { ok: true, snapshot: await pricingSnapshot(draft) };
}
export async function saveQuoteAction(
  draft: PricingQuoteDraft,
  expectedSuggested?: number,
): Promise<PricingActionResult> {
  const user = await requireUser();
  const problems = pricingQuoteProblems(draft);
  if (problems.length) return { ok: false, message: problems.join(" ") };
  const snapshot = await pricingSnapshot(draft);
  if (expectedSuggested !== undefined && snapshot.result.suggested !== expectedSuggested)
    return {
      ok: false,
      message:
        "Las referencias o parámetros cambiaron desde la revisión. Revisa el cálculo otra vez antes de guardar.",
    };
  const row = await savePricingQuote(draft, snapshot);
  await logAudit({
    userId: user.id,
    action: "create",
    entityType: "pricing_quote",
    entityId: row.id,
    diff: {
      title: row.title,
      client: row.snapshot.client.name,
      amount: row.final.toString(),
      currency: row.currency,
    },
  });
  refresh();
  return { ok: true, message: "Cotización guardada con sus parámetros y desglose.", id: row.id };
}
export async function changeQuoteStatusAction(
  id: string,
  status: PricingStatus,
): Promise<PricingActionResult> {
  const user = await requireUser();
  if (!["draft", "sent", "accepted", "rejected", "expired"].includes(status))
    return { ok: false, message: "Estado inválido." };
  const outcome = await setPricingQuoteStatus(id, status);
  if (!outcome.ok) return outcome;
  const { row } = outcome;
  if (outcome.changed)
    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "pricing_quote",
      entityId: id,
      diff: {
        title: row.title,
        status,
        client: outcome.client,
        amount: row.final.toString(),
        currency: row.currency,
        projectId: row.projectId,
      },
    });
  refresh();
  return {
    ok: true,
    message: outcome.projectCreated
      ? "Cotización aceptada. El trabajo se creó con su cliente, monto y moneda."
      : "Estado de la cotización guardado.",
  };
}
export async function quickQuoteAction(id: string, raw: string): Promise<PricingActionResult> {
  const user = await requireUser();
  const value = parseNumber(raw);
  if (
    value === null ||
    fieldProblems([{ label: "precio final", value: raw, kind: "amount" }]).length
  )
    return { ok: false, message: "Escribe un precio válido, mayor o igual que cero." };
  const row = await db.pricingQuote.findUniqueOrThrow({ where: { id } });
  if (row.status !== "draft")
    return { ok: false, message: "Solo puedes editar el precio de un borrador." };
  const updated = await db.pricingQuote.updateMany({
    where: { id, status: "draft", projectId: null },
    data: { final: value },
  });
  if (!updated.count)
    return { ok: false, message: "La cotización cambió de estado. Actualiza la lista." };
  await logAudit({
    userId: user.id,
    action: "update",
    entityType: "pricing_quote",
    entityId: id,
    diff: { title: row.title, final: value },
  });
  refresh();
  return { ok: true, message: "Precio final guardado." };
}

export async function deletePricingClientAction(id: string): Promise<PricingActionResult> {
  const user = await requireUser();
  const removed = await moveToTrash("pricing_client", id, user.id);
  if (removed)
    await logAudit({
      userId: user.id,
      action: "delete",
      entityType: "pricing_client",
      entityId: id,
      diff: { title: removed.label, trash: true },
    });
  refresh();
  return {
    ok: true,
    message: removed
      ? `Cliente en la papelera durante ${TRASH_DAYS} días, con sus periodos y señales.`
      : "El cliente ya no estaba.",
  };
}
export async function deletePricingQuoteAction(id: string): Promise<PricingActionResult> {
  const user = await requireUser();
  const removed = await moveToTrash("pricing_quote", id, user.id);
  if (removed)
    await logAudit({
      userId: user.id,
      action: "delete",
      entityType: "pricing_quote",
      entityId: id,
      diff: { title: removed.label, trash: true },
    });
  refresh();
  return {
    ok: true,
    message: removed
      ? `Cotización en la papelera durante ${TRASH_DAYS} días.`
      : "La cotización ya no estaba.",
  };
}
export async function saveClientSignalAction(
  clientId: string,
  network: PricingNetwork,
  raw: string,
): Promise<PricingActionResult> {
  const user = await requireUser();
  if (!["instagram", "facebook", "linkedin", "tiktok", "youtube", "x", "other"].includes(network))
    return { ok: false, message: "Red inválida." };
  const followers = parseNumber(raw);
  if (
    raw.trim() &&
    (followers === null || !Number.isInteger(followers) || followers < 0 || followers > 2147483647)
  )
    return { ok: false, message: "Los seguidores deben ser un entero mayor o igual que cero." };
  const existing = await db.pricingClientSignal.findUnique({
    where: { clientId_network: { clientId, network } },
  });
  const row =
    followers === null
      ? null
      : await db.pricingClientSignal.upsert({
          where: { clientId_network: { clientId, network } },
          create: { clientId, network, followers },
          update: { followers },
        });
  if (followers === null) await db.pricingClientSignal.deleteMany({ where: { clientId, network } });
  await logAudit({
    userId: user.id,
    action: followers === null ? "delete" : existing ? "update" : "create",
    entityType: "pricing_signal",
    entityId: row?.id ?? existing?.id ?? clientId,
    diff: { title: network, clientId, followers },
  });
  refresh();
  return { ok: true, message: "Señal del cliente guardada." };
}
