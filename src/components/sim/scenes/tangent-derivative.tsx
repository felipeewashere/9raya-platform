"use client";

/**
 * Scene "tangent-derivative" — nombre dérivé : la sécante (AM) tend vers la tangente quand h → 0.
 *
 * params (all optional, chosen by the lesson):
 *  - f: "x2" (x², default) | "cube" (x³ − 2x) | "sin" (sin x) | "exp" (eˣ) | "abs" (|x|, non dérivable en 0)
 *  - a: number (abscissa of A, clamped to the view)
 *  - h: number in [−2, 2] (default 1.5)
 *
 * One interaction: drag M along the curve, plus an "h → 0" button (instant with reduced motion).
 * Shows the curve, the tangent at A, the secant (AM) and its slope.
 */

import { useMemo, useState } from "react";
import { C, SimFrame } from "../two/frame";
import { Btn } from "../two/controls";
import { Axes, Clip, curvePath, Handle, Label, makeScale } from "../two/plot";
import { choiceParam, clamp, fmt, numParam } from "../two/format";
import { useTween } from "../two/use-animate";

type Key = "x2" | "cube" | "sin" | "exp" | "abs";
type Fn = {
  name: string;
  f: (x: number) => number;
  /** derivative, or null where f is not differentiable */
  d: (x: number) => number | null;
  view: [number, number, number, number];
  a: number;
};
const FNS: Record<Key, Fn> = {
  x2: { name: "x²", f: (x) => x * x, d: (x) => 2 * x, view: [-2.6, 2.9, -1.2, 5.5], a: 1 },
  cube: { name: "x³ − 2x", f: (x) => x ** 3 - 2 * x, d: (x) => 3 * x * x - 2, view: [-2.6, 2.6, -3.4, 3.4], a: 1 },
  sin: { name: "sin x", f: Math.sin, d: Math.cos, view: [-3.6, 4.4, -2.1, 2.1], a: 0.6 },
  exp: { name: "eˣ", f: Math.exp, d: Math.exp, view: [-3, 2.4, -0.8, 5.6], a: 0 },
  abs: { name: "|x|", f: Math.abs, d: (x) => (Math.abs(x) < 1e-9 ? null : Math.sign(x)), view: [-2.6, 2.6, -0.9, 2.6], a: 0 },
};
const KEYS = Object.keys(FNS) as Key[];
const H_MIN = 0.01; // M never sits exactly on A, so the slope stays defined

export default function Scene({ params }: { params?: Record<string, unknown> }) {
  const fn = FNS[choiceParam(params?.f, KEYS, "x2")];
  const a = numParam(params?.a, fn.a, fn.view[0] + 0.3, fn.view[1] - 0.3);
  // start with M visible: h = 1.5, or 1 when f(a + 1.5) is off the view
  const [h, setH] = useState(() => {
    const y = fn.f(a + 1.5);
    return numParam(params?.h, y > fn.view[2] && y < fn.view[3] && a + 1.5 < fn.view[1] ? 1.5 : 1, -2, 2);
  });
  const [tween, stop] = useTween();

  const s = useMemo(() => makeScale(...fn.view), [fn]);
  const graph = useMemo(() => curvePath(s, fn.f), [s, fn]);

  const hh = Math.abs(h) < H_MIN ? (h < 0 ? -H_MIN : H_MIN) : h;
  const fa = fn.f(a);
  const xm = a + hh;
  const fm = fn.f(xm);
  const slope = (fm - fa) / hh;
  const da = fn.d(a);
  // a line through (x0, y0) with slope m, across the view
  const line = (x0: number, y0: number, m: number) => `M${s.sx(s.x0)},${s.sy(y0 + m * (s.x0 - x0))} L${s.sx(s.x1)},${s.sy(y0 + m * (s.x1 - x0))}`;

  const dragM = (x: number) => {
    stop();
    const v = clamp(x - a, -2, 2);
    const y = fn.f(a + v);
    if (!(y > fn.view[2] && y < fn.view[3])) return; // keep M inside the figure
    setH(Math.round((Math.abs(v) < H_MIN ? (v < 0 ? -H_MIN : H_MIN) : v) * 1000) / 1000);
  };

  return (
    <SimFrame
      label={`Sécante et tangente pour ${fn.name} en a = ${fmt(a)}, h = ${fmt(hh, 3)}, pente ${fmt(slope)}`}
      controls={<Btn onClick={() => tween(h, h < 0 ? -H_MIN : H_MIN, (v) => setH(v), { duration: 2.4 })}><span className="normal-case italic">h</span> → 0</Btn>}
      info={`pente = ${fmt(slope)}`}
    >
      <Axes s={s} grid={false} />
      <Clip s={s}>
        <path d={graph} fill="none" strokeWidth={3} style={{ stroke: C.blue }} />
        {da !== null && <path d={line(a, fa, da)} strokeWidth={2.2} strokeDasharray="9 6" style={{ stroke: C.green }} />}
        <path d={line(a, fa, slope)} strokeWidth={2.4} style={{ stroke: C.orange }} />
        <circle cx={s.sx(a)} cy={s.sy(fa)} r={6} strokeWidth={2} style={{ fill: C.blue, stroke: "var(--card)" }} />
      </Clip>
      <Label x={s.sx(a) - 10} y={s.sy(fa) - 14} anchor="end" color={C.blue} italic>
        A
      </Label>
      {Math.abs(s.sx(xm) - s.sx(a)) > 24 && (
        <Label x={s.sx(xm) + 12} y={s.sy(fm) - 12} color={C.orange} italic>
          M
        </Label>
      )}
      {da !== null && (
        <Label x={s.right - 8} y={s.top + 20} anchor="end" color={C.green}>
          tangente
        </Label>
      )}
      <Handle x={s.sx(xm)} y={s.sy(fm)} color={C.orange} label="point M de la courbe" onDrag={(p) => dragM(s.ix(p.x))} />
    </SimFrame>
  );
}
