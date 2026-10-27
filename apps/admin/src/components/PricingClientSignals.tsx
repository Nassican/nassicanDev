"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PricingNetwork } from "@nassican/db";
import { saveClientSignalAction } from "@/app/(panel)/precios/actions";
import { grouped } from "@/lib/pricing-draft";
import QuickField from "./QuickField";
import Toast, { type ToastResult } from "./Toast";

const networks: { key: PricingNetwork; label: string }[] = [
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "tiktok", label: "TikTok" },
  { key: "youtube", label: "YouTube" },
  { key: "x", label: "X" },
  { key: "other", label: "Otra red" },
];
export default function PricingClientSignals({
  clientId,
  signals,
}: {
  clientId: string;
  signals: { network: PricingNetwork; followers: number }[];
}) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<ToastResult | null>(null);
  return (
    <details className="border-t border-neutral-800 pt-3">
      <summary className="cursor-pointer text-xs text-neutral-400">
        Señales del cliente: seguidores declarados
      </summary>
      <p className="mt-2 text-xs text-neutral-500">
        Contexto registrado por red. Los seguidores no se convierten en ingresos ni determinan la
        capacidad. Vacía un campo para quitarlo.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {networks.map((network) => {
          const value = grouped(signals.find((s) => s.network === network.key)?.followers ?? null);
          return (
            <QuickField
              key={`${network.key}:${value}`}
              label={network.label}
              value={value}
              inputMode="numeric"
              width="w-28"
              onSave={async (raw) => {
                try {
                  const result = await saveClientSignalAction(clientId, network.key, raw);
                  setOutcome(result);
                  if (result.ok) router.refresh();
                  return result;
                } catch {
                  const result = { ok: false, message: "No se pudo guardar la señal del cliente." };
                  setOutcome(result);
                  return result;
                }
              }}
            />
          );
        })}
      </div>
      <Toast result={outcome} onDismiss={() => setOutcome(null)} />
    </details>
  );
}
