"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PricingTierInput } from "@nassican/shared";
import { saveTiersAction } from "@/app/(panel)/precios/parametros/actions";
import { grouped, type PricingTierDraft } from "@/lib/pricing-draft";
import { isDirty, useUnsavedChanges } from "@/lib/use-unsaved";
import Toast, { type ToastResult } from "./Toast";
import {
  PricingLabel as Label,
  PricingSection as Section,
  pricingField as field,
  pricingButton as button,
  pricingPrimary as primary,
} from "./PricingFields";

export default function PricingTiers({ tiers }: { tiers: PricingTierInput[] }) {
  const router = useRouter();
  const initial = tiers.map((t) => ({
    fromIncome: grouped(t.fromIncome),
    toIncome: grouped(t.toIncome),
    percent: grouped(t.percent),
    minimum: grouped(t.minimum),
    maximum: grouped(t.maximum),
  }));
  const [draft, setDraft] = useState<PricingTierDraft[]>(initial);
  const [outcome, setOutcome] = useState<ToastResult | null>(null);
  const [pending, startTransition] = useTransition();
  useUnsavedChanges(isDirty(initial, draft));
  return (
    <Section title="Tramos de ingresos operacionales mensuales de empresas">
      <p className="text-xs text-neutral-500">
        Desde incluido, hasta excluido. El último tramo queda sin límite superior. Por defecto: 0,01
        (1 %) en todos. La cuota aplica salud y tope por utilidad.
      </p>
      {draft.map((t, index) => (
        <div
          key={index}
          className="grid gap-3 border-b border-neutral-900 pb-4 sm:grid-cols-3 xl:grid-cols-6"
        >
          {(
            [
              ["fromIncome", "Desde, COP al mes"],
              ["toIncome", "Hasta, COP al mes"],
              ["percent", "Proporción (0,01 = 1 %)"],
              ["minimum", "Cuota mínima, COP"],
              ["maximum", "Cuota máxima, COP"],
            ] as const
          ).map(([k, label]) => (
            <Label key={k} label={label}>
              <input
                className={field}
                inputMode="decimal"
                value={t[k]}
                onChange={(e) =>
                  setDraft((rows) =>
                    rows.map((r, i) => (i === index ? { ...r, [k]: e.target.value } : r)),
                  )
                }
              />
            </Label>
          ))}
          <button
            className={button}
            onClick={() => setDraft((rows) => rows.filter((_, i) => i !== index))}
          >
            Quitar tramo
          </button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <button
          className={button}
          onClick={() =>
            setDraft((rows) => [
              ...rows,
              {
                fromIncome: "",
                toIncome: "",
                percent: "0,01",
                minimum: "0",
                maximum: "100.000.000",
              },
            ])
          }
        >
          Añadir tramo
        </button>
        <button
          className={primary}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                const result = await saveTiersAction(draft);
                setOutcome(result);
                if (result.ok) router.refresh();
              } catch {
                setOutcome({ ok: false, message: "No se pudieron guardar los tramos." });
              }
            })
          }
        >
          Guardar tramos
        </button>
      </div>
      <Toast result={outcome} onDismiss={() => setOutcome(null)} />
    </Section>
  );
}
