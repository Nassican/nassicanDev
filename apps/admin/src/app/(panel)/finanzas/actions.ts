"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { syncWallet } from "@/lib/wallet";

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

/**
 * Brings Wallet into the mirror. The only action this module has — there is no
 * write path to Wallet, by design, so there is nothing else to offer.
 */
export async function runWalletSync(): Promise<ActionResult> {
  const actor = await requireUser();

  const result = await syncWallet();
  revalidatePath("/finanzas");

  if (!result.ok) return { ok: false, message: result.reason };

  await logAudit({
    userId: actor.id,
    action: "sync",
    entityType: "wallet",
    diff: { label: `${result.records} movimientos`, requests: result.requests },
  });

  const budget =
    result.remaining !== null
      ? ` Quedan ${result.remaining} peticiones de la hora.`
      : "";

  return {
    ok: true,
    message:
      `${result.records} movimientos, ${result.accounts} cuentas, ` +
      `${result.categories} categorías y ${result.budgets} presupuestos ` +
      `en ${result.requests} peticiones.${budget}`,
  };
}
