"use client";

import { useMemo, useState } from "react";
import { SimCanvas } from "../three/canvas";
import { Arrow, Label, Path, Point } from "../three/primitives";
import { Footer, Panel, Slider, Tex } from "../three/panel";
import { contours, marksAlong, potentialAt, traceLine, type Charge, type P2 } from "../three/field";
import { fmt, numParam, type V3 } from "../three/math";
import { usePalette } from "../three/theme";

const BOX: [number, number, number, number] = [-5.2, 5.2, -3.4, 3.4];
const LINES_PER_UNIT = 6;
const LEVELS = [0.5, 1.5];

type Line = { pts: P2[]; sign: 1 | -1 };

function fieldLines(charges: Charge[]): Line[] {
  const out: Line[] = [];
  const opts = { box: BOX, step: 0.03, maxSteps: 900, stopR: 0.09 };
  charges.forEach((c, i) => {
    if (c.q === 0) return;
    const n = Math.max(3, Math.round(Math.abs(c.q) * LINES_PER_UNIT));
    for (let k = 0; k < n; k++) {
      const a = (2 * Math.PI * (k + 0.5)) / n + i * 0.3;
      const start: P2 = [c.x + 0.1 * Math.cos(a), c.y + 0.1 * Math.sin(a)];
      if (c.q > 0) {
        out.push({ pts: traceLine(charges, start, 1, opts).points, sign: 1 });
      } else {
        // lines ending on a negative charge: only keep those not already drawn from a positive charge
        const res = traceLine(charges, start, -1, opts);
        if (!(res.end === "charge" && charges[res.hit ?? 0].q > 0)) out.push({ pts: res.points, sign: -1 });
      }
    }
  });
  return out;
}

/**
 * Scene "point-charges": field lines (with their direction) and a few faint equipotentials of
 * two point charges q₁ and q₂, in the plane of the charges (rotate to see it in 3D).
 */
export default function Scene({ params }: { params?: Record<string, unknown> }) {
  const pal = usePalette();
  const [q1, setQ1] = useState(numParam(params, "q1", 2));
  const [q2, setQ2] = useState(numParam(params, "q2", -1));
  const d = numParam(params, "d", 3);

  const charges = useMemo<Charge[]>(
    () => [
      { x: -d / 2, y: 0, q: q1 },
      { x: d / 2, y: 0, q: q2 },
    ],
    [q1, q2, d],
  );

  const lines = useMemo(() => fieldLines(charges), [charges]);
  const equip = useMemo(() => {
    const scale = Math.max(Math.abs(q1), Math.abs(q2), 0.5) / 2;
    const lv = LEVELS.flatMap((l) => [l * scale, -l * scale]);
    return contours((x, y) => potentialAt(charges, x, y), BOX, 150, 98, lv).map(([x, y]) => [x, y, 0] as V3);
  }, [charges, q1, q2]);
  const marks = useMemo(
    () =>
      lines.flatMap((l) =>
        marksAlong(l.pts, 1.4, 0.6).map((m) => ({ p: [m.p[0], m.p[1], 0] as V3, d: [m.d[0] * l.sign, m.d[1] * l.sign, 0] as V3 })),
      ),
    [lines],
  );

  const result =
    q1 === 0 && q2 === 0
      ? "\\text{Aucune charge : pas de champ}"
      : q1 === 0 || q2 === 0
      ? "\\text{Une seule charge : lignes radiales}"
      : q1 * q2 < 0
        ? "\\text{Signes opposés : les charges s'attirent}"
        : "\\text{Même signe : les charges se repoussent}";

  return (
    <div>
      <SimCanvas camera={[0, -6.4, 7.4]} target={[0, 0, 0]} maxDistance={25}>
        {/* plane of the figure */}
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[BOX[1] - BOX[0], BOX[3] - BOX[2]]} />
          <meshBasicMaterial color={pal.faint} transparent opacity={0.18} depthWrite={false} />
        </mesh>
        {equip.length > 1 && <Path points={equip} segments color={pal.green} width={1.2} opacity={0.55} />}
        {lines.map((l, i) => (
          <Path key={i} points={l.pts.map(([x, y]) => [x, y, 0] as V3)} color={pal.ink} width={1.5} />
        ))}
        {marks.map((m, i) => (
          <Arrow key={i} from={[m.p[0] - m.d[0] * 0.1, m.p[1] - m.d[1] * 0.1, 0]} vec={[m.d[0] * 0.22, m.d[1] * 0.22, 0]} color={pal.ink} radius={0.014} headLength={0.22} />
        ))}

        {charges.map((c, i) => (
          <group key={i}>
            <Point position={[c.x, c.y, 0]} color={c.q > 0 ? pal.orange : c.q < 0 ? pal.cobalt : pal.faint} r={0.13 + 0.04 * Math.abs(c.q)} />
            <Label position={[c.x, c.y - 0.6, 0.1]} tex={`q_${i + 1}`} color={pal.ink} />
          </group>
        ))}
      </SimCanvas>

      <Panel>
        <Slider label={<>Charge <Tex tex="q_1" /></>} value={q1} min={-3} max={3} step={0.5} onChange={setQ1} display={`${fmt(q1, 1)} q`} />
        <Slider label={<>Charge <Tex tex="q_2" /></>} value={q2} min={-3} max={3} step={0.5} onChange={setQ2} display={`${fmt(q2, 1)} q`} />
        <Footer result={result} />
      </Panel>
    </div>
  );
}
