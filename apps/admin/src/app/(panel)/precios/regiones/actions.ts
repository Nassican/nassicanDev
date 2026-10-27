"use server";
import { revalidatePath } from "next/cache";
import type { PricingLocation, PricingMode, PricingScope, PricingUnit } from "@nassican/shared";
import { calendarDate } from "@nassican/shared";
import { requireUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { getMarketQuotes, saveRegionFactor, saveIncomeEstimate } from "@/lib/pricing";
import {
  incomeEstimateProblems,
  observedRegionalFactor,
  regionFactorProblems,
  type RegionFactorDraft,
  type IncomeEstimateDraft,
} from "@/lib/pricing-geography";
import { getTrm } from "@/lib/trm";
import { getTimezone } from "@/lib/site-config";
import { grouped } from "@/lib/pricing-draft";
import type { PricingActionResult } from "../actions";

function refresh() {
  for (const path of ["/precios", "/precios/regiones", "/precios/mercado"]) revalidatePath(path);
}
export async function saveRegionFactorAction(
  draft: RegionFactorDraft,
): Promise<PricingActionResult> {
  const user = await requireUser();
  const problems = regionFactorProblems(draft);
  if (problems.length) return { ok: false, message: problems.join(" ") };
  const row = await saveRegionFactor(draft);
  await logAudit({
    userId: user.id,
    action: row.created ? "create" : "update",
    entityType: "pricing_factor",
    entityId: row.id,
    diff: { title: draft.justification, origin: "manual" },
  });
  refresh();
  return { ok: true, message: "Factor manual guardado con su justificación y fecha." };
}
export async function saveObservedFactorAction(
  target: PricingLocation,
  reference: PricingLocation,
  selection: { serviceId: string; scope: PricingScope; unit: PricingUnit; mode: PricingMode },
): Promise<PricingActionResult> {
  const user = await requireUser();
  const [quotes, trm, timezone] = await Promise.all([getMarketQuotes(), getTrm(), getTimezone()]);
  const observed = observedRegionalFactor(quotes, target, reference, selection, trm);
  if (observed.factor === null) return { ok: false, message: observed.explanation };
  const draft = {
    ...target,
    id: "",
    serviceId: selection.serviceId,
    mode: selection.mode,
    factor: grouped(observed.factor),
    justification: `${observed.explanation} Referencia: ${[reference.country, reference.department, reference.municipality].filter(Boolean).join(", ")}.`,
    date: calendarDate(timezone),
  };
  const problems = regionFactorProblems(draft);
  if (problems.length) return { ok: false, message: problems.join(" ") };
  const row = await saveRegionFactor(draft, "observed");
  await logAudit({
    userId: user.id,
    action: row.created ? "create" : "update",
    entityType: "pricing_factor",
    entityId: row.id,
    diff: { title: draft.justification, origin: "observed" },
  });
  refresh();
  return { ok: true, message: "Factor observado guardado a partir de las medianas comparables." };
}
export async function saveIncomeEstimateAction(
  draft: IncomeEstimateDraft,
): Promise<PricingActionResult> {
  const user = await requireUser();
  const problems = incomeEstimateProblems(draft);
  if (problems.length) return { ok: false, message: problems.join(" ") };
  const row = await saveIncomeEstimate(draft);
  await logAudit({
    userId: user.id,
    action: row.created ? "create" : "update",
    entityType: "pricing_income",
    entityId: row.id,
    diff: { title: draft.justification, stratum: row.stratum },
  });
  refresh();
  return { ok: true, message: "Ingreso estimado guardado. Siempre se mostrará como estimado." };
}
