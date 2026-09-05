"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import VisitsChart from "@/components/VisitsChart";
import type { AnalyticsSummary, NamedRow } from "@/lib/analytics-summary";
import type {
  ActionResult,
  DetectedProperty,
  DetectPropertiesResult,
} from "@/app/(panel)/analitica/actions";

const field =
  "rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-100 focus:border-neutral-600 focus:outline-none";
const labelStyle =
  "font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500";
const ghost =
  "rounded border border-neutral-800 px-2.5 py-1 text-xs text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-200 disabled:opacity-40";
const primary =
  "rounded border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 transition-colors hover:border-neutral-500 disabled:opacity-50";

const num = new Intl.NumberFormat("es-CO");

function duration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/** A ranked list with a bar behind each row, so magnitude reads without a chart. */
function Ranked({
  title,
  rows,
  unit,
}: {
  title: string;
  rows: NamedRow[];
  unit: "sessions" | "users";
}) {
  const max = Math.max(1, ...rows.map((r) => r[unit]));

  return (
    <div className="flex flex-col gap-2">
      <h3 className={labelStyle}>{title}</h3>
      {rows.length === 0 ? (
        <p className="text-[11px] text-neutral-600">Sin datos</p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((row) => (
            <li
              key={row.name}
              className="relative flex items-center justify-between gap-3 border-b border-neutral-900 px-1.5 py-1.5 text-[12px] last:border-b-0"
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 rounded-sm bg-neutral-900"
                style={{ width: `${(row[unit] / max) * 100}%` }}
              />
              <span className="relative min-w-0 truncate text-neutral-300">
                {row.name}
              </span>
              <span className="relative shrink-0 tabular-nums text-neutral-400">
                {num.format(row[unit])}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AnalyticsModule({
  summary,
  measurementIdSet,
  actions,
}: {
  summary: AnalyticsSummary;
  measurementIdSet: boolean;
  actions: {
    sync: (days: number) => Promise<ActionResult>;
    detect: () => Promise<DetectPropertiesResult>;
  };
}) {
  const router = useRouter();
  const [days, setDays] = useState(28);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [properties, setProperties] = useState<DetectedProperty[]>([]);
  const [detectError, setDetectError] = useState<string | null>(null);

  const tiles = [
    { label: "Usuarios", value: num.format(summary.totals.users) },
    { label: "Nuevos", value: num.format(summary.totals.newUsers) },
    { label: "Sesiones", value: num.format(summary.totals.sessions) },
    { label: "Vistas", value: num.format(summary.totals.pageViews) },
    { label: "Duración media", value: duration(summary.totals.avgSessionSeconds) },
    {
      label: "Interacción",
      value: `${(summary.totals.engagementRate * 100).toFixed(0)}%`,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Analítica</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Visitas, fuentes y páginas más vistas, desde Google Analytics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            className={field}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>7 días</option>
            <option value={28}>28 días</option>
            <option value={90}>90 días</option>
          </select>
          <button
            type="button"
            className={primary}
            disabled={pending || !summary.configured}
            onClick={() => {
              setResult(null);
              startTransition(async () => {
                const outcome = await actions.sync(days);
                setResult(outcome);
                if (outcome.ok) router.refresh();
              });
            }}
          >
            {pending ? "Sincronizando…" : "Sincronizar"}
          </button>
        </div>
      </header>

      {result ? (
        <p
          role="status"
          className={`rounded border px-4 py-3 text-sm ${
            result.ok
              ? "border-green-900/60 bg-green-950/30 text-green-300"
              : "border-red-900/60 bg-red-950/30 text-red-300"
          }`}
        >
          {result.message}
        </p>
      ) : null}

      {!summary.configured ? (
        <section className="flex flex-col gap-3 rounded-lg border border-neutral-900 p-5">
          <h2 className="text-sm font-semibold">Falta la propiedad de GA4</h2>
          <p className="max-w-prose text-sm text-neutral-500">
            El id de propiedad es numérico y no es el <code>G-XXXXXXX</code> de
            medición: uno es a donde el sitio <strong>envía</strong>, el otro es de
            donde el panel <strong>lee</strong>. Detéctalo aquí y guárdalo en{" "}
            <Link href="/seo" className="underline underline-offset-4">
              SEO → Metadatos globales
            </Link>
            .
          </p>

          <button
            type="button"
            className={`${ghost} w-fit`}
            disabled={pending}
            onClick={() => {
              setDetectError(null);
              startTransition(async () => {
                const found = await actions.detect();
                if (found.ok) {
                  setProperties(found.properties);
                  if (found.properties.length === 0) {
                    setDetectError(
                      "Esta cuenta de Google no tiene ninguna propiedad de GA4.",
                    );
                  }
                } else {
                  setDetectError(found.message);
                }
              });
            }}
          >
            {pending ? "Consultando…" : "Detectar propiedades"}
          </button>

          {properties.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {properties.map((p) => (
                <li key={p.id} className="text-sm text-neutral-300">
                  <span className="font-mono text-neutral-100">{p.id}</span>
                  <span className="text-neutral-600"> · {p.name}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {detectError ? (
            <p role="alert" className="text-[11px] text-red-400">
              {detectError}
            </p>
          ) : null}
        </section>
      ) : null}

      {!measurementIdSet ? (
        <p className="rounded border border-amber-900/60 bg-amber-950/20 px-4 py-3 text-sm text-amber-300">
          El sitio público no lleva la etiqueta de GA4:{" "}
          <code>NEXT_PUBLIC_GA_MEASUREMENT_ID</code> no está definida en su
          proyecto de Vercel. Sin ella no se recoge nada que sincronizar.
        </p>
      ) : null}

      {summary.lastSync ? (
        <p className="text-[11px] text-neutral-600">
          Última sincronización:{" "}
          {summary.lastSync.at.slice(0, 16).replace("T", " ")} ·{" "}
          <span
            className={
              summary.lastSync.status === "ok" ? "text-green-400" : "text-red-400"
            }
          >
            {summary.lastSync.status}
          </span>
          {summary.lastSync.status === "ok"
            ? ` · ${summary.lastSync.rows} filas`
            : ` · ${summary.lastSync.error ?? ""}`}
        </p>
      ) : null}

      {summary.daily.length === 0 ? (
        <p className="rounded border border-dashed border-neutral-800 px-6 py-14 text-center text-sm text-neutral-500">
          Todavía no hay datos sincronizados. GA4 tarda unas horas en procesar
          cada día, así que el rango termina dos días atrás.
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-neutral-900 bg-neutral-900 lg:grid-cols-6">
            {tiles.map((tile) => (
              <div key={tile.label} className="flex flex-col gap-1 bg-neutral-950 p-3">
                <dt className={labelStyle}>{tile.label}</dt>
                <dd className="text-xl font-semibold tabular-nums">{tile.value}</dd>
              </div>
            ))}
          </dl>

          <section className="rounded-lg border border-neutral-900 p-5">
            <VisitsChart data={summary.daily} />
          </section>

          <section className="flex flex-col gap-4 rounded-lg border border-neutral-900 p-5">
            <h2 className={labelStyle}>Páginas más vistas</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left text-neutral-600">
                    <th className="pb-1 font-normal">Ruta</th>
                    <th className="pb-1 font-normal">Idioma</th>
                    <th className="pb-1 text-right font-normal">Vistas</th>
                    <th className="pb-1 text-right font-normal">Usuarios</th>
                    <th className="pb-1 text-right font-normal">Tiempo medio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900">
                  {summary.pages.map((page) => (
                    <tr key={page.path}>
                      <td className="max-w-72 truncate py-1 pr-2 text-neutral-300">
                        {page.path}
                      </td>
                      <td className="py-1 pr-2 font-mono text-[10px] text-neutral-600">
                        {page.locale ?? "—"}
                      </td>
                      <td className="py-1 text-right tabular-nums">
                        {num.format(page.pageViews)}
                      </td>
                      <td className="py-1 text-right tabular-nums text-neutral-500">
                        {num.format(page.users)}
                      </td>
                      <td className="py-1 text-right tabular-nums text-neutral-500">
                        {duration(page.avgEngagementSeconds)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-6 rounded-lg border border-neutral-900 p-5 lg:grid-cols-2">
            <Ranked title="Canales" rows={summary.channels} unit="sessions" />
            <Ranked title="Fuentes" rows={summary.sources} unit="sessions" />
            <Ranked title="Países" rows={summary.countries} unit="users" />
            <Ranked title="Dispositivos" rows={summary.devices} unit="sessions" />
          </section>
        </>
      )}
    </div>
  );
}
