"use server";

import { revalidatePath } from "next/cache";
import { db } from "@nassican/db";
import { requireUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { fieldProblems, parseNumber } from "@/lib/draft-fields";
import {
  readPricingSettings,
  readPricingTiers,
  type PricingSettingsDraft,
  type PricingServiceDraft,
} from "@/lib/pricing-draft";
import { savePricingService } from "@/lib/pricing";
import type { PricingActionResult } from "../actions";
import type { PricingTierDraft } from "@/lib/pricing-draft";
function refresh() {
  for (const path of ["/precios", "/precios/parametros", "/precios/regiones", "/precios/mercado"])
    revalidatePath(path);
}

export async function saveTiersAction(drafts: PricingTierDraft[]): Promise<PricingActionResult> {
  const user = await requireUser();
  const tiers = readPricingTiers(drafts);
  if (!tiers)
    return {
      ok: false,
      message:
        "Los tramos deben cubrir desde cero, sin huecos ni cruces; el último no tiene límite superior. Revisa porcentajes (0 a 1), mínimos y máximos.",
    };
  await db.$transaction([
    db.pricingTier.deleteMany(),
    db.pricingTier.createMany({
      data: tiers,
    }),
  ]);
  await logAudit({
    userId: user.id,
    action: "update",
    entityType: "pricing_tiers",
    entityId: "tiers",
    diff: { title: "Tramos de precios", count: tiers.length },
  });
  refresh();
  return { ok: true, message: "Tramos guardados." };
}

export async function saveSettingsAction(
  draft: PricingSettingsDraft,
): Promise<PricingActionResult> {
  const user = await requireUser();
  const data = readPricingSettings(draft);
  if (!data)
    return {
      ok: false,
      message:
        "Revisa los parámetros: valores positivos, horas y redondeo mayores que cero, umbrales ordenados, tope entre 0 y 1 y multiplicador mínimo entre 0,5 y 1.",
    };
  await db.pricingSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });
  await logAudit({
    userId: user.id,
    action: "update",
    entityType: "pricing_settings",
    entityId: "singleton",
    diff: { title: "Parámetros de precios" },
  });
  refresh();
  return {
    ok: true,
    message: "Parámetros guardados. Las cotizaciones anteriores conservan su snapshot.",
  };
}
export async function saveServiceAction(draft: PricingServiceDraft): Promise<PricingActionResult> {
  const user = await requireUser();
  const problems = fieldProblems(
    ["typicalHours", "incomePercent", "minimum"].map((key) => ({
      label: key,
      value: draft[key as "typicalHours" | "incomePercent" | "minimum"],
      kind: "amount" as const,
    })),
  );
  if (
    !draft.name.trim() ||
    problems.length ||
    (parseNumber(draft.typicalHours) ?? 0) < 0.01 ||
    (parseNumber(draft.incomePercent) ?? -1) < 0 ||
    (parseNumber(draft.incomePercent) ?? 0) > 100 ||
    parseNumber(draft.minimum) === null
  )
    return {
      ok: false,
      message: "Indica nombre, horas positivas, porcentaje entre 0 y 100 y mínimo válido.",
    };
  const row = await savePricingService(draft);
  await logAudit({
    userId: user.id,
    action: draft.id ? "update" : "create",
    entityType: "pricing_service",
    entityId: row.id,
    diff: { title: row.name },
  });
  refresh();
  return { ok: true, message: "Servicio guardado." };
}
