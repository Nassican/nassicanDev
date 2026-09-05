"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { locales, localeNames, type Locale } from "@nassican/shared";
import { savingLabel, uploadImage } from "@/lib/upload";
import type { MediaItem, MediaText } from "@/lib/media-library";
import type { ActionResult } from "@/app/(panel)/contenido/multimedia/actions";

const field =
  "w-full rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-700 focus:border-neutral-600 focus:outline-none";
const ghost =
  "rounded border border-neutral-800 px-2.5 py-1 text-xs text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-200 disabled:opacity-40";

function kb(bytes: number) {
  return `${Math.round(bytes / 1024)} KB`;
}

function MediaCard({
  item,
  actions,
}: {
  item: MediaItem;
  actions: {
    saveText: (id: string, text: MediaText) => Promise<ActionResult>;
    remove: (id: string) => Promise<ActionResult>;
  };
}) {
  const [text, setText] = useState<MediaText>(item.text);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const missing = locales.filter((l) => !text[l]?.alt.trim());
  const inUse = item.usage.length > 0;

  function run(action: () => Promise<ActionResult>) {
    setResult(null);
    startTransition(async () => setResult(await action()));
  }

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-neutral-900 p-4 lg:flex-row">
      <div className="flex shrink-0 flex-col gap-2">
        <Image
          src={item.url}
          alt={text.es?.alt || ""}
          width={item.width ?? 240}
          height={item.height ?? 135}
          className="h-28 w-48 rounded border border-neutral-800 object-cover"
        />
        <p className="font-mono text-[10px] text-neutral-600">
          {kb(item.sizeBytes)} · {item.width}×{item.height}
        </p>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {locales.map((locale: Locale) => (
          <div key={locale} className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">
              {localeNames[locale]}
            </span>
            <input
              className={field}
              value={text[locale]?.alt ?? ""}
              placeholder="Texto alternativo — qué se ve en la imagen"
              onChange={(e) =>
                setText({
                  ...text,
                  [locale]: { ...text[locale], alt: e.target.value },
                })
              }
            />
            <input
              className={field}
              value={text[locale]?.caption ?? ""}
              placeholder="Pie de foto (opcional)"
              onChange={(e) =>
                setText({
                  ...text,
                  [locale]: { ...text[locale], caption: e.target.value },
                })
              }
            />
          </div>
        ))}

        {missing.length > 0 ? (
          <p className="text-[11px] text-amber-500">
            Sin texto alternativo en: {missing.join(", ")}
          </p>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">
            Uso
          </span>
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
            <p className="text-[11px] text-neutral-600">
              No se usa en ningún sitio
            </p>
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

        <div className="flex gap-2">
          <button
            type="button"
            className={ghost}
            disabled={pending}
            onClick={() => run(() => actions.saveText(item.id, text))}
          >
            {pending ? "Guardando…" : "Guardar textos"}
          </button>
          <button
            type="button"
            className={`${ghost} ${inUse ? "" : "border-red-900/60 text-red-400"}`}
            disabled={pending || inUse}
            title={inUse ? "Está en uso; quítala de ahí primero" : undefined}
            onClick={() => {
              if (!confirm("¿Eliminar esta imagen? No se puede deshacer.")) return;
              run(() => actions.remove(item.id));
            }}
          >
            Eliminar
          </button>
        </div>
      </div>
    </article>
  );
}

export default function MediaLibrary({
  items,
  totals,
  actions,
}: {
  items: MediaItem[];
  totals: { count: number; bytes: number };
  actions: {
    saveText: (id: string, text: MediaText) => Promise<ActionResult>;
    remove: (id: string) => Promise<ActionResult>;
  };
}) {
  const picker = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function upload(file: File) {
    setUploading(true);
    setNotice(null);

    const result = await uploadImage(file);
    setUploading(false);

    if (!result.ok) {
      setNotice(result.error);
      return;
    }

    setNotice(`Subida: ${savingLabel(file.size, result.media)}`);
    // The server component re-reads the library on refresh.
    startTransition(() => window.location.reload());
  }

  const withoutAlt = items.filter((i) =>
    locales.some((l) => !i.text[l]?.alt.trim()),
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Multimedia</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {totals.count} {totals.count === 1 ? "imagen" : "imágenes"} ·{" "}
            {kb(totals.bytes)} en la base
            {withoutAlt > 0 ? (
              <span className="text-amber-500">
                {" "}
                · {withoutAlt} sin texto alternativo completo
              </span>
            ) : null}
          </p>
        </div>

        <button
          type="button"
          disabled={uploading}
          onClick={() => picker.current?.click()}
          className="rounded border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 transition-colors hover:border-neutral-500 disabled:opacity-50"
        >
          {uploading ? "Procesando…" : "Subir imagen"}
        </button>
      </header>

      {notice ? (
        <p className="rounded border border-neutral-800 px-4 py-2 text-sm text-neutral-400">
          {notice}
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="rounded border border-dashed border-neutral-800 px-6 py-12 text-center text-sm text-neutral-500">
          Todavía no hay imágenes. Se convierten a WebP y se guardan en la base
          de datos.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <MediaCard key={item.id} item={item} actions={actions} />
          ))}
        </div>
      )}

      <input
        ref={picker}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
