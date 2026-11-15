"use client";

/**
 * Scene "recurrent-sequence" — suite récurrente u_{n+1} = f(u_n) : diagramme en escalier / en toile.
 *
 * params (all optional, chosen by the lesson):
 *  - f:  "cos" (cos x, default) | "sqrt" (√(2 + x)) | "heron" ((x + 2/x)/2) | "square" (x²) | "logistic" (r x(1 − x))
 *  - u0: number (clamped to the function's range)
 *  - r:  number in [2.5, 4] for "logistic" (default 3.2)
 *  - steps: number of steps drawn at start (default 3)
 *
 * One interaction: drag u₀ on the x-axis, plus an "Étape suivante" button (which restarts once
 * every step is drawn). Shows the graph of f, the line y = x, the cobweb and the last term.
 */

import { useMemo, useState } from "react";
import { C, SimFrame } from "../two/frame";
import { Btn } from "../two/controls";
import { Axes, Clip, curvePath, Handle, Label, makeScale } from "../two/plot";
import { choiceParam, clamp, fmt, numParam } from "../two/format";

type Key = "cos" | "sqrt" | "heron" | "square" | "logistic";
type Fn = { name: string; f: (x: number, r: number) => number; view: [number, number, number, number]; u0: [number, number, number] };
const FNS: Record<Key, Fn> = {
  cos: { name: "cos x", f: (x) => Math.cos(x), view: [-0.25, 1.75, -0.2, 1.2], u0: [0, 1.6, 0.1] },
  sqrt: { name: "√(2 + x)", f: (x) => (x >= -2 ? Math.sqrt(2 + x) : NaN), view: [-2.2, 4.6, -0.6, 3.1], u0: [-2, 4.5, -1.5] },
  heron: { name: "(x + 2/x)/2", f: (x) => (x > 0 ? (x + 2 / x) / 2 : NaN), view: [-0.2, 4.2, -0.2, 3.6], u0: [0.4, 4, 3.5] },
  square: { name: "x²", f: (x) => x * x, view: [-0.2, 1.6, -0.15, 1.45], u0: [0, 1.15, 0.9] },
  logistic: { name: "r x(1 − x)", f: (x, r) => r * x * (1 - x), view: [-0.06, 1.06, -0.06, 1.06], u0: [0, 1, 0.2] },
};
const KEYS = Object.keys(FNS) as Key[];
const MAX = 30;
const SUB = "₀₁₂₃₄₅₆₇₈₉";
const sub = (k: number) => String(k).split("").map((d) => SUB[Number(d)]).join("");

export default function Scene({ params }: { params?: Record<string, unknown> }) {
  const fn = FNS[choiceParam(params?.f, KEYS, "cos")];
  const r = numParam(params?.r, 3.2, 2.5, 4);
  const [u0, setU0] = useState(() => numParam(params?.u0, fn.u0[2], fn.u0[0], fn.u0[1]));
  const [n, setN] = useState(() => Math.round(numParam(params?.steps, 3, 0, MAX)));

  const f = useMemo(() => (x: number) => fn.f(x, r), [fn, r]);
  const s = useMemo(() => makeScale(...fn.view), [fn]);

  const terms = useMemo(() => {
    const u = [u0];
    for (let k = 0; k < MAX; k++) {
      const next = f(u[k]);
      if (!Number.isFinite(next) || Math.abs(next) > 1e6) break;
      u.push(next);
    }
    return u;
  }, [f, u0]);
  const shown = Math.min(n, terms.length - 1);
  const done = shown >= terms.length - 1;

  // cobweb: (u0,0) → (u0,u1) → (u1,u1) → (u1,u2) → …
  const web = useMemo(() => {
    let d = "";
    for (let k = 0; k < shown; k++) {
      const a = terms[k];
      const b = terms[k + 1];
      d += `M${s.sx(a)},${s.sy(k === 0 ? 0 : a)} V${s.sy(b)} H${s.sx(b)}`;
    }
    return d;
  }, [terms, shown, s]);

  const graph = useMemo(() => curvePath(s, f, s.x0, s.x1, 800), [s, f]);
  const last = terms[shown];
  const diag = Math.min(s.x1, s.y1) * 0.93;

  return (
    <SimFrame
      label={`Diagramme en toile pour u(n+1) = ${fn.name}, u0 = ${fmt(u0)}, ${shown} étapes`}
      controls={<Btn onClick={() => setN(done ? 0 : shown + 1)}>{done ? "Recommencer" : "Étape suivante"}</Btn>}
      info={`u${sub(shown)} = ${fmt(last, 4)}`}
    >
      <Axes s={s} grid={false} />
      <Clip s={s}>
        <line x1={s.sx(s.x0)} y1={s.sy(s.x0)} x2={s.sx(s.x1)} y2={s.sy(s.x1)} strokeWidth={1.5} style={{ stroke: C.ink }} strokeDasharray="6 5" opacity={0.6} />
        <path d={graph} fill="none" strokeWidth={3} style={{ stroke: C.blue }} />
        <path d={web} fill="none" strokeWidth={2} strokeLinejoin="round" style={{ stroke: C.orange }} />
        {shown > 0 && <circle cx={s.sx(last)} cy={s.sy(last)} r={5} style={{ fill: C.orange }} />}
      </Clip>
      <Label x={s.sx(diag) + 10} y={s.sy(diag) + 18} size={15} italic>
        y = x
      </Label>
      <Label x={s.sx(fn.view[0] + 0.9 * (fn.view[1] - fn.view[0]))} y={s.sy(f(fn.view[0] + 0.9 * (fn.view[1] - fn.view[0]))) - 12} anchor="middle" color={C.blue} italic>
        y = f(x)
      </Label>
      <Label x={s.sx(clamp(u0, s.x0, s.x1))} y={s.sy(0) + 34} anchor="middle" color={C.orange} italic>
        u₀
      </Label>
      <Handle
        x={s.sx(clamp(u0, s.x0, s.x1))}
        y={s.sy(0)}
        color={C.orange}
        label="terme initial u0"
        onDrag={(p) => setU0(Math.round(clamp(s.ix(p.x), fn.u0[0], fn.u0[1]) * 100) / 100)}
      />
    </SimFrame>
  );
}
