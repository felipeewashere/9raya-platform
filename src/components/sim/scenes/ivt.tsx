"use client";

/**
 * Scene "ivt" — théorème des valeurs intermédiaires.
 *
 * params (all optional, chosen by the lesson):
 *  - f: "cubic" (x³ − 3x + 1, default) | "square" (x²) | "jump" (fonction discontinue en 1, contre-exemple)
 *  - a, b: endpoints (clamped to the view, a < b)
 *  - y: the starting level k (default between f(a) and f(b))
 *
 * One interaction: drag the level k on the y-axis. Highlights [f(a), f(b)] and marks every
 * c ∈ [a, b] with f(c) = k; the result line gives the c found.
 */

import { useMemo, useState } from "react";
import { C, SimFrame } from "../two/frame";
import { Axes, Clip, curvePath, Handle, Label, makeScale } from "../two/plot";
import { choiceParam, clamp, fmt, numParam } from "../two/format";
import { zeros } from "../two/math";

type Key = "cubic" | "square" | "jump";
type Fn = {
  name: string;
  f: (x: number) => number;
  view: [number, number, number, number];
  ab: [number, number];
  k: number;
  /** discontinuity, if any: x and the (filled, open) values there */
  jump?: { x: number; filled: number; open: number };
};
const FNS: Record<Key, Fn> = {
  cubic: { name: "x³ − 3x + 1", f: (x) => x ** 3 - 3 * x + 1, view: [-2.5, 2.5, -2.6, 4.2], ab: [-2, 2], k: 1.6 },
  square: { name: "x²", f: (x) => x * x, view: [-2.2, 2.6, -0.8, 4.6], ab: [-1, 2], k: 2 },
  jump: { name: "discontinue", f: (x) => (x < 1 ? x / 2 : x / 2 + 1), view: [-0.5, 2.6, -0.5, 2.6], ab: [0, 2], k: 1, jump: { x: 1, filled: 1.5, open: 0.5 } },
};
const KEYS = Object.keys(FNS) as Key[];

export default function Scene({ params }: { params?: Record<string, unknown> }) {
  const fn = FNS[choiceParam(params?.f, KEYS, "cubic")];
  const v = fn.view;
  const a0 = numParam(params?.a, fn.ab[0], v[0] + 0.1, v[1] - 0.2);
  const b0 = numParam(params?.b, fn.ab[1], v[0] + 0.2, v[1] - 0.1);
  const lo = Math.min(a0, b0);
  const hi = Math.max(a0, b0);
  const [k, setK] = useState(() => numParam(params?.y, fn.k, v[2], v[3]));

  const s = useMemo(() => makeScale(...v), [v]);
  const fa = fn.f(lo);
  const fb = fn.f(hi);
  const cs = useMemo(() => zeros((x) => fn.f(x) - k, lo, hi, 3000, 1e-6), [fn, k, lo, hi]);

  const graph = useMemo(() => curvePath(s, fn.f, s.x0, s.x1, 1000), [s, fn]);
  const arc = useMemo(() => curvePath(s, fn.f, lo, hi, 600), [s, fn, lo, hi]);
  const yAxisX = clamp(s.sx(0), s.left, s.right);
  const yLo = s.sy(Math.min(fa, fb));
  const yHi = s.sy(Math.max(fa, fb));

  return (
    <SimFrame
      label={`Valeurs intermédiaires pour ${fn.name} sur [${fmt(lo)}, ${fmt(hi)}], niveau ${fmt(k)} : ${cs.length} solution(s)`}
      info={cs.length === 0 ? "aucun c" : `c = ${cs.map((c) => fmt(c)).join(" ; ")}`}
    >
      <Axes s={s} grid={false} />
      <Clip s={s}>
        {/* [f(a), f(b)] */}
        <rect x={s.left} y={yHi} width={s.right - s.left} height={yLo - yHi} style={{ fill: C.band }} />
        <path d={graph} fill="none" strokeWidth={1.6} style={{ stroke: C.ink }} opacity={0.3} />
        <path d={arc} fill="none" strokeWidth={3.2} style={{ stroke: C.blue }} />
        {fn.jump && (
          <>
            <circle cx={s.sx(fn.jump.x)} cy={s.sy(fn.jump.filled)} r={5} style={{ fill: C.blue }} />
            <circle cx={s.sx(fn.jump.x)} cy={s.sy(fn.jump.open)} r={5} strokeWidth={2} style={{ fill: "var(--card)", stroke: C.blue }} />
          </>
        )}
        <circle cx={s.sx(lo)} cy={s.sy(fa)} r={5} style={{ fill: C.blue }} />
        <circle cx={s.sx(hi)} cy={s.sy(fb)} r={5} style={{ fill: C.blue }} />
        <line x1={s.left} x2={s.right} y1={s.sy(k)} y2={s.sy(k)} strokeWidth={2.2} style={{ stroke: C.orange }} />
        {cs.map((c, i) => (
          <g key={i}>
            <line x1={s.sx(c)} x2={s.sx(c)} y1={s.sy(k)} y2={s.sy(0)} strokeWidth={1.6} strokeDasharray="5 4" style={{ stroke: C.green }} />
            <circle cx={s.sx(c)} cy={s.sy(k)} r={6.5} strokeWidth={2} style={{ fill: C.green, stroke: "var(--card)" }} />
          </g>
        ))}
      </Clip>
      <Label x={s.right - 6} y={s.sy(k) - 8} anchor="end" color={C.orange} italic>
        y = k
      </Label>
      <Label x={s.sx(lo) - 10} y={s.sy(fa) + 6} anchor="end" color={C.blue} italic>
        f(a)
      </Label>
      <Label x={s.sx(hi) + 10} y={s.sy(fb) + 6} color={C.blue} italic>
        f(b)
      </Label>
      <Handle x={yAxisX} y={s.sy(k)} color={C.orange} label="niveau k" onDrag={(p) => setK(Math.round(clamp(s.iy(p.y), v[2], v[3]) * 100) / 100)} />
    </SimFrame>
  );
}
