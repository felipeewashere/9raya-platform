"use client";

/**
 * Scene "mean-value" — théorème de Rolle et théorème des accroissements finis (TAF).
 *
 * params (all optional, chosen by the lesson):
 *  - f: "poly" (x³ − 3x, default) | "sin" (sin x) | "sqrt" (√x) | "abs" (|x|, contre-exemple : non dérivable en 0)
 *  - a, b: endpoints (clamped to the view)
 *  - rolle: true to start with f(a) = f(b) when the function has such a pair
 *
 * Interaction: drag the two points A(a, f(a)) and B(b, f(b)) along the curve. Shows the chord [AB]
 * and, at each c ∈ ]a, b[ with f'(c) equal to its slope, the parallel tangent.
 */

import { useMemo, useState } from "react";
import { C, SimFrame } from "../two/frame";
import { Axes, Clip, curvePath, Handle, Label, makeScale } from "../two/plot";
import { choiceParam, clamp, fmt, numParam } from "../two/format";
import { zeros } from "../two/math";

type Key = "poly" | "sin" | "sqrt" | "abs";
type Fn = {
  name: string;
  f: (x: number) => number;
  d: (x: number) => number;
  view: [number, number, number, number];
  /** allowed range for a and b */
  dom: [number, number];
  ab: [number, number];
  rolle?: [number, number];
};
const R3 = Math.sqrt(3);
const FNS: Record<Key, Fn> = {
  poly: { name: "x³ − 3x", f: (x) => x ** 3 - 3 * x, d: (x) => 3 * x * x - 3, view: [-2.6, 2.6, -3.6, 3.6], dom: [-2.4, 2.4], ab: [-1.2, 2.1], rolle: [-R3, R3] },
  sin: { name: "sin x", f: Math.sin, d: Math.cos, view: [-0.8, 7.2, -1.8, 1.8], dom: [-0.6, 7], ab: [0.4, 4.2], rolle: [0, Math.PI] },
  sqrt: { name: "√x", f: (x) => (x >= 0 ? Math.sqrt(x) : NaN), d: (x) => (x > 0 ? 0.5 / Math.sqrt(x) : NaN), view: [-0.7, 9.7, -0.6, 3.6], dom: [0, 9.5], ab: [1, 9] },
  abs: { name: "|x|", f: Math.abs, d: (x) => (x === 0 ? NaN : Math.sign(x)), view: [-2.6, 2.6, -0.9, 2.8], dom: [-2.4, 2.4], ab: [-1, 2], rolle: [-1, 1] },
};
const KEYS = Object.keys(FNS) as Key[];
const SUB = "₁₂₃₄₅";

export default function Scene({ params }: { params?: Record<string, unknown> }) {
  const key = choiceParam(params?.f, KEYS, "poly");
  const fn = FNS[key];
  const start = params?.rolle === true && fn.rolle ? fn.rolle : fn.ab;
  const [a, setA] = useState(() => numParam(params?.a, start[0], fn.dom[0], fn.dom[1]));
  const [b, setB] = useState(() => numParam(params?.b, start[1], fn.dom[0], fn.dom[1]));

  const s = useMemo(() => makeScale(...fn.view), [fn]);
  const graph = useMemo(() => curvePath(s, fn.f, Math.max(s.x0, key === "sqrt" ? 0 : s.x0), s.x1, 900), [s, fn, key]);
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const fa = fn.f(lo);
  const fb = fn.f(hi);
  const tooClose = hi - lo < 0.05;
  const m = tooClose ? 0 : (fb - fa) / (hi - lo);
  const kink = key === "abs" && lo < 0 && hi > 0;
  const affine = key === "abs" && !kink;

  const cs = useMemo(() => {
    if (tooClose || kink) return [];
    if (affine) return [(lo + hi) / 2]; // f is affine on [a, b]: every c works
    const eps = (hi - lo) * 1e-4;
    return zeros((x) => fn.d(x) - m, lo + eps, hi - eps, 3000, 1e-6);
  }, [fn, m, lo, hi, tooClose, kink, affine]);

  const setX = (set: (v: number) => void) => (v: number) => set(Math.round(clamp(v, fn.dom[0], fn.dom[1]) * 100) / 100);
  const line = (x0: number, y0: number, sl: number) => `M${s.sx(s.x0)},${s.sy(y0 + sl * (s.x0 - x0))} L${s.sx(s.x1)},${s.sy(y0 + sl * (s.x1 - x0))}`;

  return (
    <SimFrame
      label={`Accroissements finis pour ${fn.name} sur [${fmt(lo)}, ${fmt(hi)}] : pente ${fmt(m, 3)}, ${cs.length} point(s) c`}
      info={tooClose ? "écartez a et b" : cs.length === 0 ? "aucun c" : `c = ${cs.map((c) => fmt(c)).join(" ; ")}`}
    >
      <Axes s={s} grid={false} />
      <Clip s={s}>
        <path d={graph} fill="none" strokeWidth={3} style={{ stroke: C.blue }} />
        {!tooClose && <line x1={s.sx(lo)} y1={s.sy(fa)} x2={s.sx(hi)} y2={s.sy(fb)} strokeWidth={3} style={{ stroke: C.orange }} />}
        {!affine &&
          cs.map((c, i) => (
            <g key={i}>
              <path d={line(c, fn.f(c), fn.d(c))} strokeWidth={2.2} strokeDasharray="9 6" style={{ stroke: C.green }} />
              <circle cx={s.sx(c)} cy={s.sy(fn.f(c))} r={6} strokeWidth={2} style={{ fill: C.green, stroke: "var(--card)" }} />
            </g>
          ))}
      </Clip>
      {!affine &&
        cs.map((c, i) => (
          <Label key={i} x={s.sx(c)} y={s.sy(fn.f(c)) + (fn.f(c) >= 0 ? -14 : 28)} anchor="middle" color={C.green} italic>
            {`c${cs.length > 1 ? SUB[i] ?? "" : ""}`}
          </Label>
        ))}
      <Label x={s.sx(a) - 10} y={s.sy(fn.f(a)) - 14} anchor="end" color={C.orange} italic>
        {a <= b ? "A" : "B"}
      </Label>
      <Label x={s.sx(b) + 12} y={s.sy(fn.f(b)) - 14} color={C.orange} italic>
        {a <= b ? "B" : "A"}
      </Label>
      <Handle x={s.sx(a)} y={s.sy(fn.f(a))} color={C.orange} label="point d'abscisse a" onDrag={(p) => setX(setA)(s.ix(p.x))} />
      <Handle x={s.sx(b)} y={s.sy(fn.f(b))} color={C.orange} label="point d'abscisse b" onDrag={(p) => setX(setB)(s.ix(p.x))} />
    </SimFrame>
  );
}
