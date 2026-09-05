"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { locales, localeNames, type Locale } from "@nassican/shared";
import { savingLabel, uploadImage } from "@/lib/upload";
import type { MediaItem, MediaText } from "@/lib/media-library";
import type { ActionResult } from "@/app/(panel)/contenido/multimedia/actions";

type Actions = {
  saveText: (id: string, text: MediaText) => Promise<ActionResult>;
  remove: (id: string) => Promise<ActionResult>;
};

const field =
  "w-full rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-700 focus:border-neutral-600 focus:outline-none";
const labelStyle =
  "font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500";
const ghost =
  "rounded border border-neutral-800 px-2.5 py-1 text-xs text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-200 disabled:opacity-40";

function kb(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

function missingAlt(item: MediaItem): Locale[] {
  return locales.filter((l) => !item.text[l]?.alt.trim());
}

type Filter = "all" | "missing-alt" | "in-use" | "unused";
type Sort = "recent" | "largest" | "name";

/* -------------------------------------------------------------------------- */
/* Detail panel                                                               */
/* -------------------------------------------------------------------------- */

function Details({
  item,
  actions,
  onClose,
  onSaved,
  onDeleted,
}: {
  item: MediaItem;
  actions: Actions;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  // Mounted with `key={item.id}`, so opening another image gives a fresh
  // panel rather than one that has to be reset by an effect.
  const [text, setText] = useState<MediaText>(item.text);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const missing = missingAlt({ ...item, text });
  const inUse = item.usage.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Cerrar"
        className="flex-1 bg-black/60"
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-label="Detalle de la imagen"
        className="flex w-full max-w-lg flex-col gap-4 overflow-y-auto border-l border-neutral-800 bg-neutral-950 p-5"
      >
        <header className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-semibold">Detalle de la imagen</h2>
          <button type="button" className={ghost} onClick={onClose}>
            Cerrar
          </button>
        </header>

        <Image
          src={item.url}
          alt={text.es?.alt || ""}
          width={item.width ?? 640}
          height={item.height ?? 360}
          className="h-auto w-full rounded border border-neutral-800"
        />

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          <dt className="text-neutral-600">Peso</dt>
          <dd className="font-mono text-neutral-400">{kb(item.sizeBytes)}</dd>
          <dt className="text-neutral-600">Dimensiones</dt>
          <dd className="font-mono text-neutral-400">
            {item.width}×{item.height}
          </dd>
          <dt className="text-neutral-600">Formato</dt>
          <dd className="font-mono text-neutral-400">{item.mimeType}</dd>
          <dt className="text-neutral-600">Subida</dt>
          <dd className="font-mono text-neutral-400">
            {item.createdAt.slice(0, 10)}
          </dd>
        </dl>

        <div className="flex flex-col gap-1">
          <span className={labelStyle}>Dirección</span>
          <div className="flex gap-2">
            <input readOnly className={`${field} font-mono text-[11px]`} value={item.url} />
            <button
              type="button"
              className={ghost}
              onClick={() => navigator.clipboard?.writeText(item.url)}
            >
              Copiar
            </button>
          </div>
        </div>

        {locales.map((locale: Locale) => (
          <div key={locale} className="flex flex-col gap-1.5">
            <span className={labelStyle}>{localeNames[locale]}</span>
            <input
              className={field}
              value={text[locale]?.alt ?? ""}
              placeholder="Texto alternativo — qué se ve en la imagen"
              onChange={(e) =>
                setText({ ...text, [locale]: { ...text[locale], alt: e.target.value } })
              }
            />
            <input
              className={field}
              value={text[locale]?.caption ?? ""}
              placeholder="Pie de foto (opcional)"
              onChange={(e) =>
                setText({ ...text, [locale]: { ...text[locale], caption: e.target.value } })
              }
            />
          </div>
        ))}

        {missing.length > 0 ? (
          <p className="text-[11px] text-amber-500">
            Sin texto alternativo en: {missing.join(", ")}. Un lector de pantalla
            no podrá describir esta imagen.
          </p>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <span className={labelStyle}>Uso</span>
          {inUse ? (
            <ul className="flex flex-wrap gap-1.5">
              {item.usage.map((u, i) => (
                <li key={i}>
                  {u.href ? (
                    <Link
                      href={u.href}
                      className="rounded border border-neutral-800 px-2 py-0.5 text-[11px] text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-200"
                    >
                      {u.label} · {u.field}
                    </Link>
                  ) : (
                    <span className="rounded border border-neutral-900 px-2 py-0.5 text-[11px] text-neutral-600">
                      {u.label} · {u.field}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-neutral-600">No se usa en ningún sitio</p>
          )}
        </div>

        {result ? (
          <p
            role="status"
            className={`text-[11px] ${result.ok ? "text-green-400" : "text-red-400"}`}
          >
            {result.message}
          </p>
        ) : null}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            className={ghost}
            disabled={pending}
            onClick={() => {
              setResult(null);
              startTransition(async () => {
                const outcome = await actions.saveText(item.id, text);
                setResult(outcome);
                if (outcome.ok) onSaved();
              });
            }}
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>
          <button
            type="button"
            className={`${ghost} ${inUse ? "" : "border-red-900/60 text-red-400"}`}
            disabled={pending || inUse}
            title={inUse ? "Está en uso; quítala de ahí primero" : undefined}
            onClick={() => {
              if (!confirm("¿Eliminar esta imagen? No se puede deshacer.")) return;
              setResult(null);
              startTransition(async () => {
                const outcome = await actions.remove(item.id);
                setResult(outcome);
                if (outcome.ok) onDeleted();
              });
            }}
          >
            Eliminar
          </button>
        </div>
      </aside>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Gallery                                                                    */
/* -------------------------------------------------------------------------- */

export default function MediaLibrary({
  items,
  totals,
  actions,
}: {
  items: MediaItem[];
  totals: { count: number; bytes: number };
  actions: Actions;
}) {
  const router = useRouter();
  const picker = useRef<HTMLInputElement>(null);

  /**
   * The list is not copied into state. Every mutation goes through a server
   * action and then `router.refresh()`, so the server stays the only source of
   * truth - which also keeps the usage counts honest, since they are computed
   * there and could not be derived on the client anyway.
   */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();

    const filtered = items.filter((item) => {
      if (filter === "missing-alt" && missingAlt(item).length === 0) return false;
      if (filter === "in-use" && item.usage.length === 0) return false;
      if (filter === "unused" && item.usage.length > 0) return false;

      if (!q) return true;
      return (
        item.url.toLowerCase().includes(q) ||
        locales.some(
          (l) =>
            item.text[l]?.alt.toLowerCase().includes(q) ||
            item.text[l]?.caption.toLowerCase().includes(q),
        ) ||
        item.usage.some((u) => u.label.toLowerCase().includes(q))
      );
    });

    return [...filtered].sort((a, b) => {
      if (sort === "largest") return b.sizeBytes - a.sizeBytes;
      if (sort === "name") return a.url.localeCompare(b.url);
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [items, query, filter, sort]);

  const selected = items.find((i) => i.id === selectedId) ?? null;
  const withoutAlt = items.filter((i) => missingAlt(i).length > 0).length;

  /**
   * Uploads one at a time rather than in parallel: each file is decoded and
   * re-encoded on the server, and a dozen at once would just queue anyway
   * while making the progress meaningless.
   */
  async function upload(files: File[]) {
    setUploading(true);
    setNotice(null);

    const failures: string[] = [];
    let lastId: string | null = null;
    let savedFrom = 0;
    let savedTo = 0;

    for (const [index, file] of files.entries()) {
      if (files.length > 1) {
        setNotice(`Subiendo ${index + 1} de ${files.length}: ${file.name}`);
      }

      const result = await uploadImage(file);

      if (!result.ok) {
        failures.push(`${file.name}: ${result.error}`);
        continue;
      }

      lastId = result.media.id;
      savedFrom += file.size;
      savedTo += result.media.sizeBytes;

      if (files.length === 1) {
        setNotice(`Subida: ${savingLabel(file.size, result.media)}`);
      }
    }

    setUploading(false);
    router.refresh();

    if (files.length > 1) {
      const ok = files.length - failures.length;
      const saved = savedFrom > 0 ? Math.round((1 - savedTo / savedFrom) * 100) : 0;
      setNotice(
        `${ok} de ${files.length} subidas · ${kb(savedFrom)} → ${kb(savedTo)} webp (−${saved}%)` +
          (failures.length > 0 ? ` · fallaron: ${failures.join("; ")}` : ""),
      );
    } else if (failures.length > 0) {
      setNotice(failures[0]);
    }

    // Open the last one: writing its alt text is the point of uploading.
    if (lastId && files.length === 1) setSelectedId(lastId);
  }

  const filters: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "Todas", count: items.length },
    { value: "missing-alt", label: "Sin texto alternativo", count: withoutAlt },
    {
      value: "in-use",
      label: "En uso",
      count: items.filter((i) => i.usage.length > 0).length,
    },
    {
      value: "unused",
      label: "Sin usar",
      count: items.filter((i) => i.usage.length === 0).length,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Multimedia</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {totals.count} {totals.count === 1 ? "imagen" : "imágenes"} ·{" "}
            {kb(totals.bytes)} en la base
            {withoutAlt > 0 ? (
              <span className="text-amber-500"> · {withoutAlt} sin texto alternativo</span>
            ) : null}
          </p>
        </div>

        <button
          type="button"
          disabled={uploading}
          onClick={() => picker.current?.click()}
          className="rounded border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 transition-colors hover:border-neutral-500 disabled:opacity-50"
        >
          {uploading ? "Procesando…" : "Subir imágenes"}
        </button>
      </header>

      {notice ? (
        <p className="rounded border border-neutral-800 px-4 py-2 text-sm text-neutral-400">
          {notice}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${field} max-w-64`}
          value={query}
          placeholder="Buscar por texto o por dónde se usa…"
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="flex flex-wrap gap-1">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded border px-2.5 py-1 text-xs transition-colors ${
                filter === f.value
                  ? "border-neutral-500 bg-neutral-800 text-neutral-100"
                  : "border-neutral-800 text-neutral-500 hover:border-neutral-600"
              }`}
            >
              {f.label}
              <span className="ml-1.5 font-mono text-[10px] text-neutral-600">
                {f.count}
              </span>
            </button>
          ))}
        </div>

        <select
          className={`${field} ml-auto max-w-40`}
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
        >
          <option value="recent">Más recientes</option>
          <option value="largest">Más pesadas</option>
          <option value="name">Por dirección</option>
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="rounded border border-dashed border-neutral-800 px-6 py-14 text-center text-sm text-neutral-500">
          {items.length === 0
            ? "Todavía no hay imágenes. Se convierten a WebP y se guardan en la base de datos."
            : "Ninguna imagen coincide con el filtro."}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((item) => {
            const missing = missingAlt(item);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className="group flex w-full flex-col overflow-hidden rounded-lg border border-neutral-900 text-left transition-colors hover:border-neutral-700 focus-visible:border-neutral-500 focus-visible:outline-none"
                >
                  <span className="relative block aspect-[4/3] w-full bg-neutral-950">
                    <Image
                      src={item.url}
                      alt={item.text.es?.alt || ""}
                      fill
                      sizes="(min-width: 1280px) 20vw, (min-width: 640px) 33vw, 50vw"
                      className="object-cover"
                    />
                    {missing.length > 0 ? (
                      <span
                        title={`Sin texto alternativo en: ${missing.join(", ")}`}
                        className="absolute top-1.5 right-1.5 rounded bg-amber-950/90 px-1.5 py-0.5 font-mono text-[10px] text-amber-400"
                      >
                        sin alt
                      </span>
                    ) : null}
                  </span>

                  <span className="flex items-center justify-between gap-2 px-2.5 py-2">
                    <span className="min-w-0 truncate text-[11px] text-neutral-400">
                      {item.text.es?.alt || "Sin describir"}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-neutral-600">
                      {item.usage.length > 0 ? `${item.usage.length} uso${item.usage.length === 1 ? "" : "s"}` : kb(item.sizeBytes)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected ? (
        <Details
          key={selected.id}
          item={selected}
          actions={actions}
          onClose={() => setSelectedId(null)}
          onSaved={() => router.refresh()}
          onDeleted={() => {
            setSelectedId(null);
            router.refresh();
          }}
        />
      ) : null}

      <input
        ref={picker}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) void upload(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
