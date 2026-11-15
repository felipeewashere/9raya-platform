"use client";

import { useState } from "react";
import { DoubleSide } from "three";
import { SimCanvas } from "../three/canvas";
import { Arrow, Axes, Label, Path, Point } from "../three/primitives";
import { Footer, Panel, Slider, Tex } from "../three/panel";
import { add, arc, fmt, mul, norm, strParam, sub, texField, unit, type V3 } from "../three/math";
import { usePalette } from "../three/theme";

const SHAPES = ["wire", "ring", "disk"] as const;
const UNIT = 0.05; // metres per scene unit (1 unit = 5 cm)
const K = 8.99e9; // 1/(4πε0)
const EPS0 = 8.854e-12;
const LAMBDA = 1e-9; // wire: 1 nC/m
const Q = 1e-9; // ring: 1 nC
const SIGMA = 1e-8; // disk: 10 nC/m²
const A_RING = 1.6; // radius of the ring (scene units)
const WIRE = 3.6; // half-length drawn for the (infinite) wire
const EMAX = 2.4; // longest E arrow drawn

/**
 * Scene "charged-distribution": field of a charged wire, ring or disk (params.shape).
 * Wire and ring: two symmetric elements dq give dE₁ + dE₂ along the symmetry axis, the other
 * components cancel. Disk: the field on the axis, which tends to σ/2ε0 close to the disk.
 */
export default function Scene({ params }: { params?: Record<string, unknown> }) {
  const pal = usePalette();
  const shape = strParam(params, "shape", SHAPES, "ring");
  const [z, setZ] = useState(shape === "wire" ? 1.4 : 1.2); // M on the axis (ring, disk) or distance r to the wire
  const [a, setA] = useState(1.6); // radius of the disk

  let M: V3;
  let P1: V3 | null = null;
  let P2: V3 | null = null;
  let E: number; // field in V/m (algebraic along the axis)
  let Edir: V3;
  if (shape === "wire") {
    M = [z, 0, 0];
    P1 = [0, 0, 1.3];
    P2 = [0, 0, -1.3];
    E = (2 * K * LAMBDA) / (z * UNIT);
    Edir = [1, 0, 0];
  } else if (shape === "ring") {
    M = [0, 0, z];
    P1 = [A_RING * Math.cos(-0.5), A_RING * Math.sin(-0.5), 0];
    P2 = [-P1[0], -P1[1], 0];
    const zm = z * UNIT;
    const am = A_RING * UNIT;
    E = (K * Q * zm) / Math.pow(am * am + zm * zm, 1.5);
    Edir = [0, 0, 1];
  } else {
    M = [0, 0, z];
    E = z === 0 ? 0 : (SIGMA / (2 * EPS0)) * (Math.sign(z) - z / Math.sqrt(z * z + a * a));
    Edir = [0, 0, 1];
  }
  // display: E arrow of a length growing with E (log-like, capped)
  const Eref = shape === "wire" ? 400 : shape === "ring" ? 600 : 565;
  const Elen = Math.min(EMAX, (1.2 * Math.abs(E)) / Eref) * Math.sign(E);

  // elementary fields dE ∝ u / PM², scaled so that their sum matches the E arrow
  const dE = (P: V3) => {
    const PM = sub(M, P);
    const r = norm(PM);
    return mul(unit(PM), 1 / (r * r));
  };
  let d1: V3 = [0, 0, 0];
  let d2: V3 = [0, 0, 0];
  if (P1 && P2) {
    const raw1 = dE(P1);
    const raw2 = dE(P2);
    const sum = norm(add(raw1, raw2));
    const s = sum > 1e-9 ? Math.min(Math.abs(Elen), 1.6) / sum : 0;
    d1 = mul(raw1, s);
    d2 = mul(raw2, s);
  }

  const result =
    shape === "disk" ? `E = ${texField(E)} \\quad (\\sigma/2\\varepsilon_0 = ${texField(SIGMA / (2 * EPS0))})` : `E = ${texField(E)}`;

  return (
    <div>
      <SimCanvas camera={shape === "wire" ? [1.6, -7.2, 1.8] : [4.6, -4.4, 2.6]} target={[shape === "wire" ? 1.2 : 0, 0, shape === "wire" ? 0 : 0.6]}>
        <Axes size={2.8} color={pal.faint} faint={pal.faint} negative={shape !== "wire"} />

        {shape === "wire" && (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 2 * WIRE, 12]} />
            <meshStandardMaterial color={pal.orange} />
          </mesh>
        )}
        {shape === "ring" && <Path points={arc([0, 0, 0], [1, 0, 0], [0, 1, 0], A_RING, 0, 2 * Math.PI, 96)} color={pal.orange} width={4} />}
        {shape === "disk" && (
          <>
            <mesh>
              <circleGeometry args={[a, 64]} />
              <meshBasicMaterial color={pal.orange} transparent opacity={0.3} side={DoubleSide} depthWrite={false} />
            </mesh>
            <Path points={arc([0, 0, 0], [1, 0, 0], [0, 1, 0], a, 0, 2 * Math.PI, 96)} color={pal.orange} width={2} />
          </>
        )}

        {/* two symmetric elements dq and their fields at M */}
        {P1 && P2 && (
          <>
            <Point position={P1} color={pal.ink} r={0.08} />
            <Point position={P2} color={pal.ink} r={0.08} />
            <Label position={add(P1, shape === "wire" ? [-0.45, 0, 0] : mul(unit(P1), 0.45))} tex="\mathrm dq_1" color={pal.ink} />
            <Label position={add(P2, shape === "wire" ? [-0.45, 0, 0] : mul(unit(P2), 0.45))} tex="\mathrm dq_2" color={pal.ink} />
            <Path points={[P1, M]} color={pal.faint} width={1.2} dashed dash={0.07} />
            <Path points={[P2, M]} color={pal.faint} width={1.2} dashed dash={0.07} />
            <Arrow from={M} vec={d1} color={pal.orange} label="\mathrm d\vec E_1" radius={0.026} />
            <Arrow from={M} vec={d2} color={pal.orange} label="\mathrm d\vec E_2" radius={0.026} />
          </>
        )}

        <Point position={M} color={pal.ink} r={0.09} />
        <Label position={add(M, shape === "wire" ? [0.1, 0, -0.38] : [0.4, 0, -0.1])} tex="M" color={pal.ink} />
        <Arrow from={M} vec={mul(Edir, Elen)} color={pal.cobalt} label="\vec E" radius={0.042} labelOffset={shape === "wire" ? [0, 0, 0.25] : [0.3, 0, 0]} />
      </SimCanvas>

      <Panel>
        {shape === "wire" ? (
          <Slider label={<>Distance <Tex tex="r" /></>} value={z} min={0.4} max={3} step={0.01} onChange={setZ} display={`${fmt(z * UNIT * 100, 1)} cm`} />
        ) : (
          <Slider label={<>Position <Tex tex="z" /></>} value={z} min={-2.8} max={2.8} step={0.01} onChange={setZ} display={`${fmt(z * UNIT * 100, 1)} cm`} />
        )}
        {shape === "disk" && (
          <Slider label={<>Rayon <Tex tex="a" /></>} value={a} min={0.4} max={2.8} step={0.01} onChange={setA} display={`${fmt(a * UNIT * 100, 1)} cm`} />
        )}
        <Footer result={result} />
      </Panel>
    </div>
  );
}
