"use client";

/**
 * Scene "sup-inf" — borne supérieure / inférieure d'une partie A de ℝ, sur la droite réelle.
 *
 * params (all optional, chosen by the lesson):
 *  - set:  "open" (]0,1[, default) | "inv" ({1/n}) | "alt" ({(−1)^n + 1/n}) | "union" ([−1,1[ ∪ {2}) | "q" ({x ∈ ℚ : x² < 2})
 *  - mode: "sup" (default) | "inf"
 *
 * One interaction: drag a candidate M along the line. The majorants (resp. minorants) are shaded;
 * sup A (resp. inf A) is the smallest majorant (resp. largest minorant). The result line says
 * whether M is a majorant (minorant).
 */

import { useMemo, useState } from "react";
import { C, H, SimFrame } from "../two/frame";
import { Handle, Label, makeScale, niceStep } from "../two/plot";
import { choiceParam, clamp, fmt, fmtShort } from "../two/format";

type Key = "open" | "inv" | "alt" | "union" | "q";
type Mode = "sup" | "inf";
type Piece = { kind: "interval"; a: number; b: number; ca: boolean; cb: boolean; dotted?: boolean } | { kind: "points"; xs: number[] };
type SetDef = { name: string; view: [number, number]; pieces: Piece[]; sup: number; supText: string; inf: number; infText: string };

const R2 = Math.SQRT2;
const SETS: Record<Key, SetDef> = {
  open: { name: "]0, 1[", view: [-0.6, 1.6], pieces: [{ kind: "interval", a: 0, b: 1, ca: false, cb: false }], sup: 1, supText: "1", inf: 0, infText: "0" },
  inv: { name: "{1/n}", view: [-0.25, 1.35], pieces: [{ kind: "points", xs: Array.from({ length: 300 }, (_, i) => 1 / (i + 1)) }], sup: 1, supText: "1", inf: 0, infText: "0" },
  alt: {
    name: "{(−1)ⁿ + 1/n}",
    view: [-1.4, 1.9],
    pieces: [{ kind: "points", xs: Array.from({ length: 300 }, (_, i) => ((i + 1) % 2 ? -1 : 1) + 1 / (i + 1)) }],
    sup: 1.5,
    supText: "1,5",
    inf: -1,
    infText: "−1",
  },
  union: {
    name: "[−1, 1[ ∪ {2}",
    view: [-1.7, 2.7],
    pieces: [
      { kind: "interval", a: -1, b: 1, ca: true, cb: false },
      { kind: "points", xs: [2] },
    ],
    sup: 2,
    supText: "2",
    inf: -1,
    infText: "−1",
  },
  q: { name: "{x ∈ ℚ, x² < 2}", view: [-2.1, 2.1], pieces: [{ kind: "interval", a: -R2, b: R2, ca: false, cb: false, dotted: true }], sup: R2, supText: "√2", inf: -R2, infText: "−√2" },
};
const KEYS = Object.keys(SETS) as Key[];

export default function Scene({ params }: { params?: Record<string, unknown> }) {
  const set = SETS[choiceParam(params?.set, KEYS, "open")];
  const mode: Mode = choiceParam(params?.mode, ["sup", "inf"] as const, "sup");
  const v = set.view;
  const [M, setM] = useState(() => (mode === "sup" ? v[1] - 0.15 * (v[1] - v[0]) : v[0] + 0.15 * (v[1] - v[0])));

  const s = useMemo(() => makeScale(v[0], v[1], 0, 1, { margin: 30 }), [v]);
  const Y = H * 0.55;
  const bound = mode === "sup" ? set.sup : set.inf;
  const isBound = mode === "sup" ? M >= bound - 1e-9 : M <= bound + 1e-9;
  const word = mode === "sup" ? "majorant" : "minorant";

  const step = niceStep(v[1] - v[0], 10);
  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let i = Math.ceil(v[0] / step); i * step <= v[1]; i++) out.push(i * step);
    return out;
  }, [v, step]);

  const bx = s.sx(bound);
  const mColor = isBound ? C.green : C.orange;

  return (
    <SimFrame
      label={`Partie ${set.name} : ${mode} A = ${fmt(bound, 3)} ; M = ${fmt(M)} ${isBound ? "est" : "n'est pas"} un ${word}`}
      info={isBound ? `M : ${word}` : `M : pas un ${word}`}
    >
      {/* majorants / minorants */}
      <rect
        x={mode === "sup" ? bx : s.left - 10}
        y={Y - 40}
        width={mode === "sup" ? s.right + 10 - bx : bx - s.left + 10}
        height={28}
        style={{ fill: C.green, opacity: 0.16 }}
      />
      <Label x={mode === "sup" ? s.right : s.left} y={Y - 48} anchor={mode === "sup" ? "end" : "start"} color={C.green} size={15}>
        {`${word}s`}
      </Label>
      {/* real line */}
      <line x1={s.left - 10} x2={s.right + 6} y1={Y} y2={Y} strokeWidth={1.5} style={{ stroke: C.ink }} />
      <path d={`M${s.right + 16},${Y} l-11,-5.5 v11 z`} style={{ fill: C.ink }} />
      <g style={{ stroke: C.ink }} strokeWidth={1.2}>
        {ticks.map((t) => (
          <line key={t} x1={s.sx(t)} x2={s.sx(t)} y1={Y - 5} y2={Y + 5} />
        ))}
      </g>
      <g style={{ fill: C.ink, opacity: 0.7 }} fontSize={14} textAnchor="middle">
        {ticks.map((t) => (
          <text key={t} x={s.sx(t)} y={Y + 58}>
            {fmt(t, step < 1 ? (step < 0.1 ? 2 : 1) : 0)}
          </text>
        ))}
      </g>
      {/* the set A */}
      {set.pieces.map((p, i) =>
        p.kind === "points" ? (
          <g key={i} style={{ fill: C.blue }}>
            {p.xs.map((x, j) => (
              <circle key={j} cx={s.sx(x)} cy={Y} r={j < 12 ? 5 : 3} />
            ))}
          </g>
        ) : (
          <g key={i}>
            <line x1={s.sx(p.a)} x2={s.sx(p.b)} y1={Y} y2={Y} strokeWidth={6} strokeDasharray={p.dotted ? "2 4" : undefined} style={{ stroke: C.blue }} />
            {/* French brackets: [a closed, ]a open */}
            <path d={`M${s.sx(p.a) + (p.ca ? 9 : -9)},${Y - 14} h${p.ca ? -9 : 9} v28 h${p.ca ? 9 : -9}`} fill="none" strokeWidth={3} style={{ stroke: C.blue }} />
            <path d={`M${s.sx(p.b) + (p.cb ? -9 : 9)},${Y - 14} h${p.cb ? 9 : -9} v28 h${p.cb ? -9 : 9}`} fill="none" strokeWidth={3} style={{ stroke: C.blue }} />
          </g>
        ),
      )}
      <Label x={s.sx(v[0]) + 4} y={Y + 30} color={C.blue} italic>
        A
      </Label>
      {/* the bound */}
      <line x1={bx} x2={bx} y1={Y - 64} y2={Y + 30} strokeWidth={2.5} style={{ stroke: C.green }} />
      <Label x={bx} y={Y - 72} anchor="middle" color={C.green}>
        {`${mode} A = ${mode === "sup" ? set.supText : set.infText}`}
      </Label>
      {/* candidate M */}
      <line x1={s.sx(M)} x2={s.sx(M)} y1={Y - 150} y2={Y} strokeWidth={1.5} strokeDasharray="3 3" style={{ stroke: mColor }} />
      <Label x={s.sx(M)} y={Y - 172} anchor="middle" color={mColor} italic>
        {`M = ${fmtShort(M, 2)}`}
      </Label>
      <Handle
        x={s.sx(M)}
        y={Y - 146}
        color={mColor}
        label={`candidat ${word} M`}
        onDrag={(p) => setM(Math.round(clamp(s.ix(p.x), v[0], v[1]) * 100) / 100)}
      />
    </SimFrame>
  );
}
