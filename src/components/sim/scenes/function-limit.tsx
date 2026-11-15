"use client";

/**
 * Scene "function-limit" — limite d'une fonction en un point : ε–η.
 *
 * params (all optional, chosen by the lesson):
 *  - f:       "x2" (x² en 1, default) | "sinc" (sin x / x en 0) | "xsin" (x sin(1/x) en 0) | "floor" (partie entière en 1, pas de limite)
 *  - epsilon: number (clamped to the function's range)
 *  - l:       candidate limit, for "floor" only (default 1)
 *
 * One interaction: the ε slider. The scene answers with the largest η that works and draws the strip
 * ]a−η, a+η[ in which the curve (in green) stays inside the band ]ℓ−ε, ℓ+ε[.
 */

import { useMemo, useState } from "react";
import { Tex } from "@/components/math/md";
import { C, SimFrame } from "../two/frame";
import { Slider } from "../two/controls";
import { Axes, Clip, curvePath, Label, makeScale } from "../two/plot";
import { choiceParam, clamp, fmt, numParam } from "../two/format";

type Key = "x2" | "sinc" | "xsin" | "floor";
type Fn = {
  name: string;
  f: (x: number) => number;
  a: number;
  l: number | null;
  view: [number, number, number, number];
  eps: [number, number, number];
  /** largest η searched */
  etaMax: number;
  /** marks at x = a: filled (value f(a)) and open (missing / limit) points */
  dots: { y: number; open: boolean }[];
};
const FNS: Record<Key, Fn> = {
  x2: { name: "x² en 1", f: (x) => x * x, a: 1, l: 1, view: [-0.7, 2.4, -0.4, 3.6], eps: [0.05, 1.2, 0.5], etaMax: 1, dots: [{ y: 1, open: false }] },
  sinc: { name: "sin x / x en 0", f: (x) => (x === 0 ? NaN : Math.sin(x) / x), a: 0, l: 1, view: [-7.5, 7.5, -0.45, 1.35], eps: [0.02, 0.6, 0.2], etaMax: 5, dots: [{ y: 1, open: true }] },
  xsin: { name: "x sin(1/x) en 0", f: (x) => (x === 0 ? NaN : x * Math.sin(1 / x)), a: 0, l: 0, view: [-0.62, 0.62, -0.36, 0.36], eps: [0.01, 0.3, 0.1], etaMax: 0.5, dots: [{ y: 0, open: true }] },
  floor: {
    name: "E(x) en 1",
    f: (x) => Math.floor(x),
    a: 1,
    l: null,
    view: [-0.4, 2.6, -0.9, 2.4],
    eps: [0.05, 1.2, 0.3],
    etaMax: 0.9,
    dots: [
      { y: 1, open: false },
      { y: 0, open: true },
    ],
  },
};
const KEYS = Object.keys(FNS) as Key[];
const ETA_MIN = 0.005;

/** Largest η ≤ max such that 0 < |x − a| < η ⇒ |f(x) − ℓ| < ε (scan outwards), slightly reduced. */
function bestEta(fn: Fn, l: number, eps: number): number {
  const n = 6000;
  for (let i = 1; i <= n; i++) {
    const d = (fn.etaMax * i) / n;
    if (Math.abs(fn.f(fn.a - d) - l) >= eps || Math.abs(fn.f(fn.a + d) - l) >= eps) return ((fn.etaMax * (i - 1)) / n) * 0.98;
  }
  return fn.etaMax;
}

export default function Scene({ params }: { params?: Record<string, unknown> }) {
  const fn = FNS[choiceParam(params?.f, KEYS, "x2")];
  const l = fn.l ?? numParam(params?.l, 1, -0.5, 1.5);
  const a = fn.a;
  const [eps, setEps] = useState(() => numParam(params?.epsilon, fn.eps[2], fn.eps[0], fn.eps[1]));

  const s = useMemo(() => makeScale(...fn.view), [fn]);
  const eta = useMemo(() => bestEta(fn, l, eps), [fn, l, eps]);
  const none = eta < ETA_MIN;

  const full = useMemo(() => curvePath(s, fn.f, s.x0, s.x1, 1500), [s, fn]);
  const near = useMemo(() => (none ? "" : curvePath(s, fn.f, a - eta, a + eta, 800)), [s, fn, a, eta, none]);
  const yTop = s.sy(l + eps);
  const yBot = s.sy(l - eps);
  const xL = s.sx(a - eta);
  const xR = s.sx(a + eta);

  return (
    <SimFrame
      label={`Limite de ${fn.name} : epsilon = ${fmt(eps, 3)}, ${none ? "aucun eta ne convient" : `eta = ${fmt(eta, 3)}`}`}
      controls={
        <Slider
          label={<Tex>{"\\varepsilon"}</Tex>}
          value={eps}
          min={fn.eps[0]}
          max={fn.eps[1]}
          step={0.005}
          onChange={(v) => setEps(Math.round(clamp(v, fn.eps[0], fn.eps[1]) * 1000) / 1000)}
          display={fmt(eps, 3)}
        />
      }
      info={none ? "aucun η" : `η = ${fmt(eta, 3)}`}
    >
      <Axes s={s} grid={false} />
      <Clip s={s}>
        <rect x={s.left} y={yTop} width={s.right - s.left} height={yBot - yTop} style={{ fill: C.band }} />
        {!none && <rect x={xL} y={s.top} width={xR - xL} height={s.bottom - s.top} style={{ fill: C.blue, opacity: 0.1 }} />}
        <path d={full} fill="none" strokeWidth={2} style={{ stroke: C.ink }} opacity={0.45} />
        <path d={near} fill="none" strokeWidth={4} strokeLinecap="round" style={{ stroke: C.green }} />
        {fn.dots.map((d, i) => (
          <circle key={i} cx={s.sx(a)} cy={s.sy(d.y)} r={5.5} strokeWidth={2} style={{ fill: d.open ? "var(--card)" : C.ink, stroke: C.ink }} />
        ))}
      </Clip>
      <Label x={s.left + 8} y={s.sy(l) + 6} color={C.ink} italic>
        ℓ
      </Label>
      {!none && xR - xL > 50 && (
        <>
          <Label x={xL} y={s.bottom - 8} anchor="middle" color={C.blue} size={15} italic>
            a − η
          </Label>
          <Label x={xR} y={s.bottom - 8} anchor="middle" color={C.blue} size={15} italic>
            a + η
          </Label>
        </>
      )}
    </SimFrame>
  );
}
