"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { PricingStatus } from "@nassican/shared";
import {
  changeQuoteStatusAction,
  quickQuoteAction,
  deletePricingQuoteAction,
} from "@/app/(panel)/precios/actions";
import type { PricingQuoteRow } from "@/lib/pricing";
import { grouped, pricingMoney, quoteStatusLabels } from "@/lib/pricing-draft";
import type { ListFilters as Filters } from "@/lib/list-filters";
import { filterList } from "@/lib/list-filters";
import ListFilters from "./ListFilters";
import { Pager, usePage } from "./Pager";
import QuickField from "./QuickField";
import Toast, { type ToastResult } from "./Toast";
import PricingTabs from "./PricingTabs";
import PricingResult from "./PricingResult";
import PricingPdfDownload from "./PricingPdfDownload";
import { pricingFieldBase, pricingButton } from "./PricingFields";

export default function PricingQuotes({
  rows,
  filters,
}: {
  rows: PricingQuoteRow[];
  filters: Filters;
}) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<ToastResult | null>(null);
  const [pending, startTransition] = useTransition();
  const filtered = filterList(rows, filters, (r) => ({
    title: `${r.title} ${r.snapshot.client.name}`,
    handle: r.id,
    status: r.status,
    date: r.createdAt,
  }));
  const page = usePage(filtered, 20);
  function remove(id: string, title: string) {
    if (
      !confirm(
        `¿Mover «${title}» a la papelera? Puede restaurarse durante 30 días. El trabajo enlazado se conserva.`,
      )
    )
      return;
    startTransition(async () => {
      try {
        const result = await deletePricingQuoteAction(id);
        setOutcome(result);
        if (result.ok) router.refresh();
      } catch {
        setOutcome({
          ok: false,
          message: "No se pudo mover la cotización a la papelera.",
        });
      }
    });
  }
  return (
    <div className="flex flex-col gap-6">
      <PricingTabs current="quotes" />
      <header>
        <h1 className="text-xl font-semibold">Cotizaciones</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Cada decisión conserva los datos y parámetros usados en su momento. Se muestran las
          últimas 1.000.
        </p>
      </header>
      <ListFilters
        base="/precios/cotizaciones"
        filters={filters}
        statuses={Object.entries(quoteStatusLabels).map(([value, label]) => ({
          value,
          label,
        }))}
        total={rows.length}
        shown={filtered.length}
      />
      {!filtered.length ? (
        <p className="rounded border border-neutral-800 p-5 text-sm text-neutral-500">
          No hay cotizaciones en esta vista. Crea la primera en Calcular.
        </p>
      ) : null}
      {page.rows.map((r) => (
        <article key={r.id} className="min-w-0 rounded-lg border border-neutral-800 p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 basis-full sm:basis-64 sm:flex-1">
              <h2 className="break-words text-sm font-medium">{r.title}</h2>
              <p className="mt-1 text-xs text-neutral-500">
                {r.snapshot.client.name}, {r.snapshot.service.name}. Vigencia:{" "}
                {r.validUntil ?? "sin fecha"}
                {r.snapshot.result.family
                  ? ` · Tarifa familiar (${Math.round(r.snapshot.result.family.percent * 10000) / 100} %)`
                  : ""}
              </p>
              <p className="mt-2 text-sm">
                Final {pricingMoney(r.final, r.currency)} · Sugerido{" "}
                {pricingMoney(r.suggested, r.currency)}
              </p>
            </div>
            <select
              aria-label={`Estado de ${r.title}`}
              className={`w-32 ${pricingFieldBase}`}
              value={r.status}
              disabled={pending || r.status === "accepted"}
              onChange={(e) =>
                startTransition(async () => {
                  try {
                    const result = await changeQuoteStatusAction(
                      r.id,
                      e.target.value as PricingStatus,
                    );
                    setOutcome(result);
                    if (result.ok) router.refresh();
                  } catch {
                    setOutcome({
                      ok: false,
                      message: "No se pudo cambiar el estado. Inténtalo de nuevo.",
                    });
                  }
                })
              }
            >
              {Object.entries(quoteStatusLabels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            {r.status === "draft" ? (
              <QuickField
                key={r.final}
                label="Precio final"
                width="w-32"
                value={grouped(r.final)}
                onSave={async (raw) => {
                  try {
                    const result = await quickQuoteAction(r.id, raw);
                    setOutcome(result);
                    if (result.ok) router.refresh();
                    return result;
                  } catch {
                    const result = {
                      ok: false,
                      message: "No se pudo guardar el precio.",
                    };
                    setOutcome(result);
                    return result;
                  }
                }}
              />
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <PricingPdfDownload id={r.id} />
            <Link href={`/precios/cobros?quoteId=${r.id}`} className={pricingButton}>Cuotas y cuenta de cobro</Link>
            {r.projectId ? (
              <Link href="/trabajos" className="text-xs text-neutral-400 underline">
                Ver trabajo enlazado
              </Link>
            ) : null}
            <button
              className={pricingButton}
              disabled={pending}
              onClick={() => remove(r.id, r.title)}
            >
              Mover cotización a la papelera
            </button>
          </div>
          <details className="mt-4">
            <summary className="cursor-pointer text-xs text-neutral-400">
              Ver desglose guardado
            </summary>
            <div className="mt-4 max-w-xl">
              <PricingResult result={r.snapshot.result} snapshot={r.snapshot} />
            </div>
          </details>
        </article>
      ))}
      <Pager {...page} shown={page.rows.length} label="cotizaciones" onPage={page.setPage} />
      <Toast result={outcome} onDismiss={() => setOutcome(null)} />
    </div>
  );
}
