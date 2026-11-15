"use client";

/**
 * Scene "linear-map-2d" — application linéaire du plan : une matrice 2×2 déforme la grille.
 *
 * params (all optional, chosen by the lesson):
 *  - preset: "identity" | "rotation" (default) | "shear" | "projection" | "reflection" | "scaling"
 *  - theta:  rotation angle in degrees, for "rotation" (default 45)
 *  - matrix: [[a, b], [c, d]] or [a, b, c, d] (entries clamped to [−2, 2]); overrides preset
 *
 * Interaction: drag the tips of f(e₁) = (a, c) and f(e₂) = (b, d) — the columns of the matrix —
 * plus an "Animer" button (identity → matrix, instant with reduced motion). Shows the original and
 * deformed grids and the image of the unit square; the result line gives the matrix and its det.
 */

import { useMemo, useState } from "react";
import { Tex } from "@/components/math/md";
import { C, SimFrame } from "../two/frame";
import { Btn } from "../two/controls";
import { Clip, Handle, Label, makeScale } from "../two/plot";
import { choiceParam, clamp, fmt, numParam, tnum } from "../two/format";
import { useTween } from "../two/use-animate";

type Preset = "identity" | "rotation" | "shear" | "projection" | "reflection" | "scaling";
type M4 = [number, number, number, number]; // a b / c d
const PRESETS: Record<Exclude<Preset, "rotation">, M4> = {
  identity: [1, 0, 0, 1],
  shear: [1, 1, 0, 1],
  projection: [1, 0, 0, 0],
  reflection: [0, 1, 1, 0],
  scaling: [1.5, 0, 0, 1.5],
};
const NAMES: Preset[] = ["identity", "rotation", "shear", "projection", "reflection", "scaling"];
const rot = (deg: number): M4 => {
  const t = (deg * Math.PI) / 180;
  const c = Math.round(Math.cos(t) * 1e6) / 1e6;
  const s = Math.round(Math.sin(t) * 1e6) / 1e6;
  return [c, -s, s, c];
};
const clampE = (v: number) => clamp(v, -2, 2);
/** Dragged entries snap to tenths, so integer matrices are easy to reach. */
const snap = (v: number) => Math.round(clampE(v) * 10) / 10;

function parseMatrix(v: unknown): M4 | null {
  const flat = Array.isArray(v) ? v.flat() : null;
  if (!flat || flat.length !== 4 || !flat.every((x) => typeof x === "number" && Number.isFinite(x))) return null;
  return (flat as number[]).map(clampE) as M4;
}

export default function Scene({ params }: { params?: Record<string, unknown> }) {
  const preset = choiceParam(params?.preset, NAMES, "rotation");
  const theta = numParam(params?.theta, 45, -180, 180);
  const [m, setM] = useState<M4>(() => parseMatrix(params?.matrix) ?? (preset === "rotation" ? rot(theta) : PRESETS[preset]));
  const [t, setT] = useState(1); // animation progress identity → m
  const [tween, stop] = useTween();

  const s = useMemo(() => makeScale(-5, 5, 0, 0, { equal: true, margin: 14 }), []);
  const [a, b, c, d] = t >= 1 ? m : ([1 + (m[0] - 1) * t, m[1] * t, m[2] * t, 1 + (m[3] - 1) * t] as M4);
  const det = m[0] * m[3] - m[1] * m[2];
  const map = (x: number, y: number) => [s.sx(a * x + b * y), s.sy(c * x + d * y)] as const;
  const P = (x: number, y: number) => map(x, y).map((v) => v.toFixed(2)).join(",");

  const setCol = (j: 0 | 1, x: number, y: number) => {
    stop();
    setT(1);
    setM((old) => (j === 0 ? [snap(x), old[1], snap(y), old[3]] : [old[0], snap(x), old[2], snap(y)]));
  };

  const R = 8;
  const range = Array.from({ length: 2 * R + 1 }, (_, i) => i - R);
  const arrow = (x: number, y: number, color: string) => {
    const [x1, y1] = map(x, y);
    const [x0, y0] = map(0, 0);
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 2) return null;
    const ux = (x1 - x0) / len;
    const uy = (y1 - y0) / len;
    const hx = x1 - ux * 14;
    const hy = y1 - uy * 14;
    return (
      <g style={{ stroke: color, fill: color }}>
        <line x1={x0} y1={y0} x2={hx} y2={hy} strokeWidth={3.5} />
        <path d={`M${x1},${y1} L${hx - uy * 7},${hy + ux * 7} L${hx + uy * 7},${hy - ux * 7} Z`} strokeWidth={1} />
      </g>
    );
  };

  return (
    <SimFrame
      label={`Application linéaire de matrice (${fmt(m[0])}, ${fmt(m[1])} ; ${fmt(m[2])}, ${fmt(m[3])}), déterminant ${fmt(det)}`}
      controls={<Btn onClick={() => tween(0, 1, setT, { duration: 1.6 })}>Animer</Btn>}
      info={<Tex>{`A=\\begin{pmatrix}${tnum(m[0])}&${tnum(m[1])}\\\\${tnum(m[2])}&${tnum(m[3])}\\end{pmatrix},\\ \\det A=${tnum(det)}`}</Tex>}
    >
      <Clip s={s}>
        {/* original grid */}
        <g style={{ stroke: C.ink }} strokeWidth={1} opacity={0.1}>
          {range.map((k) => (
            <g key={k}>
              <line x1={s.sx(k)} x2={s.sx(k)} y1={s.top} y2={s.bottom} />
              <line y1={s.sy(k)} y2={s.sy(k)} x1={s.left} x2={s.right} />
            </g>
          ))}
        </g>
        <g style={{ stroke: C.ink }} strokeWidth={1.2} opacity={0.35}>
          <line x1={s.left} x2={s.right} y1={s.sy(0)} y2={s.sy(0)} />
          <line x1={s.sx(0)} x2={s.sx(0)} y1={s.top} y2={s.bottom} />
        </g>
        {/* deformed grid */}
        <g style={{ stroke: C.blue }} strokeWidth={1.2} opacity={0.45}>
          {range.map((k) => (
            <g key={k}>
              <line x1={map(k, -30)[0]} y1={map(k, -30)[1]} x2={map(k, 30)[0]} y2={map(k, 30)[1]} />
              <line x1={map(-30, k)[0]} y1={map(-30, k)[1]} x2={map(30, k)[0]} y2={map(30, k)[1]} />
            </g>
          ))}
        </g>
        {/* image of the unit square */}
        <polygon points={`${P(0, 0)} ${P(1, 0)} ${P(1, 1)} ${P(0, 1)}`} strokeWidth={2} style={{ fill: C.blue, fillOpacity: 0.22, stroke: C.blue }} />
        {arrow(1, 0, C.orange)}
        {arrow(0, 1, C.green)}
      </Clip>
      <Label x={map(1, 0)[0] + 12} y={map(1, 0)[1] + 22} color={C.orange} italic>
        f(e₁)
      </Label>
      <Label x={map(0, 1)[0] + 12} y={map(0, 1)[1] - 10} color={C.green} italic>
        f(e₂)
      </Label>
      {t >= 1 && (
        <>
          <Handle x={map(1, 0)[0]} y={map(1, 0)[1]} color={C.orange} label="extrémité de f(e1), première colonne" onDrag={(p) => setCol(0, s.ix(p.x), s.iy(p.y))} />
          <Handle x={map(0, 1)[0]} y={map(0, 1)[1]} color={C.green} label="extrémité de f(e2), seconde colonne" onDrag={(p) => setCol(1, s.ix(p.x), s.iy(p.y))} />
        </>
      )}
    </SimFrame>
  );
}
