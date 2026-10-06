"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BsArrowDown, BsArrowUp, BsLightning } from "react-icons/bs";
import Toast from "@/components/Toast";
import type { ActionResult } from "@/app/(panel)/rendimiento/actions";
import type { PageSpeedView } from "@/lib/pagespeed";
import { formatMs, metricTone, scoreTone, type Tone } from "@/lib/pagespeed-draft";
import { sinceLabel } from "@/lib/sync-health";

const labelClass = "font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500";

/** Text colours only: the score carries its own word too, so colour is never alone. */
const toneText: Record<Tone, string> = {
  good: "text-green-400",
  average: "text-amber-400",
  poor: "text-red-400",
};
const toneWord: Record<Tone, string> = { good: "bueno", average: "mejorable", poor: "malo" };

function Score({ value, big = false }: { value: number | null; big?: boolean }) {
  const tone = scoreTone(value);
  return (
    <span
      className={`font-mono tabular-nums ${big ? "text-2xl" : "text-sm"} ${tone ? toneText[tone] : "text-neutral-600"}`}
      title={tone ? toneWord[tone] : "sin medir"}
    >
      {value ?? "—"}
    </span>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: Tone | null }) {
  return (
    <span className="flex flex-col">
      <span className={labelClass}>{label}</span>
      <span className={`font-mono text-xs tabular-nums ${tone ? toneText[tone] : "text-neutral-500"}`}>{value}</span>
    </span>
  );
}

/**
 * Thirty days of the performance score as one thin line. A single series, so no
 * legend: the row says what it is, and the newest value sits next to it in text.
 */
function Trend({ points }: { points: { date: string; performance: number | null }[] }) {
  const values = points.filter((p): p is { date: string; performance: number } => p.performance !== null);
  if (values.length < 2) return <span className="text-[11px] text-neutral-600">sin historial</span>;
  const width = 96;
  const height = 28;
  const x = (i: number) => (i / (values.length - 1)) * width;
  const y = (v: number) => height - 2 - (v / 100) * (height - 4);
  const path = values.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.performance).toFixed(1)}`).join(" ");
  const first = values[0];
  const last = values[values.length - 1];
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Rendimiento de ${first.performance} el ${first.date} a ${last.performance} el ${last.date}`}
      className="text-neutral-400"
    >
      <title>{values.map((p) => `${p.date}: ${p.performance}`).join("\n")}</title>
      {/* The 90 line: «good» starts here. */}
      <line x1="0" x2={width} y1={y(90)} y2={y(90)} stroke="currentColor" strokeOpacity="0.2" strokeDasharray="2 3" />
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(values.length - 1)} cy={y(last.performance)} r="2.5" fill="currentColor" />
    </svg>
  );
}

/**
 * The public site's speed, as Google measures it.
 *
 * Lab numbers, from one Lighthouse run on Google's machines: they move a few
 * points from run to run with nothing changed. The module says so, and the
 * dashboard only speaks up for a drop of ten points or a fall under 50.
 */
export default function PerformanceModule({
  view,
  measure,
}: {
  view: PageSpeedView;
  measure: () => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const measured = view.targets.some((t) => t.latest);
  const failed = view.lastRun?.status === "failed";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Rendimiento</h1>
          <p className="mt-1 max-w-prose text-sm text-neutral-500">
            PageSpeed Insights sobre {view.origin ?? "el sitio público"}, cada día a la 01:00 con el resto del
            planificador. Móvil en cuatro páginas y escritorio en la portada, como referencia.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setResult(null);
              startTransition(async () => {
                const outcome = await measure();
                setResult(outcome);
                router.refresh();
              });
            }}
            className="inline-flex items-center gap-1.5 rounded border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 transition-colors hover:border-neutral-500 disabled:opacity-50"
          >
            <BsLightning className="h-3.5 w-3.5" aria-hidden />
            {pending ? "Midiendo… (hasta un minuto)" : "Medir ahora"}
          </button>
          {view.lastRun ? (
            <span className="text-[11px] text-neutral-500">
              Última medición {sinceLabel(new Date(view.lastRun.startedAt))}
              {failed ? " · falló" : ""}
            </span>
          ) : null}
        </div>
      </header>

      {failed && view.lastRun?.error ? (
        <p className="rounded border border-amber-900/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-300" role="status">
          {view.lastRun.error}
        </p>
      ) : !failed && view.lastRun?.error ? (
        <p className="rounded border border-neutral-800 px-4 py-2 text-xs text-neutral-400">{view.lastRun.error}</p>
      ) : null}

      {!measured ? (
        <p className="rounded border border-dashed border-neutral-800 px-6 py-12 text-center text-sm text-neutral-500">
          Todavía no hay mediciones. El planificador mide cada noche; «Medir ahora» lo hace al momento.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-900 rounded-lg border border-neutral-900">
          {view.targets.map((t) => {
            const latest = t.latest;
            const delta =
              latest?.performance != null && t.previous?.performance != null
                ? latest.performance - t.previous.performance
                : null;
            return (
              <li
                key={`${t.path}-${t.strategy}`}
                className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(9rem,1fr)_auto_minmax(0,2fr)_auto] sm:items-center"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm text-neutral-100">{t.label}</span>
                  <span className="font-mono text-[11px] text-neutral-500">
                    {t.path} · {t.strategy === "mobile" ? "móvil" : "escritorio"}
                  </span>
                </div>

                <div className="flex items-baseline gap-2">
                  <Score value={latest?.performance ?? null} big />
                  {delta !== null && delta !== 0 ? (
                    <span
                      className={`inline-flex items-center font-mono text-[11px] ${delta > 0 ? "text-green-400" : "text-red-400"}`}
                      title="Frente a la medición anterior"
                    >
                      {delta > 0 ? <BsArrowUp className="h-3 w-3" aria-hidden /> : <BsArrowDown className="h-3 w-3" aria-hidden />}
                      {Math.abs(delta)}
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  <span className="flex flex-col">
                    <span className={labelClass}>Accesib.</span>
                    <Score value={latest?.accessibility ?? null} />
                  </span>
                  <span className="flex flex-col">
                    <span className={labelClass}>Prácticas</span>
                    <Score value={latest?.bestPractices ?? null} />
                  </span>
                  <span className="flex flex-col">
                    <span className={labelClass}>SEO</span>
                    <Score value={latest?.seo ?? null} />
                  </span>
                  <Metric label="LCP" value={formatMs(latest?.lcpMs ?? null)} tone={metricTone("lcpMs", latest?.lcpMs ?? null)} />
                  <Metric label="TBT" value={formatMs(latest?.tbtMs ?? null)} tone={metricTone("tbtMs", latest?.tbtMs ?? null)} />
                  <Metric
                    label="CLS"
                    value={latest?.cls != null ? latest.cls.toFixed(3).replace(".", ",") : "—"}
                    tone={metricTone("cls", latest?.cls ?? null)}
                  />
                </div>

                <Trend points={t.history} />
              </li>
            );
          })}
        </ul>
      )}

      <section className="flex flex-col gap-1.5 text-xs text-neutral-500" aria-label="Cómo leerlo">
        <p>
          <span className="text-green-400">90 o más</span> es bueno, <span className="text-amber-400">50 a 89</span>{" "}
          mejorable y <span className="text-red-400">menos de 50</span> malo, con las bandas de Lighthouse. LCP es lo
          que tarda en verse lo principal, TBT cuánto se bloquea la página al cargar y CLS cuánto salta el contenido.
        </p>
        <p>
          Son números de laboratorio: una sola carga en una máquina de Google, que varía unos puntos entre una vez y
          otra sin que nada cambie. Por eso el dashboard solo avisa de una caída de 10 puntos o de bajar de 50.
        </p>
      </section>

      <Toast result={result} onDismiss={() => setResult(null)} />
    </div>
  );
}
