"use client";

import { useState } from "react";
import { DoubleSide } from "three";
import { SimCanvas } from "../three/canvas";
import { Arrow, Label, Path } from "../three/primitives";
import { Footer, Panel, Slider, Tex } from "../three/panel";
import { add, arc, fmt, mul, strParam, tex, texField, type V3 } from "../three/math";
import { usePalette } from "../three/theme";

const SHAPES = ["sphere", "cylinder", "plane"] as const;
const UNIT = 0.05; // metres per scene unit (1 unit = 5 cm)
const K = 8.99e9; // 1/(4πε0)
const EPS0 = 8.854e-12;
const Q = 1e-9; // ball: 1 nC
const LAMBDA = 1e-9; // wire: 1 nC/m
const SIGMA = 1e-8; // plane: 10 nC/m²
const A = 1; // radius of the charged ball (scene units)
const H = 1.6; // height of the Gauss cylinder around the wire
const RP = 1; // radius of the Gauss box across the plane
const EMAX = 1.6; // longest E arrow drawn

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
const DIRS = fibonacci(30);

const circle = (c: V3, r: number) => arc(c, [1, 0, 0], [0, 1, 0], r, 0, 2 * Math.PI, 64);

/**
 * Scene "gauss-surface": the Gauss surface adapted to the symmetry (params.shape) and the field
 * on it: sphere around a charged ball, cylinder around a charged wire, box across a charged
 * plane. One slider moves the surface; the result line gives E on it.
 */
export default function Scene({ params }: { params?: Record<string, unknown> }) {
  const pal = usePalette();
  const shape = strParam(params, "shape", SHAPES, "sphere");
  const [r, setR] = useState(shape === "sphere" ? 1.6 : 1.2); // radius (sphere, cylinder)
  const [h, setH] = useState(1); // distance of the bases to the plane

  const arrows: { from: V3; vec: V3 }[] = [];
  let E: number;
  let result: string;
  if (shape === "sphere") {
    const rm = r * UNIT;
    const am = A * UNIT;
    const qin = r < A ? Math.pow(r / A, 3) : 1;
    E = r < A ? (K * Q * rm) / (am * am * am) : (K * Q) / (rm * rm);
    const L = Math.min(EMAX, (1.1 * E * am * am) / (K * Q));
    for (const d of DIRS) arrows.push({ from: mul(d, r), vec: mul(d, L) });
    result = `Q_{\\text{int}} = ${tex(qin)}\\ \\text{nC} \\qquad E = ${texField(E)}`;
  } else if (shape === "cylinder") {
    E = (2 * K * LAMBDA) / (r * UNIT);
    const L = Math.min(EMAX, 0.8 / r);
    for (const zz of [-H / 3, 0, H / 3])
      for (let k = 0; k < 10; k++) {
        const a = (k * 2 * Math.PI) / 10 + (zz === 0 ? 0.31 : 0);
        const u: V3 = [Math.cos(a), Math.sin(a), 0];
        arrows.push({ from: add(mul(u, r), [0, 0, zz]), vec: mul(u, L) });
      }
    result = `E = ${texField(E)}`;
  } else {
    E = SIGMA / (2 * EPS0);
    for (const zz of [-h, h])
      for (const [x, y] of [
        [0, 0],
        [RP * 0.6, 0],
        [-RP * 0.6, 0],
        [0, RP * 0.6],
        [0, -RP * 0.6],
      ])
        arrows.push({ from: [x, y, zz], vec: [0, 0, Math.sign(zz) * 0.9] });
    result = `E = ${texField(E)}\\ \\ \\text{(quelle que soit la distance)}`;
  }

  const zTop = shape === "plane" ? h : H / 2;
  // the E label goes on the highest arrow tip
  const top = arrows.reduce((best, a) => (a.from[2] + a.vec[2] > best.from[2] + best.vec[2] ? a : best), arrows[0]);

  return (
    <div>
      <SimCanvas camera={[5.4, -5.2, 3.2]} target={[0, 0, 0]}>
        {/* ---- charge distribution */}
        {shape === "sphere" && (
          <mesh>
            <sphereGeometry args={[A, 32, 24]} />
            <meshStandardMaterial color={pal.orange} transparent opacity={0.6} />
          </mesh>
        )}
        {shape === "cylinder" && (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 6, 12]} />
            <meshStandardMaterial color={pal.orange} />
          </mesh>
        )}
        {shape === "plane" && (
          <>
            <mesh>
              <planeGeometry args={[5, 5]} />
              <meshBasicMaterial color={pal.orange} transparent opacity={0.2} side={DoubleSide} depthWrite={false} />
            </mesh>
            <Path points={[[-2.5, -2.5, 0], [2.5, -2.5, 0], [2.5, 2.5, 0], [-2.5, 2.5, 0], [-2.5, -2.5, 0]]} color={pal.orange} width={1.4} />
          </>
        )}

        {/* ---- Gauss surface */}
        {shape === "sphere" ? (
          <>
            <mesh>
              <sphereGeometry args={[r, 40, 28]} />
              <meshBasicMaterial color={pal.green} transparent opacity={0.12} side={DoubleSide} depthWrite={false} />
            </mesh>
            <Path points={circle([0, 0, 0], r)} color={pal.green} width={1.6} />
            <Path points={[[0, 0, 0], [r * 0.707, -r * 0.707, 0]]} color={pal.ink} width={1.4} dashed dash={0.05} />
            <Label position={[r * 0.38 + 0.12, -r * 0.38 - 0.2, 0]} tex="r" color={pal.ink} />
          </>
        ) : (
          <>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[shape === "plane" ? RP : r, shape === "plane" ? RP : r, 2 * zTop, 48, 1, false]} />
              <meshBasicMaterial color={pal.green} transparent opacity={0.12} side={DoubleSide} depthWrite={false} />
            </mesh>
            {[-zTop, zTop].map((zz) => (
              <Path key={zz} points={circle([0, 0, zz], shape === "plane" ? RP : r)} color={pal.green} width={1.6} />
            ))}
            {shape === "cylinder" && (
              <>
                <Path points={[[0, 0, zTop], [r, 0, zTop]]} color={pal.ink} width={1.4} dashed dash={0.05} />
                <Label position={[r / 2, 0, zTop + 0.25]} tex="r" color={pal.ink} />
              </>
            )}
          </>
        )}

        {arrows.map((a, i) => (
          <Arrow key={i} from={a.from} vec={a.vec} color={pal.cobalt} radius={0.024} />
        ))}
        <Label position={add(top.from, mul(top.vec, 1.3))} tex="\vec E" color={pal.cobalt} />
      </SimCanvas>

      <Panel>
        {shape === "plane" ? (
          <Slider label={<>Distance <Tex tex="h" /></>} value={h} min={0.2} max={2} step={0.01} onChange={setH} display={`${fmt(h * UNIT * 100, 1)} cm`} />
        ) : (
          <Slider label={<>Rayon <Tex tex="r" /></>} value={r} min={0.2} max={2.8} step={0.01} onChange={setR} display={`${fmt(r * UNIT * 100, 1)} cm`} />
        )}
        <Footer result={result} />
      </Panel>
    </div>
  );
}
