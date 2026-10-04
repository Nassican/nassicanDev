import type { Metadata } from "next";
import { db, modelNames, type Prisma } from "@nassican/db";
import { EXCLUDED, REDACTED } from "@/lib/backup";
import { requireUser } from "@/lib/session";
import { listRestorePoints } from "@/lib/restore";
import RestorePanel from "@/components/RestorePanel";

export const metadata: Metadata = { title: "Copias de seguridad" };

const label = "font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500";

/** A number from an audit entry's diff, without trusting its shape. */
function numberIn(diff: Prisma.JsonValue | null, key: string): number | null {
  if (typeof diff !== "object" || diff === null || Array.isArray(diff)) return null;
  const value = diff[key];
  return typeof value === "number" ? value : null;
}

const size = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const reasons: Record<string, string> = {
  Session: "cada fila es un inicio de sesión vivo; restaurarlas devolvería el acceso a quien lo tuviera",
  Verification: "códigos de un solo uso que caducan en minutos",
  RestorePoint: "los puntos de restauración de abajo; una copia con copias dentro crecería en cada restauración",
};

/**
 * The download, and what it does and does not contain.
 *
 * The history comes from the audit log rather than a table of its own: a
 * download is a decision someone made, which is what that log records.
 */
export default async function CopiasPage() {
  const [user, history, points] = await Promise.all([
    requireUser(),
    db.auditLog.findMany({
      where: { entityType: "backup", action: "export" },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: { select: { name: true, email: true } } },
    }),
    listRestorePoints(),
  ]);

  const owner = user.role === "owner";
  const tables = modelNames.length - EXCLUDED.length;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Copias de seguridad</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Fuera de Neon no existe ninguna otra copia de los artículos, las
          imágenes ni las bibliotecas. Este archivo es esa otra copia.
        </p>
      </header>

      <section className="flex flex-col gap-4 rounded-lg border border-neutral-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold">Descargar ahora</h2>
            <p className="mt-1 text-xs text-neutral-500">
              {tables} tablas en un solo <span className="font-mono">.json.gz</span>,
              imágenes incluidas. Se genera en el momento.
            </p>
          </div>
          {owner ? (
            <a
              href="/api/backup"
              className="rounded border border-neutral-700 px-3 py-1.5 text-sm text-neutral-100 transition-colors hover:border-neutral-500"
            >
              Descargar copia
            </a>
          ) : (
            <span className="text-xs text-neutral-500">Solo un propietario puede descargarla.</span>
          )}
        </div>

        <div className="grid gap-4 border-t border-neutral-900 pt-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className={label}>Fuera de la copia</span>
            {EXCLUDED.map((model) => (
              <p key={model} className="text-xs text-neutral-400">
                <span className="font-mono text-neutral-300">{model}</span> — {reasons[model] ?? "excluida"}.
              </p>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={label}>En blanco</span>
            {Object.entries(REDACTED).map(([model, fields]) => (
              <p key={model} className="text-xs text-neutral-400">
                <span className="font-mono text-neutral-300">{model}</span>: {fields?.join(", ")}.
                La cuenta se conserva para que Google te reconozca; los tokens
                se vuelven a emitir al entrar.
              </p>
            ))}
          </div>
        </div>
      </section>

      {owner ? (
        <RestorePanel
          points={points.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() }))}
        />
      ) : null}

      <section className="flex flex-col gap-3 rounded-lg border border-neutral-900 p-5">
        <h2 className="text-sm font-semibold">Restaurar en una base nueva</h2>
        <p className="text-xs text-neutral-500">
          Para un servidor nuevo o una base perdida, desde la terminal. Solo en
          una base vacía y migrada hasta la misma versión que la copia.
          Nunca mezcla ni sobrescribe, así que un destino equivocado falla sin
          tocar nada.
        </p>
        <pre className="overflow-x-auto rounded border border-neutral-900 bg-neutral-950 px-3 py-2 font-mono text-[11px] leading-relaxed text-neutral-300">
{`npx prisma migrate deploy        # en packages/db, contra la base nueva
RESTORE_DATABASE_URL=postgres://… npm run backup:restore -- copia.json.gz --dry
RESTORE_DATABASE_URL=postgres://… npm run backup:restore -- copia.json.gz`}
        </pre>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Últimas descargas</h2>
        {history.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-800 px-4 py-6 text-center text-sm text-neutral-500">
            Nunca se ha descargado una copia.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-900 rounded-lg border border-neutral-900">
            {history.map((entry) => {
              const bytes = numberIn(entry.diff, "bytes");
              const rows = numberIn(entry.diff, "rows");
              return (
                <li key={String(entry.id)} className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-2.5 text-xs">
                  <span className="text-neutral-300">
                    {entry.createdAt.toLocaleString("es-CO", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "America/Bogota",
                    })}
                  </span>
                  <span className="text-neutral-500">
                    {[
                      rows !== null ? `${rows.toLocaleString("es-CO")} filas` : null,
                      bytes !== null ? size(bytes) : null,
                      entry.user?.name ?? entry.user?.email,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
