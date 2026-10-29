"use server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@nassican/db";
import type { BillingIssuer } from "@nassican/shared";
import { requireUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { BillingInputError, type BillingPlanDraft } from "@/lib/billing-values";
import {
  saveBillingPlan,
  saveBillingIssuer,
  issueBillingCharge,
  recordBillingReceipt,
  cancelBillingCharge,
  recordFlexibleReceipt,
  saveExpectedPayment,
  removeExpectedPayment,
  type FlexibleReceiptDraft,
  type ExpectedPaymentDraft,
} from "@/lib/billing";
export type BillingActionResult = { ok: boolean; message: string; id?: string };
async function mutation(
  run: () => Promise<{ id: string } | void>,
  action: string,
  message: string,
): Promise<BillingActionResult> {
  const user = await requireUser();
  try {
    const row = await run();
    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "billing",
      entityId: row?.id ?? "singleton",
      diff: { title: action },
    });
    for (const path of ["/precios/cobros", "/precios/cotizaciones", "/precios", "/trabajos"])
      revalidatePath(path);
    return { ok: true, message, id: row?.id };
  } catch (error) {
    if (error instanceof BillingInputError) return { ok: false, message: error.message };
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2002", "P2034"].includes(error.code)
    )
      return {
        ok: false,
        message:
          "Otra operación cambió estos datos. Actualiza la página y vuelve a intentarlo para evitar duplicados.",
      };
    return { ok: false, message: "No se pudo guardar. Revisa la conexión y actualiza la página." };
  }
}
export async function saveBillingIssuerAction(value: BillingIssuer) {
  return mutation(
    () => saveBillingIssuer(value),
    "Datos del emisor",
    "Datos del emisor guardados para propuestas futuras.",
  );
}
export async function saveBillingPlanAction(value: BillingPlanDraft) {
  return mutation(
    () => saveBillingPlan(value),
    "Plan de cuotas",
    value.mode === "flexible"
      ? "Acuerdo por avances guardado. Ya puedes registrar lo recibido y lo previsto."
      : "Plan de cuotas guardado y conectado con el acuerdo.",
  );
}

export async function recordFlexibleReceiptAction(input: FlexibleReceiptDraft) {
  return mutation(
    () => recordFlexibleReceipt(input),
    "Pago por avance recibido",
    "Pago recibido registrado; el saldo del proyecto se actualizó.",
  );
}
export async function saveExpectedPaymentAction(input: ExpectedPaymentDraft) {
  return mutation(
    () => saveExpectedPayment(input),
    "Pago previsto por avance",
    "Previsión guardada. El saldo no cambia hasta recibir el dinero.",
  );
}
export async function removeExpectedPaymentAction(planId: string, id: string) {
  return mutation(
    () => removeExpectedPayment(planId, id),
    "Previsión de pago retirada",
    "Previsión retirada; los pagos recibidos se conservaron.",
  );
}
export async function issueBillingChargeAction(
  planId: string,
  installmentId: string,
  concept: string,
) {
  return mutation(
    () => issueBillingCharge(planId, installmentId, concept),
    "Cuenta de cobro emitida",
    "Cuenta de cobro emitida. Sus datos y su importe quedan conservados.",
  );
}
export async function recordBillingReceiptAction(value: {
  id: string;
  chargeId: string;
  amount: string;
  paidAt: string;
  reference: string;
}) {
  return mutation(
    () => recordBillingReceipt(value),
    "Abono registrado",
    "Abono registrado; el saldo se actualizó.",
  );
}
export async function cancelBillingChargeAction(id: string, reason: string) {
  return mutation(
    () => cancelBillingCharge(id, reason),
    "Cuenta de cobro anulada",
    "Cuenta anulada conservando el historial.",
  );
}
