"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { StatsSummary } from "@/lib/stats";
import type { ActionResult } from "@/app/(panel)/estadisticas/actions";

const labelStyle =
  "font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500";
const primary =
  "rounded border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 transition-colors hover:border-neutral-500 disabled:opacity-50";

const num = new Intl.NumberFormat("es-CO");

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-1 bg-neutral-950 p-3">
      <dt className={labelStyle}>{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
      {note ? <p className="text-[11px] text-neutral-600">{note}</p> : null}
    </div>
  );
}

/**
 * Coverage as a bar rather than a number alone: the gap is the point, and a
 * bar shows how much is left without anyone doing arithmetic.
 */
function CoverageBar({ ratio }: { ratio: number }) {
  const pct = Math.round(ratio * 100);
  const done = ratio === 1;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className={labelStyle}>Cobertura de traducción</span>
        <span
          className={`text-lg font-semibold tabular-nums ${done ? "text-green-400" : "text-amber-400"}`}
        >
          {pct}%
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-neutral-900"
        role="img"
        aria-label={`${pct} por ciento del contenido está completo en los dos idiomas`}
      >
        <div
          className={`h-full rounded-full ${done ? "bg-green-500" : "bg-amber-500"}`}
          style={{ width: `${Math.max(pct, 1)}%` }}
        />
      </div>
    </div>
  );
}

export default function StatsModule({
  stats,
  actions,
}: {
  stats: StatsSummary;
  actions: { check: () => Promise<ActionResult> };
}) {
  const router = useRouter();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const { health, coverage, links, history } = stats;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Estadísticas</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Salud del contenido, cobertura de traducción y enlaces rotos.
          </p>
        </div>

        <button
          type="button"
          className={primary}
          disabled={pending}
          onClick={() => {
            setResult(null);
            startTransition(async () => {
              const outcome = await actions.check();
              setResult(outcome);
              if (outcome.ok) router.refresh();
            });
          }}
        >
          {pending ? "Revisando…" : "Revisar ahora"}
        </button>
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

      {/* ------------------------- Salud del contenido ----------------------- */}
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-neutral-900 bg-neutral-900 lg:grid-cols-4">
        <Tile
          label="Artículos"
          value={num.format(health.posts.published)}
          note={health.posts.draft > 0 ? `${health.posts.draft} en borrador` : "publicados"}
        />
        <Tile
          label="Proyectos"
          value={num.format(health.projects.published)}
          note={
            health.projects.withoutCaseStudy > 0
              ? `${health.projects.withoutCaseStudy} sin caso de estudio`
              : "todos con caso"
          }
        />
        <Tile
          label="Páginas"
          value={num.format(health.pages.system + health.pages.custom)}
          note={`${health.pages.system} del sitio · ${health.pages.custom} propias`}
        />
        <Tile
          label="Imágenes"
          value={num.format(health.media.count)}
          note={[
            health.media.withoutAlt > 0 ? `${health.media.withoutAlt} sin alt` : null,
            health.media.unused > 0 ? `${health.media.unused} sin usar` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "todas descritas y en uso"}
        />
        <Tile label="Palabras escritas" value={num.format(health.words)} />
        <Tile
          label="Experiencia"
          value={num.format(health.credentials.experience)}
          note="puestos"
        />
        <Tile
          label="Formación"
          value={num.format(health.credentials.education)}
          note="titulaciones"
        />
        <Tile
          label="Certificados"
          value={num.format(health.credentials.certificates)}
        />
      </dl>

      {/* ------------------------ Cobertura de traducción -------------------- */}
      <section className="flex flex-col gap-4 rounded-lg border border-neutral-900 p-5">
        <CoverageBar ratio={coverage.ratio} />
        <p className="text-xs text-neutral-600">
          {coverage.complete} de {coverage.total} elementos completos en los dos
          idiomas. Cuenta entidades, no campos: un artículo a medias en inglés es
          una falta, no cuatro.
        </p>

        {coverage.gaps.length === 0 ? (
          <p className="rounded border border-green-900/40 bg-green-950/20 px-4 py-3 text-sm text-green-300">
            Todo el contenido existe en español e inglés.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-900 border-y border-neutral-900">
            {coverage.gaps.map((gap, i) => (
              <li key={i}>
                <Link
                  href={gap.href}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1.5 py-2 text-[13px] transition-colors hover:bg-neutral-900/60"
                >
                  <span className="w-24 shrink-0 font-mono text-[10px] uppercase text-neutral-600">
                    {gap.kind}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-neutral-300">
                    {gap.label}
                  </span>
                  <span className="shrink-0 rounded bg-amber-950 px-2 py-0.5 font-mono text-[10px] uppercase text-amber-400">
                    falta {gap.missing.join(", ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------------------------- Enlaces -------------------------------- */}
      <section className="flex flex-col gap-4 rounded-lg border border-neutral-900 p-5">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Enlaces salientes</h2>
          <p className="text-[11px] text-neutral-600">
            {links.lastCheck
              ? `Última revisión: ${links.lastCheck.at.slice(0, 16).replace("T", " ")} · `
              : ""}
            {links.total} {links.total === 1 ? "enlace" : "enlaces"} ·{" "}
            <span className={links.broken.length > 0 ? "text-red-400" : "text-green-400"}>
              {links.broken.length} {links.broken.length === 1 ? "roto" : "rotos"}
            </span>
            {links.unverifiable.length > 0
              ? ` · ${links.unverifiable.length} sin comprobar`
              : ""}
          </p>
        </header>

        {links.total === 0 ? (
          <p className="rounded border border-dashed border-neutral-800 px-5 py-8 text-center text-sm text-neutral-500">
            Todavía no se ha revisado ninguno. Pulsa «Revisar ahora»: comprueba
            los diplomas, los repositorios, las demos y las redes, que son los
            que se pudren sin avisar.
          </p>
        ) : links.broken.length === 0 ? (
          <p className="rounded border border-green-900/40 bg-green-950/20 px-4 py-3 text-sm text-green-300">
            Los {links.total} enlaces respondieron correctamente.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {links.broken.map((link) => (
              <li
                key={link.url}
                className="flex flex-col gap-1.5 rounded border border-red-900/40 bg-red-950/10 p-3"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="rounded bg-red-950 px-1.5 py-0.5 font-mono text-[10px] text-red-300">
                    {link.status ?? "sin respuesta"}
                  </span>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 truncate font-mono text-[11px] text-neutral-300 underline underline-offset-2"
                  >
                    {link.url}
                  </a>
                </div>
                {link.error ? (
                  <p className="text-[11px] text-red-400">{link.error}</p>
                ) : null}
                <ul className="flex flex-wrap gap-1.5">
                  {link.references.map((ref, i) => (
                    <li key={i}>
                      {ref.href ? (
                        <Link
                          href={ref.href}
                          className="rounded border border-neutral-800 px-2 py-0.5 text-[11px] text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-200"
                        >
                          {ref.label}
                          {ref.locale ? ` · ${ref.locale}` : ""}
                        </Link>
                      ) : (
                        <span className="rounded border border-neutral-900 px-2 py-0.5 text-[11px] text-neutral-600">
                          {ref.label}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------ Sin comprobar ------------------------------ */}
      {links.unverifiable.length > 0 ? (
        <section className="flex flex-col gap-3 rounded-lg border border-neutral-900 p-5">
          <header className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Sin comprobar</h2>
            <p className="text-[11px] text-neutral-600">
              respondieron, pero rechazando al robot
            </p>
          </header>

          <p className="text-xs text-neutral-600">
            Estos no están rotos: el servidor contestó con un código
            anti-automatización, no con un error de la página. LinkedIn responde
            999 a cualquier cosa que no sea un navegador. Ábrelos a mano cuando
            quieras confirmarlos.
          </p>

          <ul className="flex flex-col gap-2">
            {links.unverifiable.map((link) => (
              <li
                key={link.url}
                className="flex flex-col gap-1.5 rounded border border-neutral-800 bg-neutral-950 p-3"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="rounded bg-neutral-900 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">
                    {link.status ?? "sin respuesta"}
                  </span>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 truncate font-mono text-[11px] text-neutral-400 underline underline-offset-2"
                  >
                    {link.url}
                  </a>
                </div>
                <ul className="flex flex-wrap gap-1.5">
                  {link.references.map((ref, i) => (
                    <li key={i}>
                      {ref.href ? (
                        <Link
                          href={ref.href}
                          className="rounded border border-neutral-800 px-2 py-0.5 text-[11px] text-neutral-500 transition-colors hover:border-neutral-600 hover:text-neutral-200"
                        >
                          {ref.label}
                          {ref.locale ? ` · ${ref.locale}` : ""}
                        </Link>
                      ) : (
                        <span className="rounded border border-neutral-900 px-2 py-0.5 text-[11px] text-neutral-600">
                          {ref.label}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---------------------------- Historial ------------------------------ */}
      {history.length > 1 ? (
        <section className="flex flex-col gap-3 rounded-lg border border-neutral-900 p-5">
          <h2 className={labelStyle}>Historial</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-neutral-600">
                  <th className="pb-1 font-normal">Fecha</th>
                  <th className="pb-1 text-right font-normal">Palabras</th>
                  <th className="pb-1 text-right font-normal">Cobertura</th>
                  <th className="pb-1 text-right font-normal">Rotos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900">
                {[...history].reverse().slice(0, 14).map((row) => (
                  <tr key={row.date}>
                    <td className="py-1 font-mono text-[11px] text-neutral-400">
                      {row.date}
                    </td>
                    <td className="py-1 text-right tabular-nums">
                      {num.format(row.words)}
                    </td>
                    <td className="py-1 text-right tabular-nums text-neutral-500">
                      {Math.round(row.coverage * 100)}%
                    </td>
                    <td className="py-1 text-right tabular-nums text-neutral-500">
                      {row.broken}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <p className="text-[11px] text-neutral-600">
          El historial aparece a partir de la segunda revisión: cada una guarda
          una instantánea del día.
        </p>
      )}
    </div>
  );
}
