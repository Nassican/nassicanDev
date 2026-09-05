"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pager, usePage } from "@/components/Pager";
import type { SystemSummary } from "@/lib/system";
import type { ActionResult, ProjectList } from "@/app/(panel)/sistema/actions";

const labelStyle =
  "font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500";
const ghost =
  "rounded border border-neutral-800 px-2.5 py-1 text-xs text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-200 disabled:opacity-40";
const primary =
  "rounded border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 transition-colors hover:border-neutral-500 disabled:opacity-50";

const num = new Intl.NumberFormat("es-CO");
const when = (iso: string) => iso.slice(0, 16).replace("T", " ");
const ms = (v: number | null) =>
  v === null ? "—" : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${v} ms`;

const actionWords: Record<string, string> = {
  create: "creó",
  update: "guardó",
  publish: "publicó",
  unpublish: "despublicó",
  delete: "borró",
  sync: "sincronizó",
};

const entityWords: Record<string, string> = {
  post: "artículo",
  project: "proyecto",
  page: "página",
  media: "imagen",
  profile: "perfil",
  seo: "SEO",
  redirect: "redirecciones",
  settings: "configuración",
  navigation: "navegación",
  user: "usuario",
  session: "sesión",
};

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
          {note ? (
            <p className="mt-0.5 max-w-prose text-xs text-neutral-600">{note}</p>
          ) : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded border border-dashed border-neutral-800 px-5 py-6 text-center text-sm text-neutral-500">
      {children}
    </p>
  );
}

function Pill({ tone, children }: { tone: "ok" | "bad" | "wait"; children: React.ReactNode }) {
  const styles = {
    ok: "bg-green-950 text-green-400",
    bad: "bg-red-950 text-red-300",
    wait: "bg-neutral-900 text-neutral-400",
  } as const;

  return (
    <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] ${styles[tone]}`}>
      {children}
    </span>
  );
}

/** A sparkline of the last checks: green is up, red is not. */
function UptimeBar({ recent }: { recent: SystemSummary["uptime"]["recent"] }) {
  if (recent.length === 0) return null;

  return (
    <div
      className="flex items-end gap-0.5"
      role="img"
      aria-label={`Últimas ${recent.length} comprobaciones`}
    >
      {[...recent].reverse().map((check, i) => (
        <span
          key={i}
          title={`${when(check.at)} · ${check.statusCode ?? "sin respuesta"} · ${ms(check.responseMs)}`}
          className={`w-2 rounded-sm ${check.isOk ? "bg-green-600" : "bg-red-600"}`}
          style={{
            height: `${Math.min(28, Math.max(6, (check.responseMs ?? 0) / 60))}px`,
          }}
        />
      ))}
    </div>
  );
}

export default function SystemModule({
  summary,
  actions,
}: {
  summary: SystemSummary;
  actions: {
    checkUptime: () => Promise<ActionResult>;
    refreshDeployments: () => Promise<ActionResult>;
    detectProjects: () => Promise<ProjectList>;
  };
}) {
  const router = useRouter();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [projects, setProjects] = useState<ProjectList | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (call: () => Promise<ActionResult>) => {
    setResult(null);
    startTransition(async () => {
      const outcome = await call();
      setResult(outcome);
      router.refresh();
    });
  };

  const { audit, syncs, deployments, events, uptime, vercel } = summary;

  // Ten rows each: enough to see a pattern, short enough that four lists on
  // one page do not turn it into a scroll.
  const auditPage = usePage(audit, 10);
  const syncPage = usePage(syncs, 10);
  const deployPage = usePage(deployments, 10);
  const eventPage = usePage(events, 10);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Sistema</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Auditoría, sincronizaciones, despliegues y disponibilidad.
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

      {/* ------------------------------ Uptime ------------------------------- */}
      <Section
        title="Disponibilidad"
        note="Se comprueba cuando lo pides: este panel no tiene planificador, y una página de monitorización cuyos datos solo se mueven al abrirla es mejor decirlo que disimularlo."
        action={
          <button
            type="button"
            className={primary}
            disabled={pending}
            onClick={() => run(actions.checkUptime)}
          >
            {pending ? "Comprobando…" : "Comprobar ahora"}
          </button>
        }
      >
        {uptime.last ? (
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex flex-col gap-1">
                <span className={labelStyle}>Última</span>
                <span
                  className={`text-lg font-semibold ${uptime.last.isOk ? "text-green-400" : "text-red-400"}`}
                >
                  {uptime.last.statusCode ?? "sin respuesta"}
                </span>
                <span className="text-[11px] text-neutral-600">
                  {when(uptime.last.at)}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className={labelStyle}>Respuesta</span>
                <span className="text-lg font-semibold tabular-nums">
                  {ms(uptime.last.responseMs)}
                </span>
                <span className="text-[11px] text-neutral-600">
                  mediana {ms(uptime.medianMs)}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className={labelStyle}>Correctas</span>
                <span className="text-lg font-semibold tabular-nums">
                  {Math.round(uptime.okRatio * 100)}%
                </span>
                <span className="text-[11px] text-neutral-600">
                  de {num.format(uptime.checks)} comprobaciones
                </span>
              </div>
            </div>
            <UptimeBar recent={uptime.recent} />
          </div>
        ) : (
          <Empty>
            Todavía no se ha comprobado nada.{" "}
            {uptime.url ? (
              <span className="font-mono text-[11px]">{uptime.url}</span>
            ) : (
              "Falta PUBLIC_SITE_URL."
            )}
          </Empty>
        )}
      </Section>

      {/* --------------------------- Despliegues ----------------------------- */}
      <Section
        title="Despliegues"
        note="Los últimos de cada proyecto en Vercel, con lo que tardó cada build."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={ghost}
              disabled={pending || !vercel.hasToken}
              onClick={() =>
                startTransition(async () => setProjects(await actions.detectProjects()))
              }
            >
              Ver proyectos
            </button>
            <button
              type="button"
              className={primary}
              disabled={pending || !vercel.configured}
              onClick={() => run(actions.refreshDeployments)}
            >
              {pending ? "Sincronizando…" : "Sincronizar"}
            </button>
          </div>
        }
      >
        {!vercel.configured ? (
          <div className="rounded border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-sm text-amber-300">
            <p>
              Falta{" "}
              <span className="font-mono">{vercel.missing.join(" y ")}</span> en
              el entorno del panel.
            </p>
            <p className="mt-2 text-[11px] text-amber-300/70">
              El token se crea en Vercel → Settings → Tokens. Al crearlo,{" "}
              <strong className="font-semibold">
                elige el ámbito donde vive nassican.com
              </strong>
              : las variables se guardan aquí, en el panel, pero lo que el token
              tiene que alcanzar es el sitio público. «Ver proyectos» lista
              justo lo que alcanza — si nassican.com no sale ahí, el ámbito está
              mal. Añade <span className="font-mono">VERCEL_TEAM_ID</span> solo
              si el proyecto pertenece a un equipo.
            </p>
          </div>
        ) : null}

        {projects ? (
          <div className="rounded border border-neutral-800 bg-neutral-950 p-3">
            <p className="mb-2 text-xs text-neutral-400">{projects.message}</p>
            <ul className="flex flex-col gap-1">
              {projects.projects.map((p) => (
                <li key={p.id} className="flex flex-wrap items-baseline gap-2 text-[12px]">
                  <span className="text-neutral-300">{p.name}</span>
                  <code className="rounded bg-neutral-900 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">
                    {p.id}
                  </code>
                  {p.framework ? (
                    <span className="text-[10px] text-neutral-600">{p.framework}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {deployments.length === 0 ? (
          <Empty>Sin despliegues sincronizados.</Empty>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-900 border-y border-neutral-900">
            {deployPage.rows.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[12px]">
                <Pill tone={d.state === "READY" ? "ok" : d.state === "ERROR" ? "bad" : "wait"}>
                  {d.state}
                </Pill>
                <span className="w-14 shrink-0 font-mono text-[10px] uppercase text-neutral-600">
                  {d.project}
                </span>
                <span className="min-w-0 flex-1 truncate text-neutral-300">
                  {d.branch ?? "—"}
                  {d.commitSha ? (
                    <code className="ml-2 text-[10px] text-neutral-600">
                      {d.commitSha.slice(0, 7)}
                    </code>
                  ) : null}
                </span>
                <span className="shrink-0 tabular-nums text-neutral-500">{ms(d.buildMs)}</span>
                <span className="shrink-0 font-mono text-[10px] text-neutral-600">
                  {when(d.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <Pager
          {...deployPage}
          shown={deployPage.rows.length}
          label="despliegues"
          onPage={deployPage.setPage}
        />
      </Section>

      {/* ------------------------- Sincronizaciones -------------------------- */}
      <Section
        title="Sincronizaciones"
        note="Cada vez que el panel fue a buscar datos fuera: GA4, Search Console, Vercel, y la revisión de enlaces."
      >
        {syncs.length === 0 ? (
          <Empty>Todavía no se ha sincronizado nada.</Empty>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-900 border-y border-neutral-900">
            {syncPage.rows.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 py-2 text-[12px]"
              >
                <Pill tone={s.status === "ok" ? "ok" : s.status === "failed" ? "bad" : "wait"}>
                  {s.status}
                </Pill>
                <span className="w-28 shrink-0 truncate font-mono text-[11px] text-neutral-400">
                  {s.source}
                </span>
                {/* The error shares the row instead of adding a second line.
                    Truncated with the full text on hover: these messages are
                    long, and a wrapped one made every other row hard to scan
                    for the sake of text nobody reads in full at a glance. */}
                <span
                  className={`min-w-0 flex-1 truncate ${s.error ? "text-red-400" : "text-neutral-600"}`}
                  title={s.error ?? undefined}
                >
                  {s.error ?? `${num.format(s.rows)} filas`}
                </span>
                <span className="shrink-0 tabular-nums text-neutral-500">
                  {ms(s.durationMs)}
                </span>
                <span className="hidden shrink-0 font-mono text-[10px] text-neutral-600 sm:inline">
                  {when(s.startedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <Pager
          {...syncPage}
          shown={syncPage.rows.length}
          label="ejecuciones"
          onPage={syncPage.setPage}
        />
      </Section>

      {/* ------------------------------ Avisos ------------------------------- */}
      {events.length > 0 ? (
        <Section
          title="Avisos"
          note="Lo que falló por detrás. Aquí acaban los avisos al sitio público que no llegaron, que antes se colaban dentro de un mensaje de «guardado»."
        >
          <ul className="flex flex-col divide-y divide-neutral-900 border-y border-neutral-900">
            {eventPage.rows.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2 text-[12px]">
                <Pill tone={e.level === "error" ? "bad" : e.level === "warn" ? "wait" : "ok"}>
                  {e.level}
                </Pill>
                <span className="w-24 shrink-0 truncate font-mono text-[10px] text-neutral-500">
                  {e.source}
                </span>
                <span
                  className="min-w-0 flex-1 truncate text-neutral-300"
                  title={e.message}
                >
                  {e.message}
                </span>
                <span className="hidden shrink-0 font-mono text-[10px] text-neutral-600 sm:inline">
                  {when(e.at)}
                </span>
              </li>
            ))}
          </ul>

          <Pager
            {...eventPage}
            shown={eventPage.rows.length}
            label="avisos"
            onPage={eventPage.setPage}
          />
        </Section>
      ) : null}

      {/* ----------------------------- Auditoría ----------------------------- */}
      <Section
        title="Auditoría"
        note="Qué se cambió y cuándo. Registra la decisión —publicar, borrar, guardar—, no cada fila escrita: cuatro upserts de un mismo guardado son un solo hecho."
      >
        {audit.length === 0 ? (
          <Empty>
            Sin movimientos registrados todavía. Aparecerán en cuanto publiques
            o guardes algo.
          </Empty>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-900 border-y border-neutral-900">
            {auditPage.rows.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2 text-[12px]">
                <span className="w-20 shrink-0 font-mono text-[10px] uppercase text-neutral-600">
                  {actionWords[a.action] ?? a.action}
                </span>
                <span className="min-w-0 flex-1 truncate text-neutral-300">
                  {entityWords[a.entityType] ?? a.entityType}
                  {a.diff && typeof a.diff.label === "string" ? (
                    <span className="text-neutral-500"> · {a.diff.label}</span>
                  ) : null}
                </span>
                {a.user ? (
                  <span className="hidden shrink-0 truncate text-[11px] text-neutral-500 sm:inline">
                    {a.user}
                  </span>
                ) : null}
                <span className="shrink-0 font-mono text-[10px] text-neutral-600">
                  {when(a.at)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <Pager
          {...auditPage}
          shown={auditPage.rows.length}
          label="entradas"
          onPage={auditPage.setPage}
        />
      </Section>
    </div>
  );
}
