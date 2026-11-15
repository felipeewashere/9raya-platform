"use client";

import { useMemo, useState } from "react";
import { SimCanvas } from "../three/canvas";
import { Arrow, Label, Path, Point } from "../three/primitives";
import { Footer, Panel, Slider, Tex } from "../three/panel";
import { marksAlong, traceLine, type Charge, type P2 } from "../three/field";
import { fmt, numParam, tex, type V3 } from "../three/math";
import { usePalette } from "../three/theme";

const D = 3.4; // distance between the two centres
const BOX: [number, number, number, number] = [-5.5, 5.5, -3.6, 3.6];

/** Evenly spread unit vectors (Fibonacci sphere). */
function fibonacci(n: number): V3[] {
  const pts: V3[] = [];
  const g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const z = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - z * z);
    pts.push([r * Math.cos(g * i), r * Math.sin(g * i), z]);
  }
  return pts;
}

/**
 * Scene "conductor": two conducting spheres joined by a thin wire form one conductor in
 * equilibrium: same potential V ⇒ Q₁/R₁ = Q₂/R₂ ⇒ σ ∝ 1/R and E_surface = σ/ε0 ∝ 1/R (point
 * effect). Charges sit on the surface, E = 0 inside, field lines leave the surface at right angles.
 */
export default function Scene({ params }: { params?: Record<string, unknown> }) {
  const pal = usePalette();
  const [R1, setR1] = useState(numParam(params, "R1", 1.2));
  const [R2, setR2] = useState(numParam(params, "R2", 0.35));

  const c1 = -D / 2;
  const c2 = D / 2;
  // Q ∝ R (same potential); total charge fixed (Q₁ + Q₂ = 3 in reduced units)
  const Qt = 3;
  const Q1 = (Qt * R1) / (R1 + R2);
  const Q2 = (Qt * R2) / (R1 + R2);

  const charges = useMemo<Charge[]>(
    () => [
      { x: c1, y: 0, q: Q1 },
      { x: c2, y: 0, q: Q2 },
    ],
    [c1, c2, Q1, Q2],
  );

  const lines = useMemo(() => {
    const inside = (x: number, y: number) => Math.hypot(x - c1, y) < R1 * 0.98 || Math.hypot(x - c2, y) < R2 * 0.98;
    const out: P2[][] = [];
    const per = 9; // lines per unit charge
    for (const [c, R, Q] of [
      [c1, R1, Q1],
      [c2, R2, Q2],
    ] as const) {
      const n = Math.max(4, Math.round(Q * per));
      for (let k = 0; k < n; k++) {
        const a = (2 * Math.PI * (k + 0.5)) / n;
        const start: P2 = [c + R * 1.001 * Math.cos(a), R * 1.001 * Math.sin(a)];
        out.push(traceLine(charges, start, 1, { box: BOX, step: 0.035, maxSteps: 600, blocked: inside }).points);
      }
    }
    return out;
  }, [charges, c1, c2, R1, R2, Q1, Q2]);

  const marks = useMemo(() => lines.flatMap((l) => marksAlong(l, 1.5, 0.7)), [lines]);

  // surface charges: glyph count ∝ Q, so the density on the surface ∝ σ ∝ 1/R
  const glyphs = useMemo(() => {
    const g: V3[] = [];
    for (const d of fibonacci(Math.round(20 * Q1))) g.push([c1 + d[0] * R1 * 1.02, d[1] * R1 * 1.02, d[2] * R1 * 1.02]);
    for (const d of fibonacci(Math.round(20 * Q2))) g.push([c2 + d[0] * R2 * 1.04, d[1] * R2 * 1.04, d[2] * R2 * 1.04]);
    return g;
  }, [Q1, Q2, R1, R2, c1, c2]);

  return (
    <div>
      <SimCanvas camera={[0.4, -8.4, 2.4]} target={[0, 0, 0]}>
        {/* conductor: two spheres + wire */}
        <mesh position={[c1, 0, 0]}>
          <sphereGeometry args={[R1, 48, 32]} />
          <meshStandardMaterial color={pal.faint} transparent opacity={0.55} roughness={0.35} metalness={0.2} depthWrite={false} />
        </mesh>
        <mesh position={[c2, 0, 0]}>
          <sphereGeometry args={[R2, 32, 24]} />
          <meshStandardMaterial color={pal.faint} transparent opacity={0.55} roughness={0.35} metalness={0.2} depthWrite={false} />
        </mesh>
        <mesh position={[(c1 + R1 + c2 - R2) / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.03, 0.03, Math.max(0.01, c2 - R2 - (c1 + R1)), 8]} />
          <meshStandardMaterial color={pal.faint} />
        </mesh>
        {glyphs.map((g, i) => (
          <Point key={i} position={g} color={pal.orange} r={0.04} flat />
        ))}

        {/* field lines in the plane y = 0 */}
        {lines.map((l, i) => (
          <Path key={i} points={l.map(([x, y]) => [x, 0, y] as V3)} color={pal.ink} width={1.4} />
        ))}
        {marks.map((m, i) => (
          <Arrow key={i} from={[m.p[0] - m.d[0] * 0.1, 0, m.p[1] - m.d[1] * 0.1]} vec={[m.d[0] * 0.22, 0, m.d[1] * 0.22]} color={pal.ink} radius={0.014} headLength={0.22} />
        ))}

        <Label position={[c1, -R1, 0]} tex="\vec E = \vec 0" color={pal.ink} />
        <Label position={[c1, 0, -R1 - 0.4]} tex="R_1" color={pal.ink} />
        <Label position={[c2, 0, -R2 - 0.4]} tex="R_2" color={pal.ink} />
      </SimCanvas>

      <Panel>
        <Slider label={<>Rayon <Tex tex="R_1" /></>} value={R1} min={0.6} max={1.4} step={0.01} onChange={setR1} display={fmt(R1)} />
        <Slider label={<>Rayon <Tex tex="R_2" /></>} value={R2} min={0.12} max={1.2} step={0.01} onChange={setR2} display={fmt(R2)} />
        <Footer result={`E_2 = ${tex(R1 / R2, 1)} \\times E_1 \\quad (\\text{surface})`} />
      </Panel>
    </div>
  );
}
