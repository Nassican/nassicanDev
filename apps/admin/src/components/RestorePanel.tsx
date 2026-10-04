"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Toast, { type ToastResult } from "@/components/Toast";
import { RESTORE_CONFIRMATION } from "@/lib/restore-confirm";
import type { RestorePreview } from "@/lib/restore";

type Point = {
  id: string;
  reason: string;
  createdAt: string;
  rows: number;
  sizeBytes: number;
  by: string | null;
};

/** What will be restored: a file chosen now, or a point taken earlier. */
type Source = { kind: "file"; file: File } | { kind: "point"; id: string; label: string };

const button =
  "rounded border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 transition-colors hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-40";

const when = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });

const size = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

/**
 * Restore from a file or a restore point, in two steps that cannot be merged:
 * the preview, then the typed confirmation.
 *
 * The preview speaks in what you lose and what comes back, per table, because
 * row counts alone hide the case that matters: a backup with as many games as
 * today can still drop the one bought yesterday.
 */
export default function RestorePanel({ points }: { points: Point[] }) {
  const router = useRouter();
  const picker = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState<"preview" | "apply" | null>(null);
  const [result, setResult] = useState<ToastResult | null>(null);
  const [notes, setNotes] = useState<string[]>([]);

  async function send(chosen: Source, mode: "preview" | "apply") {
    const body = new FormData();
    body.append("mode", mode);
    if (chosen.kind === "file") body.append("file", chosen.file);
    else body.append("point", chosen.id);
    if (mode === "apply") body.append("confirm", typed);

    setBusy(mode);
    setResult(null);
    try {
      const response = await fetch("/api/backup/restore", { method: "POST", body });
      const json = await response.json();
      if (!response.ok) {
        setResult({ ok: false, message: json.error ?? "No se pudo restaurar." });
        return;
      }
      if (mode === "preview") {
        setPreview(json.preview);
        return;
      }
      setResult({ ok: true, message: json.message });
      setNotes(json.notes ?? []);
      setSource(null);
      setPreview(null);
      setTyped("");
      router.refresh();
    } catch {
      setResult({ ok: false, message: "No se pudo contactar con el servidor." });
    } finally {
      setBusy(null);
    }
  }

  function choose(chosen: Source) {
    setSource(chosen);
    setPreview(null);
    setTyped("");
    setNotes([]);
    void send(chosen, "preview");
  }

  const losing = preview?.rows.filter((r) => r.lost > 0) ?? [];
  const ready = preview !== null && preview.problem === null && typed === RESTORE_CONFIRMATION;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-neutral-900 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <h2 className="text-sm font-semibold">Restaurar desde el panel</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Devuelve el contenido —artículos, proyectos, páginas, imágenes,
            perfil, menú, juegos y libros— a como estaba en la copia. Los
            usuarios, la auditoría y los datos sincronizados no se tocan. Antes
            de escribir se guarda un punto con el estado actual, para deshacerlo.
          </p>
        </div>
        <button type="button" className={button} disabled={busy !== null} onClick={() => picker.current?.click()}>
          Elegir archivo…
        </button>
      </div>

      <input
        ref={picker}
        type="file"
        accept=".gz,.json,application/gzip,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) choose({ kind: "file", file });
          e.target.value = "";
        }}
      />

      {source ? (
        <div className="flex flex-col gap-3 rounded border border-neutral-800 bg-neutral-950 p-4">
          <p className="text-xs text-neutral-400">
            {source.kind === "file" ? `Archivo: ${source.file.name}` : `Punto: ${source.label}`}
            {preview ? ` · copia del ${when(preview.createdAt)}` : ""}
          </p>

          {busy === "preview" ? <p className="text-xs text-neutral-500">Comparando con la base…</p> : null}

          {preview?.problem ? (
            <p role="alert" className="text-xs text-red-400">
              {preview.problem}
            </p>
          ) : null}

          {preview && !preview.problem ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500">
                      <th className="py-1 pr-4 font-normal">Tabla</th>
                      <th className="py-1 pr-4 text-right font-normal">Hoy</th>
                      <th className="py-1 pr-4 text-right font-normal">En la copia</th>
                      <th className="py-1 pr-4 text-right font-normal">Se pierden</th>
                      <th className="py-1 text-right font-normal">Vuelven</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {preview.rows.map((row) => (
                      <tr key={row.label} className="border-t border-neutral-900">
                        <td className="py-1 pr-4 text-neutral-300">{row.label}</td>
                        <td className="py-1 pr-4 text-right text-neutral-400">{row.current}</td>
                        <td className="py-1 pr-4 text-right text-neutral-400">{row.incoming}</td>
                        <td className={`py-1 pr-4 text-right ${row.lost > 0 ? "text-amber-500" : "text-neutral-600"}`}>
                          {row.lost || "—"}
                        </td>
                        <td className={`py-1 text-right ${row.returning > 0 ? "text-neutral-200" : "text-neutral-600"}`}>
                          {row.returning || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-[11px] text-neutral-500">
                {losing.length > 0
                  ? `Se pierde lo creado después de la copia en ${losing.map((r) => r.label.toLowerCase()).join(", ")}. `
                  : "Nada creado después de la copia se pierde. "}
                Lo editado después vuelve a como estaba en ella.
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="w-44 rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 font-mono text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
                  value={typed}
                  placeholder={`Escribe ${RESTORE_CONFIRMATION}`}
                  aria-label={`Escribe ${RESTORE_CONFIRMATION} para confirmar`}
                  onChange={(e) => setTyped(e.target.value)}
                />
                <button
                  type="button"
                  className={`${button} border-amber-900 text-amber-300 hover:border-amber-700`}
                  disabled={!ready || busy !== null}
                  onClick={() => void send(source, "apply")}
                >
                  {busy === "apply" ? "Restaurando…" : "Restaurar"}
                </button>
                <button
                  type="button"
                  className={button}
                  disabled={busy !== null}
                  onClick={() => {
                    setSource(null);
                    setPreview(null);
                    setTyped("");
                  }}
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {notes.length > 0 ? (
        <div className="rounded border border-amber-900/50 bg-amber-950/15 px-3 py-2">
          <p className="text-xs font-medium text-amber-300">Restaurado, con avisos:</p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {notes.map((note) => (
              <li key={note} className="text-xs text-amber-300/80">
                {note}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 border-t border-neutral-900 pt-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500">
          Puntos de restauración
        </span>
        {points.length === 0 ? (
          <p className="text-xs text-neutral-600">
            Aún no hay ninguno: se crea uno antes de cada restauración, y se
            guardan los cinco últimos.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-900">
            {points.map((point) => (
              <li key={point.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-xs">
                <div className="min-w-0">
                  <p className="text-neutral-300">{point.reason}</p>
                  <p className="text-neutral-600">
                    {when(point.createdAt)} · {point.rows.toLocaleString("es-CO")} filas · {size(point.sizeBytes)}
                    {point.by ? ` · ${point.by}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <a href={`/api/backup/points/${point.id}`} className="text-neutral-500 hover:text-neutral-200">
                    Descargar
                  </a>
                  <button
                    type="button"
                    className="text-neutral-300 hover:text-neutral-100 disabled:opacity-40"
                    disabled={busy !== null}
                    onClick={() => choose({ kind: "point", id: point.id, label: when(point.createdAt) })}
                  >
                    Volver a este punto
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Toast result={result} onDismiss={() => setResult(null)} />
    </section>
  );
}
