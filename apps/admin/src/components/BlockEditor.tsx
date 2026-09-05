"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { contentBlockTypes, type ContentBlock } from "@nassican/shared";
import { savingLabel, uploadImage } from "@/lib/upload";

const typeLabels: Record<ContentBlock["type"], string> = {
  paragraph: "Párrafo",
  heading: "Encabezado",
  list: "Lista",
  code: "Código",
  quote: "Cita",
  image: "Imagen",
};

/**
 * An image block cannot start empty - it needs a picture - so "add image"
 * opens the file picker instead of inserting a placeholder. Every other type
 * starts blank.
 */
function emptyBlock(
  type: Exclude<ContentBlock["type"], "image">,
): ContentBlock {
  switch (type) {
    case "list":
      return { type: "list", items: [""] };
    case "code":
      return { type: "code", code: "" };
    default:
      return { type, text: "" };
  }
}

const field =
  "w-full rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none";

const iconButton =
  "rounded border border-neutral-800 px-2 py-1 text-xs text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-30";

/**
 * Editor for a `ContentBlock[]` body.
 *
 * Blocks rather than a rich-text field on purpose: it is the same shape the
 * public site renders, so what is stored can never contain markup `Prose` does
 * not know how to draw.
 */
export default function BlockEditor({
  blocks,
  onChange,
}: {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  async function addImage(file: File) {
    setUploading(true);
    setUploadError(null);
    setSaving(null);

    const result = await uploadImage(file);
    setUploading(false);

    if (!result.ok) {
      setUploadError(result.error);
      return;
    }

    setSaving(savingLabel(file.size, result.media));
    onChange([
      ...blocks,
      {
        type: "image",
        mediaId: result.media.id,
        url: result.media.url,
        alt: "",
        width: result.media.width ?? undefined,
        height: result.media.height ?? undefined,
      },
    ]);
  }

  function replace(index: number, block: ContentBlock) {
    onChange(blocks.map((b, i) => (i === index ? block : b)));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      {blocks.length === 0 ? (
        <p className="rounded border border-dashed border-neutral-800 px-4 py-6 text-center text-sm text-neutral-600">
          Sin contenido todavía. Añade un bloque para empezar.
        </p>
      ) : null}

      {blocks.map((block, index) => (
        <article
          key={index}
          className="rounded border border-neutral-800 bg-neutral-950/60"
        >
          <header className="flex items-center justify-between gap-2 border-b border-neutral-900 px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">
              {typeLabels[block.type]}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                className={iconButton}
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label="Subir bloque"
              >
                ↑
              </button>
              <button
                type="button"
                className={iconButton}
                onClick={() => move(index, 1)}
                disabled={index === blocks.length - 1}
                aria-label="Bajar bloque"
              >
                ↓
              </button>
              <button
                type="button"
                className={iconButton}
                onClick={() => onChange(blocks.filter((_, i) => i !== index))}
                aria-label="Eliminar bloque"
              >
                Eliminar
              </button>
            </div>
          </header>

          <div className="flex flex-col gap-2 p-3">
            {block.type === "list" ? (
              <>
                {block.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="flex gap-2">
                    <input
                      className={field}
                      value={item}
                      placeholder={`Elemento ${itemIndex + 1}`}
                      onChange={(e) =>
                        replace(index, {
                          ...block,
                          items: block.items.map((v, i) =>
                            i === itemIndex ? e.target.value : v,
                          ),
                        })
                      }
                    />
                    <button
                      type="button"
                      className={iconButton}
                      onClick={() =>
                        replace(index, {
                          ...block,
                          items: block.items.filter((_, i) => i !== itemIndex),
                        })
                      }
                      aria-label={`Quitar elemento ${itemIndex + 1}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className={iconButton}
                    onClick={() =>
                      replace(index, { ...block, items: [...block.items, ""] })
                    }
                  >
                    Añadir elemento
                  </button>
                  <label className="flex items-center gap-2 text-xs text-neutral-400">
                    <input
                      type="checkbox"
                      checked={block.ordered ?? false}
                      onChange={(e) =>
                        replace(index, { ...block, ordered: e.target.checked })
                      }
                    />
                    Numerada
                  </label>
                </div>
              </>
            ) : block.type === "code" ? (
              <>
                <input
                  className={field}
                  value={block.language ?? ""}
                  placeholder="Lenguaje (opcional): ts, bash, sql…"
                  onChange={(e) =>
                    replace(index, { ...block, language: e.target.value || undefined })
                  }
                />
                <textarea
                  className={`${field} min-h-32 font-mono`}
                  value={block.code}
                  placeholder="Código"
                  onChange={(e) => replace(index, { ...block, code: e.target.value })}
                />
              </>
            ) : block.type === "image" ? (
              <>
                <div className="flex gap-3">
                  <Image
                    src={block.url}
                    alt=""
                    width={block.width ?? 160}
                    height={block.height ?? 90}
                    className="h-20 w-auto rounded border border-neutral-800 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[10px] break-all text-neutral-600">
                      {block.url}
                    </p>
                    <p className="mt-1 text-[11px] text-neutral-600">
                      {block.width}×{block.height}
                    </p>
                  </div>
                </div>
                <input
                  className={field}
                  value={block.alt}
                  placeholder="Texto alternativo — qué se ve en la imagen"
                  onChange={(e) => replace(index, { ...block, alt: e.target.value })}
                />
                {!block.alt.trim() ? (
                  <p className="text-[11px] text-amber-500">
                    Sin texto alternativo: un lector de pantalla no podrá
                    describir esta imagen.
                  </p>
                ) : null}
                <input
                  className={field}
                  value={block.caption ?? ""}
                  placeholder="Pie de foto (opcional)"
                  onChange={(e) =>
                    replace(index, { ...block, caption: e.target.value || undefined })
                  }
                />
              </>
            ) : (
              <textarea
                className={`${field} ${block.type === "heading" ? "min-h-0" : "min-h-24"}`}
                rows={block.type === "heading" ? 1 : 4}
                value={block.text}
                placeholder={typeLabels[block.type]}
                onChange={(e) => replace(index, { ...block, text: e.target.value })}
              />
            )}
          </div>
        </article>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        {contentBlockTypes.map((type) =>
          type === "image" ? (
            <button
              key={type}
              type="button"
              className={iconButton}
              disabled={uploading}
              onClick={() => picker.current?.click()}
            >
              {uploading ? "Subiendo…" : "+ Imagen"}
            </button>
          ) : (
            <button
              key={type}
              type="button"
              className={iconButton}
              onClick={() => onChange([...blocks, emptyBlock(type)])}
            >
              + {typeLabels[type]}
            </button>
          ),
        )}

        {saving ? (
          <span className="text-[11px] text-neutral-600">{saving}</span>
        ) : null}
        {uploadError ? (
          <span role="alert" className="text-[11px] text-red-400">
            {uploadError}
          </span>
        ) : null}
      </div>

      <input
        ref={picker}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void addImage(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
