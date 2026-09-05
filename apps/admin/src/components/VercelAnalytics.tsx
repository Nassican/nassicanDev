"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { VercelSummary } from "@/lib/vercel";
import type { ActionResult } from "@/app/(panel)/analitica/actions";

const labelStyle =
  "font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500";
const primary =
  "rounded border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 transition-colors hover:border-neutral-500 disabled:opacity-50";

const num = new Intl.NumberFormat("es-CO");

function Ranked({
  title,
  rows,
}: {
  title: string;
  rows: { value: string; pageviews: number; visitors: number }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.pageviews));

  return (
    <div className="flex flex-col gap-2">
      <h3 className={labelStyle}>{title}</h3>
      {rows.length === 0 ? (
        <p className="text-[11px] text-neutral-600">Sin datos</p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((row) => (
            <li
              key={row.value}
              className="relative flex items-center justify-between gap-3 border-b border-neutral-900 px-1.5 py-1.5 text-[12px] last:border-b-0"
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 rounded-sm bg-neutral-900"
                style={{ width: `${(row.pageviews / max) * 100}%` }}
              />
              <span className="relative min-w-0 truncate text-neutral-300">
                {row.value || "(directo)"}
              </span>
              <span className="relative shrink-0 tabular-nums text-neutral-400">
                {num.format(row.pageviews)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Vercel Web Analytics beside GA4, not instead of it.
 *
 * They disagree on purpose and the difference is the point: Vercel counts
 * every visit without cookies, so it is not lost to the ad blockers that a
 * developer audience runs, while GA4 knows about sessions, engagement and
 * where people came from. Reading one against the other is how you find out
 * how much GA4 is missing.
 */
export default function VercelAnalytics({
  summary,
  sync,
}: {
  summary: VercelSummary;
  sync: () => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const { totals, byDay, top, lastSync } = summary;
  const peak = Math.max(1, ...byDay.map((d) => d.pageviews));

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-neutral-900 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Vercel Web Analytics</h2>
          <p className="mt-0.5 max-w-prose text-xs text-neutral-600">
            Cuenta sin cookies, así que no la pierden los bloqueadores — que en
            una audiencia de desarrolladores distorsionan bastante a GA4. Si las
            dos cifras no coinciden, la diferencia es justo lo que GA4 no ve.
          </p>
        </div>
        <button
          type="button"
          className={primary}
          disabled={pending || !summary.configured}
          onClick={() => {
            setResult(null);
            startTransition(async () => {
              const outcome = await sync();
              setResult(outcome);
              if (outcome.ok) router.refresh();
            });
          }}
        >
          {pending ? "Sincronizando…" : "Sincronizar"}
        </button>
      </header>

      {result ? (
        <p
          role="status"
          className={`rounded border px-3 py-2 text-[12px] ${
            result.ok
              ? "border-green-900/60 bg-green-950/30 text-green-300"
              : "border-red-900/60 bg-red-950/30 text-red-300"
          }`}
        >
          {result.message}
        </p>
      ) : null}

      {!summary.configured ? (
        <div className="rounded border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-sm text-amber-300">
          <p>
            Falta <span className="font-mono">{summary.missing.join(" y ")}</span>{" "}
            en el entorno del panel.
          </p>
          <p className="mt-2 text-[11px] text-amber-300/70">
            El token tiene que alcanzar el proyecto de{" "}
            <span className="font-mono">nassican.com</span>, no el del panel: es
            el sitio público quien recibe las visitas. Y antes de eso, Web
            Analytics tiene que estar activado en ese proyecto — el paquete{" "}
            <span className="font-mono">@vercel/analytics</span> ya está en el
            sitio, pero con el interruptor apagado no se guarda nada. El id lo
            lista Sistema.
          </p>
        </div>
      ) : byDay.length === 0 ? (
        <p className="rounded border border-dashed border-neutral-800 px-5 py-8 text-center text-sm text-neutral-500">
          Sin datos todavía. Pulsa «Sincronizar»; si sigue vacío, es que Web
          Analytics no está activado en el proyecto de Vercel.
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded border border-neutral-900 bg-neutral-900 sm:grid-cols-3">
            <div className="flex flex-col gap-1 bg-neutral-950 p-3">
              <dt className={labelStyle}>Páginas vistas</dt>
              <dd className="text-xl font-semibold tabular-nums">
                {num.format(totals.pageviews)}
              </dd>
              <p className="text-[11px] text-neutral-600">
                {summary.from} → {summary.to}
              </p>
            </div>
            <div className="flex flex-col gap-1 bg-neutral-950 p-3">
              <dt className={labelStyle}>Día más visitado</dt>
              <dd className="text-xl font-semibold tabular-nums">
                {num.format(totals.visitors)}
              </dd>
              {/* Visitors are unique per day, so they cannot be added across
                  days without counting the same person twice. */}
              <p className="text-[11px] text-neutral-600">visitantes únicos</p>
            </div>
            <div className="flex flex-col gap-1 bg-neutral-950 p-3">
              <dt className={labelStyle}>Días con datos</dt>
              <dd className="text-xl font-semibold tabular-nums">
                {num.format(byDay.length)}
              </dd>
              {lastSync ? (
                <p className="text-[11px] text-neutral-600">
                  sincronizado {lastSync.at.slice(0, 16).replace("T", " ")}
                </p>
              ) : null}
            </div>
          </dl>

          <div className="flex items-end gap-0.5" role="img" aria-label="Páginas vistas por día">
            {byDay.map((day) => (
              <span
                key={day.date}
                title={`${day.date}: ${num.format(day.pageviews)} vistas, ${num.format(day.visitors)} visitantes`}
                className="flex-1 rounded-sm bg-neutral-700"
                style={{ height: `${Math.max(3, (day.pageviews / peak) * 56)}px` }}
              />
            ))}
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <Ranked title="Rutas" rows={top.route} />
            <Ranked title="Procedencia" rows={top.referrer} />
            <Ranked title="Países" rows={top.country} />
            <Ranked title="Dispositivos" rows={top.device} />
          </div>
        </>
      )}
    </section>
  );
}
