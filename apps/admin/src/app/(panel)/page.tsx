import type { Metadata } from "next";
import { db } from "@nassican/db";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Real counts from the database rather than placeholders: with the content not
 * yet imported every figure is zero, and that is the useful signal - it is how
 * you see the import land.
 */
async function getCounts() {
  const [posts, publishedPosts, projects, media, technologies, users] =
    await Promise.all([
      db.post.count(),
      db.post.count({ where: { status: "published" } }),
      db.project.count(),
      db.media.count(),
      db.technology.count(),
      db.user.count(),
    ]);

  return { posts, publishedPosts, projects, media, technologies, users };
}

const numberFormat = new Intl.NumberFormat("es-CO");

export default async function DashboardPage() {
  const counts = await getCounts();

  const tiles = [
    { label: "Artículos", value: counts.posts, note: `${counts.publishedPosts} publicados` },
    { label: "Proyectos", value: counts.projects, note: "en el portafolio" },
    { label: "Multimedia", value: counts.media, note: "archivos" },
    { label: "Tecnologías", value: counts.technologies, note: "en el registro" },
  ];

  const empty = counts.posts + counts.projects + counts.technologies === 0;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-neutral-500">
          Estado del contenido de nassican.com.
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-neutral-900 bg-neutral-900 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex flex-col gap-1 bg-neutral-950 p-4">
            <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">
              {tile.label}
            </dt>
            <dd className="text-2xl font-semibold tabular-nums">
              {numberFormat.format(tile.value)}
            </dd>
            <p className="text-xs text-neutral-600">{tile.note}</p>
          </div>
        ))}
      </dl>

      {empty ? (
        <section className="rounded-lg border border-neutral-900 p-5">
          <h2 className="text-sm font-medium">Base de datos vacía</h2>
          <p className="mt-2 max-w-prose text-sm text-neutral-500">
            El esquema está aplicado pero el contenido sigue viviendo en los
            módulos TypeScript de <code className="text-neutral-400">apps/web/src/lib/data/</code>.
            El siguiente paso es el script de importación, que trae tecnologías,
            perfil, experiencia, certificados y los dos proyectos.
          </p>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">
          Conexión
        </h2>
        <dl className="flex flex-col divide-y divide-neutral-900 border-y border-neutral-900 text-sm">
          <div className="flex justify-between gap-4 py-2">
            <dt className="text-neutral-500">Base de datos</dt>
            <dd className="font-mono text-xs text-green-400">
              Postgres · Neon · conectada
            </dd>
          </div>
          <div className="flex justify-between gap-4 py-2">
            <dt className="text-neutral-500">Cuentas con acceso</dt>
            <dd className="font-mono text-xs tabular-nums">{counts.users}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
