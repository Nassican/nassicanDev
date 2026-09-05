"use client";

import { useId, useMemo, useState } from "react";
import type { DailyPoint } from "@/lib/analytics-summary";

/**
 * Daily users over the selected range.
 *
 * One series, so no legend: the heading names it. The colour is the reference
 * palette's dark categorical slot 1, checked against this panel's `#0a0a0a`
 * surface - lightness band, chroma floor and 3:1 contrast all pass.
 */
const SERIES = "#3987e5";
const GRID = "#2c2c2a";
const AXIS = "#383835";
const MUTED = "#898781";

const PAD = { top: 12, right: 12, bottom: 22, left: 34 };
const W = 720;
const H = 200;

function niceCeiling(value: number): number {
  if (value <= 5) return 5;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

export default function VisitsChart({ data }: { data: DailyPoint[] }) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const { points, max, path, area } = useMemo(() => {
    const max = niceCeiling(Math.max(1, ...data.map((d) => d.users)));
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;

    const points = data.map((d, i) => ({
      ...d,
      x:
        PAD.left +
        (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW),
      y: PAD.top + innerH - (d.users / max) * innerH,
    }));

    const path = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ");

    const baseline = PAD.top + innerH;
    const area =
      points.length > 0
        ? `${path} L${points[points.length - 1].x.toFixed(1)},${baseline} L${points[0].x.toFixed(1)},${baseline} Z`
        : "";

    return { points, max, path, area };
  }, [data]);

  if (data.length === 0) return null;

  const ticks = [0, max / 2, max];
  const active = hover !== null ? points[hover] : null;

  return (
    <figure className="flex flex-col gap-1.5">
      <figcaption className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">
        Usuarios por día
      </figcaption>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Usuarios por día entre ${data[0].date} y ${data[data.length - 1].date}`}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            const x = ((e.clientX - box.left) / box.width) * W;
            let nearest = 0;
            for (let i = 1; i < points.length; i += 1) {
              if (Math.abs(points[i].x - x) < Math.abs(points[nearest].x - x)) {
                nearest = i;
              }
            }
            setHover(nearest);
          }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES} stopOpacity="0.28" />
              <stop offset="100%" stopColor={SERIES} stopOpacity="0" />
            </linearGradient>
          </defs>

          {ticks.map((value) => {
            const y = PAD.top + (H - PAD.top - PAD.bottom) * (1 - value / max);
            return (
              <g key={value}>
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={y}
                  y2={y}
                  stroke={value === 0 ? AXIS : GRID}
                  strokeWidth="1"
                />
                <text
                  x={PAD.left - 6}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9"
                  fill={MUTED}
                >
                  {Math.round(value)}
                </text>
              </g>
            );
          })}

          <path d={area} fill={`url(#${gradientId})`} />
          <path
            d={path}
            fill="none"
            stroke={SERIES}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {active ? (
            <>
              <line
                x1={active.x}
                x2={active.x}
                y1={PAD.top}
                y2={H - PAD.bottom}
                stroke={AXIS}
                strokeWidth="1"
              />
              <circle
                cx={active.x}
                cy={active.y}
                r="4.5"
                fill={SERIES}
                stroke="#0a0a0a"
                strokeWidth="2"
              />
            </>
          ) : null}

          {[0, Math.floor(data.length / 2), data.length - 1]
            .filter((i, k, all) => all.indexOf(i) === k && points[i])
            .map((i) => (
              <text
                key={i}
                x={points[i].x}
                y={H - 7}
                textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
                fontSize="9"
                fill={MUTED}
              >
                {points[i].date.slice(5)}
              </text>
            ))}
        </svg>

        {active ? (
          <div
            className="pointer-events-none absolute -translate-x-1/2 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-[11px] whitespace-nowrap"
            style={{
              left: `${(active.x / W) * 100}%`,
              top: `${(active.y / H) * 100}%`,
              transform: "translate(-50%, -130%)",
            }}
          >
            <span className="text-neutral-500">{active.date}</span>{" "}
            <span className="font-medium tabular-nums">{active.users}</span>{" "}
            <span className="text-neutral-500">usuarios ·</span>{" "}
            <span className="tabular-nums">{active.sessions}</span>{" "}
            <span className="text-neutral-500">sesiones</span>
          </div>
        ) : null}
      </div>
    </figure>
  );
}
