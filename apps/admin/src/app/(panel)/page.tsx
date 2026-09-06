import type { Metadata } from "next";
import Link from "next/link";
import { BsArrowRight, BsPlus } from "react-icons/bs";
import { getDashboard, type Pending } from "@/lib/dashboard";
import { createPost } from "./contenido/blogs/actions";
import { createProject } from "./contenido/proyectos/actions";

export const metadata: Metadata = { title: "Dashboard" };

const num = new Intl.NumberFormat("es-CO");

const actionWords: Record<string, string> = {
  create: "creó",
  update: "guardó",
  publish: "publicó",
  unpublish: "despublicó",
  delete: "borró",
  sync: "sincronizó",
};

const entityWords: Record<string, string> = {
  post: "un artículo",
  project: "un proyecto",
  page: "una página",
  media: "una imagen",
  profile: "el perfil",
  seo: "el SEO",
  redirect: "las redirecciones",
  settings: "la configuración",
  navigation: "la navegación",
  user: "un usuario",
  session: "una sesión",
};

const tones: Record<Pending["tone"], string> = {
  urgent: "border-red-900/60 bg-red-950/20",
  warn: "border-amber-900/50 bg-amber-950/15",
  info: "border-neutral-900 bg-neutral-950",
};

const dots: Record<Pending["tone"], string> = {
  urgent: "bg-red-500",
  warn: "bg-amber-500",
  info: "bg-neutral-600",
};

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex flex-col gap-1 bg-neutral-950 p-4">
      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">
        {label}
      </dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
      <p className="text-xs text-neutral-600">{note}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const { counts, coverage, pending, recent, traffic } = await getDashboard();
  const pct = Math.round(coverage.ratio * 100);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Qué necesita tu atención en nassican.com.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <form action={createPost}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 transition-colors hover:border-neutral-500"
            >
              <BsPlus className="h-4 w-4" aria-hidden /> Artículo
            </button>
          </form>
          <form action={createProject}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded border border-neutral-800 px-3 py-1.5 text-sm text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-200"
            >
              <BsPlus className="h-4 w-4" aria-hidden /> Proyecto
            </button>
          </form>
        </div>
      </header>

      {/* ---------------------------- pendientes ---------------------------- */}
      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">
          Pendientes
        </h2>

        {pending.length === 0 ? (
          <p className="rounded-lg border border-green-900/40 bg-green-950/20 px-4 py-3 text-sm text-green-300">
            Nada que arreglar: todo traducido, ningún enlace roto y sin
            borradores olvidados.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pending.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:border-neutral-700 ${tones[item.tone]}`}
                >
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${dots[item.tone]}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-neutral-200">
                      {item.title}
                    </span>
                    <span className="block truncate text-[11px] text-neutral-500">
                      {item.detail}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-neutral-500 transition-colors group-hover:text-neutral-300">
                    {item.action}
                    <BsArrowRight className="h-3 w-3" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------ cifras ------------------------------ */}
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-neutral-900 bg-neutral-900 lg:grid-cols-4">
        <Tile
          label="Artículos"
          value={num.format(counts.posts.published)}
          note={
            counts.posts.draft > 0
              ? `${counts.posts.draft} en borrador`
              : "publicados"
          }
        />
        <Tile
          label="Proyectos"
          value={num.format(counts.projects.published)}
          note={
            counts.projects.draft > 0
              ? `${counts.projects.draft} en borrador`
              : "en el portafolio"
          }
        />
        <Tile
          label="Palabras"
          value={num.format(counts.words)}
          note={`${num.format(counts.media)} imágenes`}
        />
        <Tile
          label="Traducción"
          value={`${pct}%`}
          note={`${coverage.complete} de ${coverage.total} completos`}
        />
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ----------------------------- tráfico ---------------------------- */}
        <section className="flex flex-col gap-3 rounded-lg border border-neutral-900 p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Últimos 7 días</h2>
            <Link
              href="/analitica"
              className="text-xs text-neutral-500 transition-colors hover:text-neutral-300"
            >
              Analítica →
            </Link>
          </div>

          {traffic.source === null ? (
            <p className="text-sm text-neutral-500">
              Sin datos sincronizados todavía. Analítica trae las visitas de
              GA4 y de Vercel cuando pulsas «Sincronizar».
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-8">
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">
                    Páginas vistas
                  </span>
                  <span className="text-2xl font-semibold tabular-nums">
                    {num.format(traffic.pageviews)}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">
                    Día más visitado
                  </span>
                  <span className="text-2xl font-semibold tabular-nums">
                    {num.format(traffic.visitors)}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-neutral-600">
                {traffic.days} {traffic.days === 1 ? "día" : "días"} con datos,
                según {traffic.source === "vercel" ? "Vercel" : "GA4"}.
              </p>
            </>
          )}
        </section>

        {/* ---------------------------- actividad --------------------------- */}
        <section className="flex flex-col gap-3 rounded-lg border border-neutral-900 p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Actividad reciente</h2>
            <Link
              href="/sistema"
              className="text-xs text-neutral-500 transition-colors hover:text-neutral-300"
            >
              Sistema →
            </Link>
          </div>

          {recent.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Sin movimientos registrados. Aparecerán aquí en cuanto publiques o
              guardes algo.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-neutral-900 border-y border-neutral-900">
              {recent.map((row) => (
                <li key={row.id} className="flex items-center gap-2 py-1.5 text-[12px]">
                  <span className="min-w-0 flex-1 truncate text-neutral-300">
                    {actionWords[row.action] ?? row.action}{" "}
                    {entityWords[row.entityType] ?? row.entityType}
                    {row.label ? (
                      <span className="text-neutral-500"> · {row.label}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-neutral-600">
                    {row.at.slice(0, 16).replace("T", " ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
