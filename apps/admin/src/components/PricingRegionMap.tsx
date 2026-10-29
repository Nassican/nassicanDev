"use client";

import { useId, useRef, useState } from "react";
import type { DivipolaPlace } from "@/lib/divipola";
import {
  boundedPricingMapViewport,
  fitPricingMap,
  fullPricingMapViewport,
  pricingMapGeometry,
  pricingMapOptions,
  zoomPricingMap,
  type PricingMapEntry,
  type PricingMapViewport,
  PRICING_MAP_MAX_ZOOM,
} from "@/lib/pricing-map";
import { pricingButton, pricingField, PricingLabel } from "./PricingFields";

type ExtraZone = { value: string; label: string; detail: string; available: boolean };
export default function PricingRegionMap({
  places,
  selectedCode,
  onSelect,
  title,
  entries,
  extraZones = [],
  selectorLabel = "Departamento del mapa",
  coverageLabel = "datos locales",
  disabled = false,
  showShortcuts = false,
  municipality,
}: {
  places: DivipolaPlace[];
  selectedCode: string;
  onSelect: (code: string) => void;
  title: string;
  entries: Record<string, PricingMapEntry>;
  extraZones?: ExtraZone[];
  selectorLabel?: string;
  coverageLabel?: string;
  disabled?: boolean;
  showShortcuts?: boolean;
  municipality?: {
    value: string;
    options: { value: string; label: string }[];
    onChange: (code: string) => void;
    label: string;
    emptyText: string;
    selectedLabel?: string;
  };
}) {
  const id = useId();
  const [viewport, setViewport] = useState(fullPricingMapViewport);
  const [touchPan, setTouchPan] = useState(false);
  const drag = useRef<{
    pointer: number;
    x: number;
    y: number;
    scale: number;
    viewport: PricingMapViewport;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const departments = pricingMapOptions(places, entries);
  const withData = departments.filter((d) => d.available);
  const withoutData = departments.filter((d) => !d.available);
  const selected = departments.find((d) => d.code === selectedCode);
  const extra = extraZones.find((z) => z.value === selectedCode);
  const full = fullPricingMapViewport();
  const isFull = viewport.width >= full.width - 0.01;
  const choose = (code: string) => {
    if (!disabled && !suppressClick.current) onSelect(code);
  };
  function move(dx: number, dy: number) {
    setViewport((v) =>
      boundedPricingMapViewport({ ...v, x: v.x + dx * v.width, y: v.y + dy * v.height }),
    );
  }
  const tint = (code: string, available: boolean) =>
    selectedCode === code
      ? "fill-teal-700 dark:fill-teal-500"
      : available
        ? "fill-teal-200 hover:fill-teal-300 dark:fill-teal-900 dark:hover:fill-teal-800"
        : "fill-neutral-900 hover:fill-neutral-800";
  return (
    <div
      className="grid min-w-0 gap-4 rounded-lg border border-neutral-800 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,0.8fr)]"
      aria-busy={disabled}
    >
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2" aria-label="Controles del mapa">
          <button
            className={pricingButton}
            aria-label="Acercar mapa"
            disabled={viewport.width <= full.width / PRICING_MAP_MAX_ZOOM + 0.01}
            onClick={() => setViewport((v) => zoomPricingMap(v, 1.6))}
          >
            +
          </button>
          <button
            className={pricingButton}
            aria-label="Alejar mapa"
            disabled={isFull}
            onClick={() => setViewport((v) => zoomPricingMap(v, 1 / 1.6))}
          >
            −
          </button>
          <button className={pricingButton} onClick={() => setViewport(fullPricingMapViewport())}>
            Ver Colombia
          </button>
          <button
            className={pricingButton}
            disabled={!selected}
            onClick={() => selected && setViewport(fitPricingMap(selected.bounds))}
          >
            Acercar a selección
          </button>
          <span className="text-xs tabular-nums text-neutral-500">
            {Math.round((full.width / viewport.width) * 100)} %
          </span>
        </div>
        <svg
          viewBox={`${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`}
          className={`h-80 w-full rounded bg-neutral-950 outline-offset-2 sm:h-96 ${isFull ? "cursor-default" : "cursor-grab active:cursor-grabbing"}`}
          style={{ touchAction: touchPan ? "none" : "pan-y" }}
          role="group"
          tabIndex={0}
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-instructions`}
          onPointerDown={(e) => {
            suppressClick.current = false;
            if (disabled || (e.pointerType === "touch" && !touchPan) || e.button !== 0) return;
            const scale = e.currentTarget.getScreenCTM()?.a;
            if (scale)
              drag.current = {
                pointer: e.pointerId,
                x: e.clientX,
                y: e.clientY,
                scale,
                viewport,
                moved: false,
              };
          }}
          onPointerMove={(e) => {
            const start = drag.current;
            if (!start || start.pointer !== e.pointerId) return;
            const dx = e.clientX - start.x,
              dy = e.clientY - start.y;
            if (!start.moved && Math.hypot(dx, dy) < 5) return;
            start.moved = true;
            suppressClick.current = true;
            // Preserve normal tap targets; capture only once the gesture becomes a drag.
            if (!e.currentTarget.hasPointerCapture(e.pointerId))
              e.currentTarget.setPointerCapture(e.pointerId);
            setViewport(
              boundedPricingMapViewport({
                ...start.viewport,
                x: start.viewport.x - dx / start.scale,
                y: start.viewport.y - dy / start.scale,
              }),
            );
          }}
          onPointerUp={(e) => {
            drag.current = null;
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onPointerLeave={() => {
            if (!drag.current?.moved) drag.current = null;
          }}
          onKeyDown={(e) => {
            const arrows: Record<string, [number, number]> = {
              ArrowLeft: [-0.2, 0],
              ArrowRight: [0.2, 0],
              ArrowUp: [0, -0.2],
              ArrowDown: [0, 0.2],
            };
            const delta = arrows[e.key];
            if (delta) {
              e.preventDefault();
              move(...delta);
            }
            if (e.key === "+" || e.key === "=") {
              e.preventDefault();
              setViewport((v) => zoomPricingMap(v, 1.6));
            }
            if (e.key === "-") {
              e.preventDefault();
              setViewport((v) => zoomPricingMap(v, 1 / 1.6));
            }
            if (e.key === "Home") {
              e.preventDefault();
              setViewport(fullPricingMapViewport());
            }
          }}
        >
          {/* SVG titles need one text child to avoid SSR text separators during hydration. */}
          <title
            id={`${id}-title`}
          >{`${title}. Selecciona un departamento con clic o teclado.`}</title>
          {departments.map((d) => (
            <g
              key={d.code}
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-label={`Seleccionar ${d.name}`}
              aria-pressed={selectedCode === d.code}
              className="cursor-pointer outline-none [&:focus-visible_path]:stroke-amber-500 [&:focus-visible_path]:stroke-[3px]"
              onClick={() => choose(d.code)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (!disabled) onSelect(d.code);
                }
              }}
            >
              <title>{`${d.name}: ${entries[d.code]?.detail ?? "Sin información local"}`}</title>
              <path
                d={d.path}
                fillRule="evenodd"
                vectorEffect="non-scaling-stroke"
                className={`stroke-neutral-500 stroke-[0.7px] ${tint(d.code, d.available)}`}
              />
            </g>
          ))}
        </svg>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            className={pricingButton}
            aria-pressed={touchPan}
            onClick={() => setTouchPan((v) => !v)}
          >
            {touchPan ? "Desactivar arrastre táctil" : "Mover mapa en móvil"}
          </button>
          {!isFull ? (
            <div className="flex gap-1" aria-label="Desplazar mapa">
              <button
                className={pricingButton}
                aria-label="Mover mapa al oeste"
                onClick={() => move(-0.25, 0)}
              >
                ←
              </button>
              <button
                className={pricingButton}
                aria-label="Mover mapa al norte"
                onClick={() => move(0, -0.25)}
              >
                ↑
              </button>
              <button
                className={pricingButton}
                aria-label="Mover mapa al sur"
                onClick={() => move(0, 0.25)}
              >
                ↓
              </button>
              <button
                className={pricingButton}
                aria-label="Mover mapa al este"
                onClick={() => move(0.25, 0)}
              >
                →
              </button>
            </div>
          ) : null}
        </div>
        <p id={`${id}-instructions`} className="mt-2 text-xs text-neutral-500">
          Acerca y arrastra para explorar. También puedes usar las flechas del mapa. En móvil,
          activa el arrastre cuando lo necesites.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="Zonas pequeñas e insulares">
          {departments
            .filter((d) => d.code === "11" || d.code === "88")
            .map((d) => (
              <button
                key={d.code}
                className="flex min-w-0 items-center gap-3 rounded border border-neutral-700 p-2 text-left hover:border-neutral-500 disabled:opacity-40"
                disabled={disabled}
                aria-label={`Seleccionar ${d.code === "11" ? "Bogotá D.C." : "San Andrés y Providencia"} desde ampliación`}
                onClick={() => {
                  suppressClick.current = false;
                  onSelect(d.code);
                }}
              >
                <svg
                  viewBox={`${d.bounds[0] - 3} ${d.bounds[1] - 3} ${d.bounds[2] + 6} ${d.bounds[3] + 6}`}
                  className="h-14 w-16 shrink-0"
                  aria-hidden="true"
                >
                  <path
                    d={d.path}
                    fillRule="evenodd"
                    vectorEffect="non-scaling-stroke"
                    className={`stroke-neutral-500 stroke-[0.7px] ${tint(d.code, d.available)}`}
                  />
                </svg>
                <span className="min-w-0 text-xs">
                  <span className="block font-medium">
                    {d.code === "11" ? "Bogotá D.C." : "San Andrés y Providencia"}
                  </span>
                  <span className="mt-1 block text-neutral-500">
                    {entries[d.code]?.optionLabel ??
                      (d.available ? "Con datos locales" : "Sin datos locales")}
                  </span>
                </span>
              </button>
            ))}
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Verde: con {coverageLabel}. Gris: sin {coverageLabel}. La selección usa un tono intenso.
        </p>
      </div>
      <div
        className="order-first flex min-w-0 flex-col gap-3 lg:order-last"
        role="group"
        aria-label="Selección de zona y disponibilidad"
      >
        <h3 className="text-sm font-medium">{title}</h3>
        <PricingLabel label={selectorLabel}>
          <select
            className={pricingField}
            value={selectedCode}
            disabled={disabled}
            onChange={(e) => onSelect(e.target.value)}
          >
            <option value="">
              {extraZones.length ? "Todas las zonas" : "Todos los departamentos"}
            </option>
            {extraZones.map((z) => (
              <option key={z.value} value={z.value}>
                {z.label}
              </option>
            ))}
            <optgroup label={`Con ${coverageLabel} (${withData.length})`}>
              {withData.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.optionLabel}
                </option>
              ))}
            </optgroup>
            <optgroup label={`Sin ${coverageLabel} (${withoutData.length})`}>
              {withoutData.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.optionLabel}
                </option>
              ))}
            </optgroup>
          </select>
        </PricingLabel>
        <p className="text-xs text-neutral-500">
          {withData.length} de 33 departamentos tienen {coverageLabel} para esta vista. Los grupos
          del selector indican dónde consultar.
        </p>
        {selected && municipality ? (
          <div className="flex flex-col gap-2">
            <PricingLabel label={municipality.label}>
              <select
                className={pricingField}
                value={municipality.value}
                disabled={disabled || (!municipality.options.length && !municipality.value)}
                onChange={(e) => municipality.onChange(e.target.value)}
              >
                <option value="">Todos los municipios del departamento</option>
                {municipality.value &&
                !municipality.options.some((o) => o.value === municipality.value) ? (
                  <option value={municipality.value} disabled>
                    {`${municipality.selectedLabel ?? municipality.value}: sin comparables`}
                  </option>
                ) : null}
                {municipality.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </PricingLabel>
            <p className="text-xs text-neutral-500">
              {municipality.options.length
                ? "Las opciones corresponden solo al departamento seleccionado. El mapa conserva sus límites departamentales."
                : municipality.emptyText}
            </p>
          </div>
        ) : null}
        {showShortcuts ? (
          <div className="flex flex-wrap gap-2" aria-label="Accesos a zonas con comparables">
            {extraZones
              .filter((z) => z.available)
              .map((z) => (
                <button
                  key={z.value}
                  className={pricingButton}
                  disabled={disabled}
                  onClick={() => onSelect(z.value)}
                >
                  {z.label}
                </button>
              ))}
            {withData.slice(0, 3).map((d) => (
              <button
                key={d.code}
                className={pricingButton}
                disabled={disabled}
                onClick={() => onSelect(d.code)}
              >
                {d.optionLabel}
              </button>
            ))}
          </div>
        ) : null}
        <div className="rounded border border-neutral-800 p-3 text-sm" role="status">
          {selected
            ? `${selected.name}: ${entries[selected.code]?.detail ?? "Sin información local"}`
            : extra
              ? extra.detail
              : "Consulta la vista completa o elige una zona del grupo con datos."}
        </div>
        <p className="text-xs text-neutral-500">
          Las zonas grises también se pueden seleccionar. Su ficha explica la disponibilidad; no
          significa que estén bloqueadas en el mapa.
        </p>
        <details className="text-xs text-neutral-500">
          <summary className="cursor-pointer underline">Cartografía y licencia</summary>
          <p className="mt-2">
            Mapa generalizado de referencia, geometría de {pricingMapGeometry.referenceYear}. No
            representa precisión municipal ni límites oficiales actualizados.
          </p>
          <a
            href={pricingMapGeometry.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block underline"
          >
            {pricingMapGeometry.source}
          </a>
          <a
            href={pricingMapGeometry.licenseUrl}
            target="_blank"
            rel="noreferrer"
            className="block underline"
          >
            Datos derivados bajo {pricingMapGeometry.license}
          </a>
        </details>
      </div>
    </div>
  );
}
