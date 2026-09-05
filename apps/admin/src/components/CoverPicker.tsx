"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { savingLabel, uploadImage, type UploadedMedia } from "@/lib/upload";

export type { UploadedMedia };

/**
 * Uploads a cover image and reports the stored media back to the editor.
 *
 * The picture is converted to WebP on the server before it is stored, so what
 * the preview shows is what a visitor will actually download - which is the
 * point of showing the resulting size next to it.
 */
export default function CoverPicker({
  url,
  onChange,
}: {
  url: string | null;
  onChange: (media: UploadedMedia | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function upload(file: File) {
    setPending(true);
    setError(null);
    setInfo(null);

    const result = await uploadImage(file);
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setInfo(savingLabel(file.size, result.media));
    onChange(result.media);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <div className="relative size-20 shrink-0 overflow-hidden rounded border border-neutral-800 bg-neutral-950">
          {url ? (
            <Image src={url} alt="" fill sizes="80px" className="object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center font-mono text-[10px] text-neutral-700">
              sin portada
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => input.current?.click()}
              className="rounded border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 transition-colors hover:border-neutral-500 disabled:opacity-50"
            >
              {pending ? "Procesando…" : url ? "Reemplazar" : "Subir imagen"}
            </button>
            {url ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  onChange(null);
                  setInfo(null);
                }}
                className="rounded border border-neutral-800 px-3 py-1.5 text-xs text-neutral-500 transition-colors hover:border-neutral-600 hover:text-neutral-300"
              >
                Quitar
              </button>
            ) : null}
          </div>

          <p className="text-[11px] text-neutral-600">
            {info ?? "Se convierte a WebP y se guarda en la base de datos"}
          </p>
          {error ? (
            <p role="alert" className="text-[11px] text-red-400">
              {error}
            </p>
          ) : null}
        </div>
      </div>

      <input
        ref={input}
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
