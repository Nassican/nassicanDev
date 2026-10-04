"use server";

import { revalidatePath } from "next/cache";
import type { SubscriptionStatus } from "@nassican/db";
import { logAudit } from "@/lib/audit";
import { fieldProblems, formatPartialDate } from "@/lib/draft-fields";
import { requireUser } from "@/lib/session";
import { subscriptionProblems, type SubscriptionDraft } from "@/lib/subscription-draft";
import {
  createSubscription,
  markPaid,
  setSubscriptionStatus,
  togglePeriod,
  updatePayment,
  updateSubscription,
} from "@/lib/subscriptions";
import { TRASH_DAYS, moveToTrash } from "@/lib/trash";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

function refresh() {
  revalidatePath("/suscripciones");
  revalidatePath("/personal");
  revalidatePath("/");
}

/** A server action is a public endpoint: the rules run here as well. */
export async function saveSubscription(draft: SubscriptionDraft): Promise<ActionResult> {
  const user = await requireUser();

  const problems = subscriptionProblems(draft);
  if (problems.length > 0) return { ok: false, message: problems.join(" ") };

  const id = draft.id ? (await updateSubscription(draft), draft.id) : await createSubscription(draft);
  await logAudit({
    userId: user.id,
    action: draft.id ? "update" : "create",
    entityType: "subscription",
    entityId: id,
    diff: { name: draft.name.trim() },
  });

  refresh();
  return { ok: true, message: `«${draft.name.trim()}» guardada.` };
}

export async function deleteSubscription(id: string, name: string): Promise<ActionResult> {
  const user = await requireUser();

  // Its payments go with it, into the trash, and come back with it.
  await moveToTrash("subscription", id, user.id);
  await logAudit({
    userId: user.id,
    action: "delete",
    entityType: "subscription",
    entityId: id,
    diff: { name, trash: true },
  });

  refresh();
  return { ok: true, message: `«${name}» está en la papelera durante ${TRASH_DAYS} días.` };
}

export async function changeStatus(id: string, status: SubscriptionStatus): Promise<ActionResult> {
  const user = await requireUser();
  const name = await setSubscriptionStatus(id, status);
  await logAudit({ userId: user.id, action: "update", entityType: "subscription", entityId: id, diff: { name, status } });
  refresh();
  return { ok: true, message: `«${name}» actualizada.` };
}

export async function payNow(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const { name, period, next } = await markPaid(id);
  await logAudit({ userId: user.id, action: "update", entityType: "subscription", entityId: id, diff: { name, paid: period } });
  refresh();
  return {
    ok: true,
    message: `${name}: ${formatPartialDate(period)} pagado.${next ? ` Próxima: ${formatPartialDate(next)}.` : ""}`,
  };
}

export async function togglePaidMonth(id: string, period: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return { ok: false, message: "Ese mes no existe." };

  const { name, paid } = await togglePeriod(id, period);
  await logAudit({
    userId: user.id,
    action: "update",
    entityType: "subscription",
    entityId: id,
    diff: paid ? { name, paid: period } : { name, unpaid: period },
  });
  refresh();
  return { ok: true, message: `${name}: ${formatPartialDate(period)} ${paid ? "marcado como pagado" : "ya no figura como pagado"}.` };
}

export async function savePayment(
  paymentId: string,
  fields: { amount: string; paidAt: string; note: string },
): Promise<ActionResult> {
  await requireUser();
  const problems = fieldProblems([
    { label: "El monto", value: fields.amount, kind: "amount" },
    { label: "pago", value: fields.paidAt, kind: "date" },
  ]);
  if (problems.length > 0) return { ok: false, message: problems.join(" ") };

  const label = await updatePayment(paymentId, fields);
  refresh();
  return { ok: true, message: `Pago de ${label} guardado.` };
}
