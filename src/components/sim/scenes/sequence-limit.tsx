"use client";

/**
 * Scene "sequence-limit" — limite d'une suite : bande ε autour de ℓ et rang N.
 *
 * params (all optional, chosen by the lesson):
 *  - sequence: "inv" (1/n, default) | "alt" ((−1)^n/n) | "frac" ((n+1)/n) | "sin" (sin n / n) | "div" ((−1)^n, divergente)
 *  - epsilon:  number in [0.02, 0.6] (default 0.2)
 *  - l:        candidate limit for "div" only, in [−1.5, 1.5] (default 0)
 *
 * One interaction: the ε slider, plus an "ε → 0" button.
 * Shows the band ]ℓ−ε, ℓ+ε[, the terms (orange when outside the band) and the rank N.
 */

import { useMemo, useState } from "react";
import { Tex } from "@/components/math/md";
import { C, SimFrame } from "../two/frame";
import { Btn, Slider } from "../two/controls";
import { Axes, Clip, Label, makeScale } from "../two/plot";
import { choiceParam, clamp, fmt, numParam } from "../two/format";
import { useTween } from "../two/use-animate";

type Key = "inv" | "alt" | "frac" | "sin" | "div";
const SEQS: Record<Key, { name: string; u: (n: number) => number; l: number | null; y: [number, number] }> = {
  inv: { name: "1/n", u: (n) => 1 / n, l: 0, y: [-0.35, 1.1] },
  alt: { name: "(−1)ⁿ/n", u: (n) => (n % 2 ? -1 : 1) / n, l: 0, y: [-1.1, 0.7] },
  frac: { name: "(n+1)/n", u: (n) => (n + 1) / n, l: 1, y: [-0.15, 2.1] },
  sin: { name: "sin(n)/n", u: (n) => Math.sin(n) / n, l: 0, y: [-0.5, 0.95] },
  div: { name: "(−1)ⁿ", u: (n) => (n % 2 ? -1 : 1), l: null, y: [-1.7, 1.7] },
};
const KEYS = Object.keys(SEQS) as Key[];
const NMAX = 60; // terms drawn
const E_MIN = 0.02;
const E_MAX = 0.6;

/** Smallest N ≥ 1 with |u_n − ℓ| < ε for every n ≥ N (searched far beyond the drawn terms). */
function rankN(u: (n: number) => number, l: number, eps: number): number | null {
  let last = 0;
  for (let n = 1; n <= 20000; n++) if (Math.abs(u(n) - l) >= eps) last = n;
  return last >= 19000 ? null : last + 1;
}

export default function Scene({ params }: { params?: Record<string, unknown> }) {
  const seq = SEQS[choiceParam(params?.sequence, KEYS, "inv")];
  const l = seq.l ?? numParam(params?.l, 0, -1.5, 1.5);
  const [eps, setEps] = useState(() => numParam(params?.epsilon, 0.2, E_MIN, E_MAX));
  const [tween, stop] = useTween();

  const N = useMemo(() => rankN(seq.u, l, eps), [seq, l, eps]);
  const s = useMemo(() => makeScale(-1.5, NMAX + 2, seq.y[0], seq.y[1]), [seq]);

  const setE = (v: number) => {
    stop();
    setEps(Math.round(clamp(v, E_MIN, E_MAX) * 1000) / 1000);
  };

  const bandTop = s.sy(l + eps);
  const bandBot = s.sy(l - eps);
  const nx = N !== null && N <= NMAX ? s.sx(N) : null;

  return (
    <SimFrame
      label={`Suite ${seq.name} : bande de largeur epsilon = ${fmt(eps)} autour de ${fmt(l)}${N !== null ? `, rang N = ${N}` : ", aucun rang N"}`}
      controls={
        <>
          <Slider label={<Tex>{"\\varepsilon"}</Tex>} value={eps} min={E_MIN} max={E_MAX} step={0.005} onChange={setE} display={fmt(eps, 3)} />
          <Btn onClick={() => tween(eps, E_MIN, (v) => setEps(v), { duration: 3 })}><span className="normal-case">ε → 0</span></Btn>
        </>
      }
      info={N !== null ? `N = ${N}` : "aucun N"}
    >
      <Axes s={s} xStep={10} xLabel="n" yLabel="uₙ" yStep={seq.y[1] - seq.y[0] > 2 ? 0.5 : 0.25} grid={false} />
      <Clip s={s}>
        <rect x={s.left} y={bandTop} width={s.right - s.left} height={bandBot - bandTop} style={{ fill: C.band }} />
        <line x1={s.left} x2={s.right} y1={s.sy(l)} y2={s.sy(l)} strokeWidth={1.5} style={{ stroke: C.blue }} />
        {nx !== null && <line x1={nx} x2={nx} y1={s.top} y2={s.bottom} strokeWidth={2} style={{ stroke: C.green }} strokeDasharray="8 5" />}
        {Array.from({ length: NMAX }, (_, i) => i + 1).map((n) => {
          const out = Math.abs(seq.u(n) - l) >= eps;
          return (
            <circle
              key={n}
              cx={s.sx(n)}
              cy={s.sy(seq.u(n))}
              r={n < 10 ? 5.5 : 4.5}
              style={{ fill: out ? C.orange : C.blue, stroke: "var(--card)" }}
              strokeWidth={1.2}
            />
          );
        })}
      </Clip>
      <Label x={s.sx(-1.2)} y={s.sy(l) - 12} color={C.blue} size={17} italic>
        ℓ
      </Label>
      {nx !== null && (
        <Label x={Math.min(nx + 8, s.right - 40)} y={s.top + 18} color={C.green} italic>
          N
        </Label>
      )}
    </SimFrame>
  );
}
