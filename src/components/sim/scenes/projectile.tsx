"use client";

import { useMemo, useState } from "react";
import { DoubleSide } from "three";
import { SimCanvas, Ticker } from "../three/canvas";
import { Arrow, Label, Path, Point } from "../three/primitives";
import { Footer, Panel, Slider, Tex } from "../three/panel";
import { fmt, numParam, rad, tex, type V3 } from "../three/math";
import { usePalette, useReducedMotion } from "../three/theme";

const G = 9.81;
const KV = 0.11; // display length of 1 m/s
const HOLD = 0.9; // pause at impact before replaying (s)

/**
 * Scene "projectile": free fall with initial velocity v0 at angle α (height h0 from params).
 * x = v0 cos α · t, z = h0 + v0 sin α · t − g t²/2; a = g (constant), v tangent to the parabola.
 */
export default function Scene({ params }: { params?: Record<string, unknown> }) {
  const pal = usePalette();
  const reduced = useReducedMotion();
  const [v0, setV0] = useState(numParam(params, "v0", 12));
  const [alphaDeg, setAlphaDeg] = useState(numParam(params, "alpha", 50));
  const h0 = Math.max(0, numParam(params, "h0", 0));
  const [t, setT] = useState(0.6);
  const [playing, setPlaying] = useState(!reduced);

  const al = rad(alphaDeg);
  const vx = v0 * Math.cos(al);
  const vz0 = v0 * Math.sin(al);
  const tf = (vz0 + Math.sqrt(vz0 * vz0 + 2 * G * h0)) / G;
  const range = vx * tf;
  const H = h0 + (vz0 * vz0) / (2 * G);
  const k = 7 / Math.max(range, H * 1.5, 1); // metres → scene units (the whole flight fits)

  const tc = Math.min(t, tf);
  const M: V3 = [vx * tc * k, 0, (h0 + vz0 * tc - (G * tc * tc) / 2) * k];
  const vzNow = vz0 - G * tc;

  const path = useMemo(() => {
    const pts: V3[] = [];
    for (let i = 0; i <= 120; i++) {
      const s = (tf * i) / 120;
      pts.push([vx * s * k, 0, (h0 + vz0 * s - (G * s * s) / 2) * k]);
    }
    return pts;
  }, [tf, vx, vz0, h0, k]);

  const tick = (dt: number) => setT((x) => (x + dt > tf + HOLD ? 0 : x + dt));
  const zAxis = Math.max(2.6, H * k + 0.8);

  return (
    <div>
      <SimCanvas camera={[3.6, -8.6, 2.4]} target={[3.5, 0, 1.4]} animate={playing} maxDistance={40}>
        <Ticker playing={playing} onTick={tick} />
        {/* ground and axes */}
        <mesh position={[3.5, 0, -0.005]}>
          <planeGeometry args={[11, 4]} />
          <meshBasicMaterial color={pal.faint} transparent opacity={0.25} side={DoubleSide} depthWrite={false} />
        </mesh>
        <Arrow from={[-0.5, 0, 0]} vec={[8.3, 0, 0]} color={pal.ink} radius={0.012} headLength={0.16} />
        <Arrow from={[0, 0, -0.2]} vec={[0, 0, zAxis]} color={pal.ink} radius={0.012} headLength={0.16} />
        <Label position={[8.05, 0, -0.3]} tex="x" color={pal.ink} />
        <Label position={[-0.3, 0, zAxis - 0.1]} tex="z" color={pal.ink} />
        {h0 > 0 && (
          <mesh position={[-0.2, 0, (h0 * k) / 2]}>
            <boxGeometry args={[0.4, 0.4, h0 * k]} />
            <meshStandardMaterial color={pal.faint} />
          </mesh>
        )}

        <Path points={path} color={pal.ink} width={1.8} dashed dash={0.1} />
        <Point position={M} color={pal.ink} r={0.11} />
        <Arrow from={M} vec={[vx * KV, 0, vzNow * KV]} color={pal.cobalt} label="\vec v" radius={0.036} />
        <Arrow from={M} vec={[0, 0, -G * KV]} color={pal.orange} label="\vec g" radius={0.036} />
      </SimCanvas>

      <Panel>
        <Slider label={<>Vitesse <Tex tex="v_0" /></>} value={v0} min={1} max={25} step={0.1} onChange={setV0} display={`${fmt(v0, 1)} m/s`} />
        <Slider label={<>Angle <Tex tex="\alpha" /></>} value={alphaDeg} min={5} max={90} step={1} onChange={setAlphaDeg} display={`${Math.round(alphaDeg)}°`} />
        <Footer playing={playing} onToggle={() => setPlaying((x) => !x)} result={`\\text{Portée} = ${tex(range, 1)}\\ \\text{m}`} />
      </Panel>
    </div>
  );
}
