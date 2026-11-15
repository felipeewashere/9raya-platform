"use client";

import { useId, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { C, H, W } from "./frame";
import { fmt } from "./format";

/** Maps math coordinates to viewBox coordinates (y up). */
export type Scale = {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** viewBox x of math x */
  sx: (x: number) => number;
  /** viewBox y of math y */
  sy: (y: number) => number;
  /** math x of viewBox x */
  ix: (px: number) => number;
  /** math y of viewBox y */
  iy: (py: number) => number;
  /** plot rectangle in viewBox units */
  left: number;
  right: number;
  top: number;
  bottom: number;
};

/** A linear scale filling the viewBox minus `margin`. Pass `equal` to keep 1:1 units (y range recomputed, centred). */
export function makeScale(x0: number, x1: number, y0: number, y1: number, opts: { margin?: number; equal?: boolean } = {}): Scale {
  const m = opts.margin ?? 22;
  const left = m;
  const right = W - m;
  const top = m;
  const bottom = H - m;
  if (opts.equal) {
    const k = (right - left) / (x1 - x0);
    const mid = (y0 + y1) / 2;
    const half = (bottom - top) / k / 2;
    y0 = mid - half;
    y1 = mid + half;
  }
  const kx = (right - left) / (x1 - x0);
  const ky = (bottom - top) / (y1 - y0);
  return {
    x0,
    x1,
    y0,
    y1,
    left,
    right,
    top,
    bottom,
    sx: (x) => left + (x - x0) * kx,
    sy: (y) => bottom - (y - y0) * ky,
    ix: (px) => x0 + (px - left) / kx,
    iy: (py) => y0 + (bottom - py) / ky,
  };
}

/** 1, 2 or 5 × 10^k, about `target` ticks over `range`. */
export function niceStep(range: number, target = 8) {
  const raw = range / target;
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
}

/** Decimals needed to write multiples of `step` exactly (0.25 → 2). */
export function decimals(step: number) {
  for (let d = 0; d < 6; d++) if (Math.abs(Math.round(step * 10 ** d) - step * 10 ** d) < 1e-7) return d;
  return 6;
}

function ticks(a: number, b: number, step: number) {
  const out: number[] = [];
  const start = Math.ceil(a / step - 1e-9);
  for (let i = start; i * step <= b + 1e-9; i++) out.push(i === 0 ? 0 : i * step);
  return out;
}

/**
 * Grid, axes (through 0, or along the edge when 0 is off-screen) and tick labels.
 * `xStep`/`yStep` override the automatic spacing; `xLabel`/`yLabel` name the axes.
 */
export function Axes({
  s,
  xStep,
  yStep,
  xLabel = "x",
  yLabel = "y",
  xFormat,
  yFormat,
  grid = true,
}: {
  s: Scale;
  xStep?: number;
  yStep?: number;
  xLabel?: string;
  yLabel?: string;
  xFormat?: (x: number) => string;
  yFormat?: (y: number) => string;
  grid?: boolean;
}) {
  const dx = xStep ?? niceStep(s.x1 - s.x0);
  const dy = yStep ?? niceStep(s.y1 - s.y0, 6);
  const xs = ticks(s.x0, s.x1, dx);
  const ys = ticks(s.y0, s.y1, dy);
  const decX = decimals(dx);
  const decY = decimals(dy);
  const ax = s.sy(Math.min(Math.max(0, s.y0), s.y1)); // viewBox y of the x-axis
  const ay = s.sx(Math.min(Math.max(0, s.x0), s.x1)); // viewBox x of the y-axis
  const fx = xFormat ?? ((x: number) => fmt(x, decX));
  const fy = yFormat ?? ((y: number) => fmt(y, decY));
  const below = ax + 18 > s.bottom + 10 ? ax - 8 : ax + 18;
  return (
    <g aria-hidden>
      {grid && (
        <g style={{ stroke: C.ink, opacity: 0.1 }} strokeWidth={1}>
          {xs.map((x) => (
            <line key={`gx${x}`} x1={s.sx(x)} x2={s.sx(x)} y1={s.top} y2={s.bottom} />
          ))}
          {ys.map((y) => (
            <line key={`gy${y}`} y1={s.sy(y)} y2={s.sy(y)} x1={s.left} x2={s.right} />
          ))}
        </g>
      )}
      <g style={{ stroke: C.ink }} strokeWidth={1.5}>
        <line x1={s.left} x2={s.right + 6} y1={ax} y2={ax} />
        <line x1={ay} x2={ay} y1={s.bottom} y2={s.top - 6} />
      </g>
      <path d={`M${s.right + 14},${ax} l-10,-5 v10 z M${ay},${s.top - 14} l-5,10 h10 z`} style={{ fill: C.ink }} />
      <g style={{ fill: C.ink, opacity: 0.7 }} fontSize={14}>
        {xs.map((x) =>
          x === 0 || s.sx(x) > s.right - 20 ? null : (
            <text key={`tx${x}`} x={s.sx(x)} y={below} textAnchor="middle">
              {fx(x)}
            </text>
          ),
        )}
        {ys.map((y) =>
          y === 0 || s.sy(y) < s.top + 14 ? null : (
            <text key={`ty${y}`} x={ay - 6} y={s.sy(y) + 5} textAnchor="end">
              {fy(y)}
            </text>
          ),
        )}
        {s.x0 <= 0 && s.y0 <= 0 && (
          <text x={ay - 6} y={below} textAnchor="end">
            0
          </text>
        )}
      </g>
      <g style={{ fill: C.ink }} fontSize={17} fontStyle="italic" fontFamily="KaTeX_Main, 'Times New Roman', serif">
        <text x={s.right + 4} y={ax - 10} textAnchor="end">
          {xLabel}
        </text>
        <text x={ay + 12} y={s.top + 2}>
          {yLabel}
        </text>
      </g>
    </g>
  );
}

/**
 * Path of y = f(x) on [a, b] (defaults to the visible range), broken where f is undefined,
 * off-scale or jumps (a discontinuity is not joined by a vertical segment).
 */
export function curvePath(s: Scale, f: (x: number) => number, a = s.x0, b = s.x1, n = 600): string {
  let d = "";
  let pen = false;
  let prevY = 0;
  const big = (s.bottom - s.top) * 4;
  const jump = (s.bottom - s.top) * 0.3;
  for (let i = 0; i <= n; i++) {
    const x = a + ((b - a) * i) / n;
    const y = f(x);
    const py = s.sy(y);
    if (!Number.isFinite(y) || Math.abs(py) > big) {
      pen = false;
      continue;
    }
    if (pen && Math.abs(py - prevY) > jump) pen = false;
    d += `${pen ? "L" : "M"}${s.sx(x).toFixed(2)},${py.toFixed(2)}`;
    pen = true;
    prevY = py;
  }
  return d;
}

/** Clips its children to the plot rectangle. */
export function Clip({ s, children }: { s: Scale; children: ReactNode }) {
  const id = "clip" + useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <>
      <clipPath id={id}>
        <rect x={s.left} y={s.top} width={s.right - s.left} height={s.bottom - s.top} />
      </clipPath>
      <g clipPath={`url(#${id})`}>{children}</g>
    </>
  );
}

/** viewBox coordinates of a pointer event. */
function svgPoint(e: PointerEvent<SVGElement>) {
  const svg = e.currentTarget.ownerSVGElement;
  const m = svg?.getScreenCTM();
  if (!m) return null;
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
  return { x: p.x, y: p.y };
}

/**
 * A draggable point (mouse, touch, pen and arrow keys). Position and callback are in viewBox units;
 * the scene converts with its Scale and constrains the motion itself.
 */
export function Handle({
  x,
  y,
  onDrag,
  color = C.blue,
  label,
  r = 8,
}: {
  x: number;
  y: number;
  onDrag: (p: { x: number; y: number }) => void;
  color?: string;
  /** Accessible name (e.g. "point a"). */
  label: string;
  r?: number;
}) {
  const down = (e: PointerEvent<SVGGElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus({ preventScroll: true });
  };
  const move = (e: PointerEvent<SVGGElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const p = svgPoint(e);
    if (p) onDrag(p);
  };
  const key = (e: KeyboardEvent<SVGGElement>) => {
    const d = e.shiftKey ? 20 : 4;
    const k: Record<string, [number, number]> = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] };
    const v = k[e.key];
    if (!v) return;
    e.preventDefault();
    onDrag({ x: x + v[0], y: y + v[1] });
  };
  return (
    <g
      role="button"
      aria-label={`${label} (déplaçable, flèches du clavier)`}
      tabIndex={0}
      onPointerDown={down}
      onPointerMove={move}
      onKeyDown={key}
      className="group cursor-grab outline-none active:cursor-grabbing"
      style={{ touchAction: "none" }}
    >
      <circle cx={x} cy={y} r={24} fill="transparent" />
      <circle cx={x} cy={y} r={r + 6} className="opacity-20 group-hover:opacity-35 group-focus-visible:opacity-50" style={{ fill: color }} />
      <circle cx={x} cy={y} r={r} strokeWidth={2.5} style={{ fill: color, stroke: "var(--card)" }} />
    </g>
  );
}

/** A label in the figure, with a halo so it stays readable over lines. */
export function Label({
  x,
  y,
  children,
  color = C.ink,
  anchor = "start",
  size = 17,
  italic = false,
}: {
  x: number;
  y: number;
  children: ReactNode;
  color?: string;
  anchor?: "start" | "middle" | "end";
  size?: number;
  italic?: boolean;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={size}
      fontStyle={italic ? "italic" : undefined}
      fontFamily={italic ? "KaTeX_Main, 'Times New Roman', serif" : undefined}
      paintOrder="stroke"
      strokeWidth={5}
      strokeLinejoin="round"
      style={{ fill: color, stroke: "var(--card)" }}
    >
      {children}
    </text>
  );
}
