"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { locales, localeNames, type Locale } from "@nassican/shared";
import CoverPicker from "@/components/CoverPicker";
import {
  redirectProblem,
  type RedirectDraft,
  type SeoSettingsDraft,
} from "@/lib/seo-draft";
import type { SearchConsoleSummary } from "@/lib/seo";
import type {
  ActionResult,
  DetectedSite,
  DetectResult,
} from "@/app/(panel)/seo/actions";

const field =
  "w-full rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-700 focus:border-neutral-600 focus:outline-none";
const labelStyle =
  "font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500";
const ghost =
  "rounded border border-neutral-800 px-2.5 py-1 text-xs text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-200 disabled:opacity-40";
const primary =
  "rounded border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 transition-colors hover:border-neutral-500 disabled:opacity-50";

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const num = new Intl.NumberFormat("es-CO");

function Section({
  title,
  note,
  action,
  children,
}: {
  title: string;
  note?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-neutral-900 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {note ? <p className="mt-0.5 max-w-prose text-xs text-neutral-600">{note}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export default function SeoModule({
  settings: initialSettings,
  redirects: initialRedirects,
  searchConsole,
  actions,
}: {
  settings: SeoSettingsDraft;
  redirects: RedirectDraft[];
  searchConsole: SearchConsoleSummary;
  actions: {
    saveSettings: (d: SeoSettingsDraft) => Promise<ActionResult>;
    saveRedirects: (d: RedirectDraft[]) => Promise<ActionResult>;
    sync: (days: number) => Promise<ActionResult>;
    detect: () => Promise<DetectResult>;
  };
}) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [redirects, setRedirects] = useState(initialRedirects);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [days, setDays] = useState(28);
  const [sites, setSites] = useState<DetectedSite[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);

  function run(action: () => Promise<ActionResult>) {
    setResult(null);
    startTransition(async () => {
      const outcome = await action();
      setResult(outcome);
      if (outcome.ok) router.refresh();
    });
  }

  function patchLocale(
    locale: Locale,
    next: Partial<SeoSettingsDraft["perLocale"][Locale]>,
  ) {
    setSettings((s) => ({
      ...s,
      perLocale: { ...s.perLocale, [locale]: { ...s.perLocale[locale], ...next } },
    }));
  }

  const badRedirect = redirects.map(redirectProblem).find(Boolean) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">SEO</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Metadatos globales, redirecciones y rendimiento en búsqueda.
        </p>
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

      {/* ------------------------- Metadatos globales ------------------------ */}
      <Section
        title="Metadatos globales"
        note="Lo que se aplica a todo el sitio. Un campo vacío deja lo que ya decía el sitio en vez de borrarlo."
        action={
          <button
            type="button"
            className={primary}
            disabled={pending}
            onClick={() => run(() => actions.saveSettings(settings))}
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className={labelStyle}>Plantilla del título</span>
            <input
              className={field}
              value={settings.titleTemplate}
              placeholder="%s | Jesús David Benavides Chicaiza"
              onChange={(e) =>
                setSettings({ ...settings, titleTemplate: e.target.value })
              }
            />
            <span className="text-[11px] text-neutral-600">
              El <code>%s</code> es el título de cada página
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={labelStyle}>Verificación de Google</span>
            <input
              className={field}
              value={settings.googleSiteVerification}
              placeholder="Contenido de la meta google-site-verification"
              onChange={(e) =>
                setSettings({ ...settings, googleSiteVerification: e.target.value })
              }
            />
          </div>
        </div>

        {locales.map((locale: Locale) => (
          <div key={locale} className="flex flex-col gap-2">
            <span className={labelStyle}>{localeNames[locale]}</span>
            <input
              className={field}
              value={settings.perLocale[locale].defaultTitle}
              placeholder="Título por defecto de la portada"
              onChange={(e) => patchLocale(locale, { defaultTitle: e.target.value })}
            />
            <textarea
              className={`${field} min-h-16`}
              value={settings.perLocale[locale].defaultDescription}
              placeholder="Descripción por defecto"
              onChange={(e) =>
                patchLocale(locale, { defaultDescription: e.target.value })
              }
            />
            <input
              className={field}
              value={settings.perLocale[locale].keywords.join(", ")}
              placeholder="Palabras clave, separadas por comas"
              onChange={(e) =>
                patchLocale(locale, { keywords: e.target.value.split(",") })
              }
            />
          </div>
        ))}

        <div className="flex flex-col gap-2">
          <span className={labelStyle}>Imagen social por defecto</span>
          <CoverPicker
            url={settings.defaultOgUrl}
            onChange={(media) =>
              setSettings({
                ...settings,
                defaultOgMediaId: media?.id ?? null,
                defaultOgUrl: media?.url ?? null,
              })
            }
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <span className={labelStyle}>GA4 · medición</span>
            <input
              className={field}
              value={settings.ga4MeasurementId}
              placeholder="G-XXXXXXXXXX"
              onChange={(e) =>
                setSettings({ ...settings, ga4MeasurementId: e.target.value })
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={labelStyle}>GA4 · propiedad</span>
            <input
              className={field}
              value={settings.ga4PropertyId}
              placeholder="552861650"
              onChange={(e) =>
                setSettings({ ...settings, ga4PropertyId: e.target.value })
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={labelStyle}>Search Console</span>
            {sites.length > 0 ? (
              <select
                className={field}
                value={settings.gscSiteUrl}
                onChange={(e) =>
                  setSettings({ ...settings, gscSiteUrl: e.target.value })
                }
              >
                <option value="">Elige una propiedad…</option>
                {sites.map((s) => (
                  <option key={s.siteUrl} value={s.siteUrl}>
                    {s.siteUrl} ({s.permission})
                  </option>
                ))}
              </select>
            ) : (
              <input
                className={field}
                value={settings.gscSiteUrl}
                placeholder="sc-domain:nassican.com"
                onChange={(e) =>
                  setSettings({ ...settings, gscSiteUrl: e.target.value })
                }
              />
            )}
            <button
              type="button"
              className={`${ghost} w-fit`}
              disabled={detecting}
              onClick={() => {
                setDetectError(null);
                startTransition(async () => {
                  setDetecting(true);
                  const found = await actions.detect();
                  setDetecting(false);
                  if (found.ok) {
                    setSites(found.sites);
                    if (found.sites.length === 0) {
                      setDetectError(
                        "Esta cuenta de Google no tiene ninguna propiedad en Search Console.",
                      );
                    }
                  } else {
                    setDetectError(found.message);
                  }
                });
              }}
            >
              {detecting ? "Consultando…" : "Detectar propiedades"}
            </button>
            {detectError ? (
              <span role="alert" className="text-[11px] text-red-400">
                {detectError}
              </span>
            ) : null}
          </div>
        </div>

        <p className="text-[11px] text-neutral-600">
          El identificador no se adivina: una propiedad de dominio es{" "}
          <code>sc-domain:nassican.com</code> y una de prefijo es la URL
          completa con su barra final. Pulsa «Detectar propiedades» y elige.
        </p>

        <div className="flex flex-col gap-1.5">
          <span className={labelStyle}>Añadido a robots.txt</span>
          <textarea
            className={`${field} min-h-20 font-mono text-[12px]`}
            value={settings.robotsExtra}
            placeholder={"User-Agent: BadBot\nDisallow: /"}
            onChange={(e) =>
              setSettings({ ...settings, robotsExtra: e.target.value })
            }
          />
          <span className="text-[11px] text-neutral-600">
            Se pega tal cual al final del archivo, después del sitemap
          </span>
        </div>

        <p className="text-[11px] text-neutral-600">
          El origen del sitio no se edita aquí: lo lee de su propia variable de
          entorno, porque una vista previa y producción comparten estas filas y
          no deben compartir la URL canónica.
        </p>
      </Section>

      {/* --------------------------- Redirecciones -------------------------- */}
      <Section
        title="Redirecciones"
        note="Se aplican solo a direcciones que si no darían 404, así que una página que existe siempre gana."
        action={
          <button
            type="button"
            className={primary}
            disabled={pending || Boolean(badRedirect)}
            title={badRedirect ?? undefined}
            onClick={() => run(() => actions.saveRedirects(redirects))}
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>
        }
      >
        {redirects.length === 0 ? (
          <p className="text-sm text-neutral-600">
            Ninguna todavía. Se añade una cuando cambias la dirección de algo que
            ya estaba indexado.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {redirects.map((r, i) => {
              const problem = redirectProblem(r);
              return (
                <li key={r.id ?? `nueva-${i}`} className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      className={`${field} max-w-56`}
                      value={r.source}
                      placeholder="/direccion-vieja"
                      onChange={(e) =>
                        setRedirects(
                          redirects.map((x, j) =>
                            j === i ? { ...x, source: e.target.value } : x,
                          ),
                        )
                      }
                    />
                    <span aria-hidden className="text-neutral-700">→</span>
                    <input
                      className={`${field} max-w-72`}
                      value={r.destination}
                      placeholder="/destino o https://…"
                      onChange={(e) =>
                        setRedirects(
                          redirects.map((x, j) =>
                            j === i ? { ...x, destination: e.target.value } : x,
                          ),
                        )
                      }
                    />
                    <select
                      className={`${field} max-w-32`}
                      value={r.statusCode}
                      onChange={(e) =>
                        setRedirects(
                          redirects.map((x, j) =>
                            j === i ? { ...x, statusCode: Number(e.target.value) } : x,
                          ),
                        )
                      }
                    >
                      <option value={308}>Permanente</option>
                      <option value={307}>Temporal</option>
                    </select>
                    <label className="flex items-center gap-1.5 text-xs text-neutral-400">
                      <input
                        type="checkbox"
                        checked={r.isEnabled}
                        onChange={(e) =>
                          setRedirects(
                            redirects.map((x, j) =>
                              j === i ? { ...x, isEnabled: e.target.checked } : x,
                            ),
                          )
                        }
                      />
                      Activa
                    </label>
                    <span className="font-mono text-[10px] text-neutral-600">
                      {r.hits} {r.hits === 1 ? "uso" : "usos"}
                      {r.lastHitAt ? ` · ${r.lastHitAt.slice(0, 10)}` : ""}
                    </span>
                    <button
                      type="button"
                      className={`${ghost} ml-auto border-red-900/60 text-red-400`}
                      onClick={() =>
                        setRedirects(redirects.filter((_, j) => j !== i))
                      }
                    >
                      Quitar
                    </button>
                  </div>
                  {problem ? (
                    <p className="text-[11px] text-red-400">{problem}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <button
          type="button"
          className={`${ghost} w-fit`}
          onClick={() =>
            setRedirects([
              ...redirects,
              {
                id: null,
                source: "",
                destination: "",
                statusCode: 308,
                isEnabled: true,
                hits: 0,
                lastHitAt: null,
              },
            ])
          }
        >
          Añadir redirección
        </button>
      </Section>

      {/* -------------------------- Search Console -------------------------- */}
      <Section
        title="Search Console"
        note={
          searchConsole.configured
            ? "Los datos se guardan en la base al sincronizar; el panel nunca consulta Google al abrirse."
            : "Falta la propiedad de Search Console en los metadatos de arriba."
        }
        action={
          <div className="flex items-center gap-2">
            <select
              className={`${field} max-w-28`}
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
              disabled={pending || !searchConsole.configured}
              onClick={() => run(() => actions.sync(days))}
            >
              {pending ? "Sincronizando…" : "Sincronizar"}
            </button>
          </div>
        }
      >
        {searchConsole.lastSync ? (
          <p className="text-[11px] text-neutral-600">
            Última sincronización: {searchConsole.lastSync.at.slice(0, 16).replace("T", " ")} ·{" "}
            <span
              className={
                searchConsole.lastSync.status === "ok"
                  ? "text-green-400"
                  : "text-red-400"
              }
            >
              {searchConsole.lastSync.status}
            </span>
            {searchConsole.lastSync.status === "ok"
              ? ` · ${searchConsole.lastSync.rows} filas`
              : ` · ${searchConsole.lastSync.error ?? ""}`}
          </p>
        ) : null}

        {searchConsole.totals.impressions === 0 ? (
          <p className="rounded border border-dashed border-neutral-800 px-5 py-8 text-center text-sm text-neutral-500">
            Todavía no hay datos. Search Console publica con dos o tres días de
            retraso, y una propiedad recién verificada tarda más en tener algo
            que contar.
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded border border-neutral-900 bg-neutral-900 lg:grid-cols-4">
              {[
                { label: "Clics", value: num.format(searchConsole.totals.clicks) },
                { label: "Impresiones", value: num.format(searchConsole.totals.impressions) },
                { label: "CTR", value: pct(searchConsole.totals.ctr) },
                { label: "Posición media", value: searchConsole.totals.position.toFixed(1) },
              ].map((tile) => (
                <div key={tile.label} className="flex flex-col gap-1 bg-neutral-950 p-3">
                  <dt className={labelStyle}>{tile.label}</dt>
                  <dd className="text-xl font-semibold tabular-nums">{tile.value}</dd>
                </div>
              ))}
            </dl>

            <p className="text-[11px] text-neutral-600">
              {searchConsole.from} → {searchConsole.to} · la posición media va
              ponderada por impresiones, que es la única forma en que promediarla
              significa algo
            </p>

            <div className="grid gap-5 lg:grid-cols-2">
              {[
                { title: "Consultas", rows: searchConsole.topQueries, key: "query" as const },
                { title: "Páginas", rows: searchConsole.topPages, key: "page" as const },
              ].map((table) => (
                <div key={table.title} className="flex flex-col gap-2">
                  <h3 className={labelStyle}>{table.title}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="text-left text-neutral-600">
                          <th className="pb-1 font-normal">
                            {table.key === "query" ? "Consulta" : "Página"}
                          </th>
                          <th className="pb-1 text-right font-normal">Clics</th>
                          <th className="pb-1 text-right font-normal">Impr.</th>
                          <th className="pb-1 text-right font-normal">Pos.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-900">
                        {table.rows.map((row, i) => (
                          <tr key={i}>
                            <td className="max-w-56 truncate py-1 pr-2 text-neutral-300">
                              {table.key === "query"
                                ? row.query
                                : row.page.replace(/^https?:\/\/[^/]+/, "") || "/"}
                            </td>
                            <td className="py-1 text-right tabular-nums">{row.clicks}</td>
                            <td className="py-1 text-right tabular-nums text-neutral-500">
                              {row.impressions}
                            </td>
                            <td className="py-1 text-right tabular-nums text-neutral-500">
                              {row.position.toFixed(1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Section>
    </div>
  );
}
