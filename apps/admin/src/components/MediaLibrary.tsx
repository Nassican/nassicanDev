"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BsCheck2,
  BsChevronLeft,
  BsChevronRight,
  BsFolder2,
  BsFolder2Open,
  BsGrid3X3Gap,
  BsInbox,
  BsListUl,
  BsPencil,
  BsPlus,
  BsTrash,
  BsUpload,
} from "react-icons/bs";
import { locales, localeNames, type Locale } from "@nassican/shared";
import { Pager } from "@/components/Pager";
import Toast from "@/components/Toast";
import { savingLabel, uploadImage } from "@/lib/upload";
import {
  MEDIA_PAGE_SIZE,
  formatBytes,
  inFolder,
  libraryQuery,
  missingAlt,
  pageOf,
  parseLibraryState,
  passesFilter,
  selectMedia,
  type LibraryState,
  type MediaFilter,
  type MediaSort,
} from "@/lib/media-view";
import type { MediaFolderItem, MediaItem, MediaText } from "@/lib/media-library";
import type { ActionResult } from "@/app/(panel)/contenido/multimedia/actions";

type Actions = {
  saveText: (id: string, text: MediaText) => Promise<ActionResult>;
  remove: (id: string) => Promise<ActionResult>;
  createFolder: (name: string) => Promise<ActionResult & { id?: string }>;
  renameFolder: (id: string, name: string) => Promise<ActionResult>;
  deleteFolder: (id: string) => Promise<ActionResult>;
  move: (ids: string[], folderId: string | null) => Promise<ActionResult>;
  trash: (ids: string[]) => Promise<ActionResult>;
};

/*
 * The look of a field, without a width. `field` is the full-width one; a
 * narrow field builds on `fieldBase` instead of adding `w-24` to `field`:
 * both would be in the class list, and `w-full` wins in the stylesheet — which
 * is how a status select once took the whole row and squeezed the title out.
 */
const fieldBase =
  "rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none";
const field = `w-full ${fieldBase}`;
const labelStyle = "font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500";
const ghost =
  "rounded border border-neutral-800 px-2.5 py-1 text-xs text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-200 disabled:opacity-40";
const iconButton =
  "inline-flex items-center justify-center rounded p-1.5 text-neutral-500 transition-colors hover:text-neutral-200 disabled:opacity-40";

const filterLabels: Record<MediaFilter, string> = {
  all: "Todas",
  "missing-alt": "Sin texto alternativo",
  "in-use": "En uso",
  unused: "Sin usar",
};

const sortLabels: Record<MediaSort, string> = {
  recent: "Más recientes",
  oldest: "Más antiguas",
  largest: "Más pesadas",
  smallest: "Más ligeras",
};

const ACCEPT = "image/png,image/jpeg,image/webp,image/avif,image/gif";

/* -------------------------------------------------------------------------- */
/* Detail panel                                                               */
/* -------------------------------------------------------------------------- */

function Details({
  item,
  folders,
  position,
  actions,
  onClose,
  onStep,
  onChanged,
  onDeleted,
}: {
  item: MediaItem;
  folders: MediaFolderItem[];
  /** «3 de 41» in the current selection, and whether there is a way back or on. */
  position: { index: number; total: number };
  actions: Actions;
  onClose: () => void;
  onStep: (delta: -1 | 1) => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  // Mounted with `key={item.id}`, so stepping to another image gives a fresh
  // panel rather than one that has to be reset by an effect.
  const [text, setText] = useState<MediaText>(item.text);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      // Arrows step through the images, except while typing, where they move the caret.
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (typing) return;
      if (e.key === "ArrowLeft") onStep(-1);
      if (e.key === "ArrowRight") onStep(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onStep]);

  const missing = missingAlt({ text });
  const inUse = item.usage.length > 0;

  function act(action: () => Promise<ActionResult>, after: () => void) {
    setResult(null);
    startTransition(async () => {
      const outcome = await action();
      setResult(outcome);
      if (outcome.ok) after();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Cerrar" className="flex-1 bg-black/60" onClick={onClose} />

      <aside
        role="dialog"
        aria-label="Detalle de la imagen"
        className="flex w-full max-w-lg flex-col gap-4 overflow-y-auto border-l border-neutral-800 bg-neutral-950 p-5"
      >
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              className={iconButton}
              aria-label="Imagen anterior (←)"
              title="Imagen anterior (←)"
              disabled={position.index <= 0}
              onClick={() => onStep(-1)}
            >
              <BsChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <span className="font-mono text-[11px] tabular-nums text-neutral-500">
              {position.index + 1} de {position.total}
            </span>
            <button
              type="button"
              className={iconButton}
              aria-label="Imagen siguiente (→)"
              title="Imagen siguiente (→)"
              disabled={position.index >= position.total - 1}
              onClick={() => onStep(1)}
            >
              <BsChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <button type="button" className={ghost} onClick={onClose}>
            Cerrar
          </button>
        </header>

        <Image
          src={item.url}
          alt={text.es?.alt || ""}
          width={item.width ?? 640}
          height={item.height ?? 360}
          sizes="(min-width: 640px) 32rem, 100vw"
          className="h-auto max-h-[45vh] w-full rounded border border-neutral-800 object-contain"
        />

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          <dt className="text-neutral-600">Peso</dt>
          <dd className="font-mono text-neutral-400">{formatBytes(item.sizeBytes)}</dd>
          <dt className="text-neutral-600">Dimensiones</dt>
          <dd className="font-mono text-neutral-400">
            {item.width}×{item.height}
          </dd>
          <dt className="text-neutral-600">Formato</dt>
          <dd className="font-mono text-neutral-400">{item.mimeType}</dd>
          <dt className="text-neutral-600">Subida</dt>
          <dd className="font-mono text-neutral-400">{item.createdAt.slice(0, 10)}</dd>
        </dl>

        <label className="flex flex-col gap-1">
          <span className={labelStyle}>Carpeta</span>
          <select
            className={field}
            value={item.folderId ?? ""}
            disabled={pending}
            onChange={(e) => act(() => actions.move([item.id], e.target.value || null), onChanged)}
          >
            <option value="">Sin carpeta</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1">
          <span className={labelStyle}>Dirección</span>
          <div className="flex gap-2">
            <input readOnly className={`${field} font-mono text-[11px]`} value={item.url} aria-label="Dirección" />
            <button type="button" className={ghost} onClick={() => navigator.clipboard?.writeText(item.url)}>
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
              aria-label={`Texto alternativo (${localeNames[locale]})`}
              onChange={(e) => setText({ ...text, [locale]: { ...text[locale], alt: e.target.value } })}
            />
            <input
              className={field}
              value={text[locale]?.caption ?? ""}
              placeholder="Pie de foto (opcional)"
              aria-label={`Pie de foto (${localeNames[locale]})`}
              onChange={(e) => setText({ ...text, [locale]: { ...text[locale], caption: e.target.value } })}
            />
          </div>
        ))}

        {missing.length > 0 ? (
          <p className="text-[11px] text-amber-500">
            Sin texto alternativo en: {missing.join(", ")}. Un lector de pantalla no podrá describir esta imagen.
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
          <p role="status" className={`text-[11px] ${result.ok ? "text-green-400" : "text-red-400"}`}>
            {result.message}
          </p>
        ) : null}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            className={ghost}
            disabled={pending}
            onClick={() => act(() => actions.saveText(item.id, text), onChanged)}
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>
          <button
            type="button"
            className={`${ghost} ${inUse ? "" : "border-red-900/60 text-red-400"}`}
            disabled={pending || inUse}
            title={inUse ? "Está en uso; quítala de ahí primero" : undefined}
            onClick={() => {
              if (!confirm("¿Mover esta imagen a la papelera? Se puede restaurar durante 30 días.")) return;
              act(() => actions.remove(item.id), onDeleted);
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
/* Folders                                                                    */
/* -------------------------------------------------------------------------- */

function FolderNav({
  folders,
  counts,
  active,
  pending,
  onOpen,
  onCreate,
}: {
  folders: MediaFolderItem[];
  counts: { all: number; none: number; byFolder: Map<string, number> };
  active: string;
  pending: boolean;
  onOpen: (folder: string) => void;
  onCreate: (name: string) => void;
}) {
  const [creating, setCreating] = useState<string | null>(null);

  const entry = (key: string, label: string, count: number, icon: ReactNode) => (
    <li key={key} className="shrink-0">
      <button
        type="button"
        aria-current={active === key ? "true" : undefined}
        onClick={() => onOpen(key)}
        className={`flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-sm transition-colors ${
          active === key ? "bg-neutral-900 text-neutral-100" : "text-neutral-400 hover:bg-neutral-900/60 hover:text-neutral-200"
        }`}
      >
        {icon}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="font-mono text-[10px] tabular-nums text-neutral-500">{count}</span>
      </button>
    </li>
  );

  return (
    <nav aria-label="Carpetas" className="flex flex-col gap-2 lg:w-52 lg:shrink-0">
      <span className={`${labelStyle} hidden lg:block`}>Carpetas</span>
      {/* A row that scrolls on a phone, a column beside the grid on a wide screen. */}
      <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
        {entry("all", "Todas", counts.all, <BsGrid3X3Gap className="h-3.5 w-3.5 shrink-0" aria-hidden />)}
        {entry("none", "Sin carpeta", counts.none, <BsInbox className="h-3.5 w-3.5 shrink-0" aria-hidden />)}
        {folders.map((f) =>
          entry(
            f.id,
            f.name,
            counts.byFolder.get(f.id) ?? 0,
            active === f.id ? (
              <BsFolder2Open className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : (
              <BsFolder2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ),
          ),
        )}
        <li className="shrink-0">
          {creating === null ? (
            <button
              type="button"
              onClick={() => setCreating("")}
              className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-sm text-neutral-500 transition-colors hover:text-neutral-200"
            >
              <BsPlus className="h-4 w-4 shrink-0" aria-hidden />
              Nueva carpeta
            </button>
          ) : (
            <form
              className="flex gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                onCreate(creating);
                setCreating(null);
              }}
            >
              <input
                autoFocus
                className={`${field} min-w-36`}
                value={creating}
                maxLength={60}
                placeholder="Nombre"
                aria-label="Nombre de la carpeta nueva"
                onChange={(e) => setCreating(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setCreating(null)}
              />
              <button type="submit" className={iconButton} aria-label="Crear carpeta" disabled={pending}>
                <BsCheck2 className="h-4 w-4" aria-hidden />
              </button>
            </form>
          )}
        </li>
      </ul>
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/* Library                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The media library, built to stay usable at a few hundred images.
 *
 * Everything that decides what is shown — folder, filter, search, order, view,
 * page — lives in the address, written with `history.replaceState`. That keeps
 * a filtered view a link and «back» meaningful, and, unlike `router.replace`, it
 * does not send the server to read the whole library again on every key.
 *
 * Thumbnails are paged — 48 at a time — and lazy, so the grid costs what is on
 * screen, not what is in the database.
 */
export default function MediaLibrary({
  items,
  folders,
  totals,
  actions,
}: {
  items: MediaItem[];
  folders: MediaFolderItem[];
  totals: { count: number; bytes: number };
  actions: Actions;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const state = parseLibraryState(params);
  const picker = useRef<HTMLInputElement>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [selecting, setSelecting] = useState(false);
  const [moveTarget, setMoveTarget] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  // A folder deleted elsewhere, or a stale link: fall back to everything.
  const folder = folders.find((f) => f.id === state.folder) ?? null;
  const scope = state.folder === "all" || state.folder === "none" || folder ? state.folder : "all";
  const view: LibraryState = { ...state, folder: scope };

  function go(next: Partial<LibraryState>) {
    // Anything but the page itself starts again at page one: staying on page 7
    // of a narrower selection shows an empty grid and looks broken.
    const merged = { ...view, ...("page" in next ? {} : { page: 0 }), ...next };
    window.history.replaceState(null, "", `${pathname}${libraryQuery(merged)}`);
  }

  const visible = selectMedia(items, view);
  const { rows, page, pages } = pageOf(visible, view.page);
  const selected = selectedId ? (items.find((i) => i.id === selectedId) ?? null) : null;
  const selectedIndex = selected ? visible.findIndex((i) => i.id === selected.id) : -1;

  const inScope = items.filter((i) => inFolder(i, scope));
  const counts = {
    all: items.length,
    none: items.filter((i) => i.folderId === null).length,
    byFolder: items.reduce((map, i) => (i.folderId ? map.set(i.folderId, (map.get(i.folderId) ?? 0) + 1) : map), new Map<string, number>()),
  };
  const withoutAlt = items.filter((i) => missingAlt(i).length > 0).length;
  const scopeLabel = scope === "all" ? "Todas" : scope === "none" ? "Sin carpeta" : (folder?.name ?? "Todas");

  function run(action: () => Promise<ActionResult>, after?: () => void) {
    setResult(null);
    startTransition(async () => {
      const outcome = await action();
      setResult(outcome);
      if (outcome.ok) {
        after?.();
        router.refresh();
      }
    });
  }

  // Not memoised by hand: the React Compiler does it, and refuses to compile a
  // component whose manual memoisation it cannot prove.
  function step(delta: -1 | 1) {
    const next = visible[selectedIndex + delta];
    if (next) setSelectedId(next.id);
  }

  function toggle(id: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function stopSelecting() {
    setSelecting(false);
    setPicked(new Set());
  }

  /**
   * One at a time rather than in parallel: each file is decoded and re-encoded
   * on the server, and a dozen at once would queue anyway while making the
   * progress meaningless. Into the open folder, so uploading from «Certificados»
   * files the diploma where it was dropped.
   */
  async function upload(files: File[]) {
    const images = files.filter((f) => ACCEPT.split(",").includes(f.type));
    const skipped = files.length - images.length;
    if (images.length === 0) {
      setNotice("Ninguno de esos archivos es una imagen admitida (PNG, JPEG, WebP, AVIF o GIF).");
      return;
    }

    setUploading(true);
    setNotice(null);
    const target = folder?.id ?? null;
    const failures: string[] = [];
    let lastId: string | null = null;
    let savedFrom = 0;
    let savedTo = 0;

    for (const [index, file] of images.entries()) {
      if (images.length > 1) setNotice(`Subiendo ${index + 1} de ${images.length}: ${file.name}`);
      const outcome = await uploadImage(file, target);
      if (!outcome.ok) {
        failures.push(`${file.name}: ${outcome.error}`);
        continue;
      }
      lastId = outcome.media.id;
      savedFrom += file.size;
      savedTo += outcome.media.sizeBytes;
      if (images.length === 1) setNotice(`Subida: ${savingLabel(file.size, outcome.media)}`);
    }

    setUploading(false);
    router.refresh();

    const ignored = skipped > 0 ? ` · ${skipped} ${skipped === 1 ? "archivo ignorado" : "archivos ignorados"} (no eran imágenes)` : "";
    if (images.length > 1) {
      const ok = images.length - failures.length;
      const saved = savedFrom > 0 ? Math.round((1 - savedTo / savedFrom) * 100) : 0;
      setNotice(
        `${ok} de ${images.length} subidas${folder ? ` a «${folder.name}»` : ""} · ${formatBytes(savedFrom)} → ${formatBytes(savedTo)} webp (−${saved}%)` +
          (failures.length > 0 ? ` · fallaron: ${failures.join("; ")}` : "") +
          ignored,
      );
    } else if (failures.length > 0) {
      setNotice(failures[0] + ignored);
    } else if (ignored) {
      setNotice((n) => `${n ?? ""}${ignored}`);
    }

    // Open the one just uploaded: writing its alt text is the point of uploading.
    if (lastId && images.length === 1) setSelectedId(lastId);
  }

  const pageIds = rows.map((r) => r.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => picked.has(id));

  return (
    <div
      className="relative flex flex-col gap-5"
      onDragEnter={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        if (!uploading) void upload(Array.from(e.dataTransfer.files));
      }}
    >
      {dragging ? (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <p className="rounded-lg border border-dashed border-neutral-500 bg-neutral-950 px-8 py-6 text-sm text-neutral-100">
            Suelta para subir{folder ? ` a «${folder.name}»` : ""}
          </p>
        </div>
      ) : null}

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Multimedia</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {totals.count} {totals.count === 1 ? "imagen" : "imágenes"} · {formatBytes(totals.bytes)} en la base
            {withoutAlt > 0 ? <span className="text-amber-500"> · {withoutAlt} sin texto alternativo</span> : null}
          </p>
        </div>

        <button
          type="button"
          disabled={uploading}
          onClick={() => picker.current?.click()}
          className="inline-flex items-center gap-1.5 rounded border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 transition-colors hover:border-neutral-500 disabled:opacity-50"
        >
          <BsUpload className="h-3.5 w-3.5" aria-hidden />
          {uploading ? "Procesando…" : folder ? `Subir a «${folder.name}»` : "Subir imágenes"}
        </button>
      </header>

      {notice ? (
        <p className="rounded border border-neutral-800 px-4 py-2 text-sm text-neutral-400" role="status">
          {notice}
        </p>
      ) : null}

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <FolderNav
          folders={folders}
          counts={counts}
          active={scope}
          pending={pending}
          onOpen={(key) => {
            setRenaming(null);
            go({ folder: key });
          }}
          onCreate={(name) => run(() => actions.createFolder(name))}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* --------------------------- the open folder --------------------------- */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {renaming !== null && folder ? (
              <form
                className="flex items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(() => actions.renameFolder(folder.id, renaming), () => setRenaming(null));
                }}
              >
                <input
                  autoFocus
                  className={`${fieldBase} w-56`}
                  value={renaming}
                  maxLength={60}
                  aria-label="Nombre de la carpeta"
                  onChange={(e) => setRenaming(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && setRenaming(null)}
                />
                <button type="submit" className={ghost} disabled={pending}>
                  Guardar
                </button>
                <button type="button" className={ghost} onClick={() => setRenaming(null)}>
                  Cancelar
                </button>
              </form>
            ) : (
              <h2 className="flex items-baseline gap-2 text-sm font-semibold">
                {scopeLabel}
                <span className="font-mono text-[11px] font-normal text-neutral-500">{inScope.length}</span>
              </h2>
            )}
            {folder && renaming === null ? (
              <div className="flex gap-1">
                <button type="button" className={`${ghost} inline-flex items-center gap-1`} onClick={() => setRenaming(folder.name)}>
                  <BsPencil className="h-3 w-3" aria-hidden />
                  Renombrar
                </button>
                <button
                  type="button"
                  className={`${ghost} inline-flex items-center gap-1 hover:border-red-900 hover:text-red-400`}
                  disabled={pending}
                  onClick={() => {
                    const count = counts.byFolder.get(folder.id) ?? 0;
                    const what =
                      count > 0
                        ? ` ${count === 1 ? "Su imagen no se borra: pasa" : `Sus ${count} imágenes no se borran: pasan`} a «Sin carpeta».`
                        : "";
                    if (!confirm(`¿Borrar la carpeta «${folder.name}»?${what}`)) return;
                    run(() => actions.deleteFolder(folder.id), () => go({ folder: "all" }));
                  }}
                >
                  <BsTrash className="h-3 w-3" aria-hidden />
                  Borrar carpeta
                </button>
              </div>
            ) : null}
          </div>

          {/* ------------------------------ the tools ------------------------------ */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              className={`${field} min-w-0 flex-1 sm:max-w-64`}
              value={view.q}
              placeholder="Buscar por texto o por dónde se usa…"
              aria-label="Buscar imágenes"
              onChange={(e) => go({ q: e.target.value })}
            />

            <div className="flex flex-wrap gap-1">
              {(Object.keys(filterLabels) as MediaFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={view.filter === f}
                  onClick={() => go({ filter: f })}
                  className={`rounded border px-2.5 py-1 text-xs transition-colors ${
                    view.filter === f
                      ? "border-neutral-500 bg-neutral-800 text-neutral-100"
                      : "border-neutral-800 text-neutral-500 hover:border-neutral-600"
                  }`}
                >
                  {filterLabels[f]}
                  <span className="ml-1.5 font-mono text-[10px] text-neutral-500">
                    {inScope.filter((i) => passesFilter(i, f)).length}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 sm:ml-auto">
              <select
                className={fieldBase}
                value={view.sort}
                aria-label="Orden"
                onChange={(e) => go({ sort: e.target.value as MediaSort })}
              >
                {(Object.keys(sortLabels) as MediaSort[]).map((s) => (
                  <option key={s} value={s}>
                    {sortLabels[s]}
                  </option>
                ))}
              </select>
              <div className="flex rounded border border-neutral-800" role="group" aria-label="Vista">
                <button
                  type="button"
                  aria-pressed={view.view === "grid"}
                  aria-label="Cuadrícula"
                  title="Cuadrícula"
                  onClick={() => go({ view: "grid", page: view.page })}
                  className={`${iconButton} ${view.view === "grid" ? "bg-neutral-800 text-neutral-100" : ""}`}
                >
                  <BsGrid3X3Gap className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-pressed={view.view === "list"}
                  aria-label="Lista"
                  title="Lista"
                  onClick={() => go({ view: "list", page: view.page })}
                  className={`${iconButton} ${view.view === "list" ? "bg-neutral-800 text-neutral-100" : ""}`}
                >
                  <BsListUl className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
              <button
                type="button"
                aria-pressed={selecting}
                className={`${ghost} ${selecting ? "border-neutral-500 text-neutral-100" : ""}`}
                onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
              >
                {selecting ? "Terminar" : "Seleccionar"}
              </button>
            </div>
          </div>

          {/* ------------------------------ the images ------------------------------ */}
          {visible.length === 0 ? (
            <p className="rounded border border-dashed border-neutral-800 px-6 py-14 text-center text-sm text-neutral-500">
              {items.length === 0
                ? "Todavía no hay imágenes. Arrastra unas aquí: se convierten a WebP y se guardan en la base de datos."
                : inScope.length === 0
                  ? "Esta carpeta está vacía. Arrastra imágenes aquí para subirlas a ella."
                  : "Ninguna imagen coincide con el filtro."}
            </p>
          ) : view.view === "grid" ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
              {rows.map((item) => {
                const missing = missingAlt(item);
                const isPicked = picked.has(item.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-pressed={selecting ? isPicked : undefined}
                      onClick={() => (selecting ? toggle(item.id) : setSelectedId(item.id))}
                      className={`group flex w-full flex-col overflow-hidden rounded-lg border text-left transition-colors focus-visible:border-neutral-500 focus-visible:outline-none ${
                        isPicked ? "border-neutral-300" : "border-neutral-900 hover:border-neutral-700"
                      }`}
                    >
                      <span className="relative block aspect-[4/3] w-full bg-neutral-950">
                        <Image
                          src={item.url}
                          alt={item.text.es?.alt || ""}
                          fill
                          sizes="(min-width: 1536px) 14vw, (min-width: 1280px) 18vw, (min-width: 640px) 28vw, 50vw"
                          className="object-cover"
                        />
                        {selecting ? (
                          <span
                            aria-hidden
                            className={`absolute top-1.5 left-1.5 flex h-5 w-5 items-center justify-center rounded border ${
                              isPicked ? "border-neutral-100 bg-neutral-100 text-neutral-950" : "border-neutral-400 bg-black/50"
                            }`}
                          >
                            {isPicked ? <BsCheck2 className="h-3.5 w-3.5" /> : null}
                          </span>
                        ) : null}
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
                        <span className="shrink-0 font-mono text-[10px] text-neutral-500">
                          {item.usage.length > 0
                            ? `${item.usage.length} uso${item.usage.length === 1 ? "" : "s"}`
                            : formatBytes(item.sizeBytes)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul className="flex flex-col divide-y divide-neutral-900 rounded-lg border border-neutral-900">
              {rows.map((item) => {
                const missing = missingAlt(item);
                const isPicked = picked.has(item.id);
                const folderName = folders.find((f) => f.id === item.folderId)?.name;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-pressed={selecting ? isPicked : undefined}
                      onClick={() => (selecting ? toggle(item.id) : setSelectedId(item.id))}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-neutral-900/50 ${
                        isPicked ? "bg-neutral-900" : ""
                      }`}
                    >
                      {selecting ? (
                        <span
                          aria-hidden
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            isPicked ? "border-neutral-100 bg-neutral-100 text-neutral-950" : "border-neutral-600"
                          }`}
                        >
                          {isPicked ? <BsCheck2 className="h-3 w-3" /> : null}
                        </span>
                      ) : null}
                      <span className="relative h-10 w-14 shrink-0 overflow-hidden rounded border border-neutral-800 bg-neutral-950">
                        <Image src={item.url} alt="" fill sizes="56px" className="object-cover" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm text-neutral-200">{item.text.es?.alt || "Sin describir"}</span>
                        <span className="truncate text-[11px] text-neutral-500">
                          {item.usage.length > 0 ? item.usage.map((u) => u.label).join(", ") : "Sin usar"}
                          {scope === "all" && folderName ? ` · ${folderName}` : ""}
                        </span>
                      </span>
                      {missing.length > 0 ? (
                        <span className="hidden shrink-0 font-mono text-[10px] text-amber-500 sm:inline">sin alt</span>
                      ) : null}
                      <span className="hidden w-20 shrink-0 text-right font-mono text-[11px] text-neutral-500 md:inline">
                        {item.width}×{item.height}
                      </span>
                      <span className="w-14 shrink-0 text-right font-mono text-[11px] text-neutral-500">
                        {formatBytes(item.sizeBytes)}
                      </span>
                      <span className="hidden w-20 shrink-0 text-right font-mono text-[11px] text-neutral-500 sm:inline">
                        {item.createdAt.slice(0, 10)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <Pager
            page={page}
            pages={pages}
            from={page * MEDIA_PAGE_SIZE}
            shown={rows.length}
            total={visible.length}
            label="imágenes"
            onPage={(next) => go({ page: next })}
          />
        </div>
      </div>

      {/* ---------------------------- the bulk bar ---------------------------- */}
      {selecting ? (
        <div className="sticky bottom-3 z-30 flex flex-wrap items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 shadow-lg">
          <span className="text-sm text-neutral-200">
            {picked.size} {picked.size === 1 ? "seleccionada" : "seleccionadas"}
          </span>
          <button
            type="button"
            className={ghost}
            onClick={() =>
              setPicked((current) => {
                const next = new Set(current);
                for (const id of pageIds) {
                  if (allOnPage) next.delete(id);
                  else next.add(id);
                }
                return next;
              })
            }
          >
            {allOnPage ? "Quitar esta página" : "Toda esta página"}
          </button>
          {visible.length > rows.length ? (
            <button type="button" className={ghost} onClick={() => setPicked(new Set(visible.map((i) => i.id)))}>
              Las {visible.length} del filtro
            </button>
          ) : null}
          <span className="hidden h-4 w-px bg-neutral-800 sm:block" aria-hidden />
          <select
            className={fieldBase}
            value={moveTarget}
            aria-label="Carpeta de destino"
            onChange={(e) => setMoveTarget(e.target.value)}
          >
            <option value="">Mover a…</option>
            <option value="none">Sin carpeta</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={ghost}
            disabled={pending || picked.size === 0 || moveTarget === ""}
            onClick={() =>
              run(
                () => actions.move([...picked], moveTarget === "none" ? null : moveTarget),
                () => {
                  setMoveTarget("");
                  stopSelecting();
                },
              )
            }
          >
            Mover
          </button>
          <button
            type="button"
            className={`${ghost} border-red-900/60 text-red-400`}
            disabled={pending || picked.size === 0}
            onClick={() => {
              const used = items.filter((i) => picked.has(i.id) && i.usage.length > 0).length;
              const free = picked.size - used;
              if (free === 0) {
                setResult({ ok: false, message: "Todas las seleccionadas están en uso; quítalas de ahí primero." });
                return;
              }
              const note = used > 0 ? ` ${used} en uso se quedan donde están.` : "";
              if (!confirm(`¿Mover ${free === 1 ? "1 imagen" : `${free} imágenes`} a la papelera?${note}`)) return;
              run(() => actions.trash([...picked]), stopSelecting);
            }}
          >
            A la papelera
          </button>
          <button type="button" className={`${ghost} sm:ml-auto`} onClick={stopSelecting}>
            Cancelar
          </button>
        </div>
      ) : null}

      {selected ? (
        <Details
          key={selected.id}
          item={selected}
          folders={folders}
          position={{ index: Math.max(selectedIndex, 0), total: Math.max(visible.length, 1) }}
          actions={actions}
          onClose={() => setSelectedId(null)}
          onStep={step}
          onChanged={() => router.refresh()}
          onDeleted={() => {
            setSelectedId(null);
            router.refresh();
          }}
        />
      ) : null}

      <Toast result={result} onDismiss={() => setResult(null)} />

      <input
        ref={picker}
        type="file"
        multiple
        accept={ACCEPT}
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
