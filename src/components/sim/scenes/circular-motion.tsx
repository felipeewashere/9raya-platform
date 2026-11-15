"use client";

import { useState } from "react";
import { SimCanvas, Ticker } from "../three/canvas";
import { Arrow, Label, Path, Point } from "../three/primitives";
import { Footer, Panel, Slider, Tex } from "../three/panel";
import { add, arc, fmt, mul, numParam, tex, type V3 } from "../three/math";
import { usePalette, useReducedMotion } from "../three/theme";

const KV = 0.75; // display length of 1 m/s
const KA = 0.5; // display length of 1 m/s²

/**
 * Scene "circular-motion": uniform motion of M on a circle of radius R at angular speed ω.
 * v = Rω e_θ is tangent, a = −Rω² e_r points towards the centre.
 */
export default function Scene({ params }: { params?: Record<string, unknown> }) {
  const pal = usePalette();
  const reduced = useReducedMotion();
  const [R, setR] = useState(numParam(params, "R", 2));
  const [w, setW] = useState(Math.abs(numParam(params, "omega", 1)) || 1);
  const [th, setTh] = useState(0.7);
  const [playing, setPlaying] = useState(!reduced);

  const c = Math.cos(th);
  const s = Math.sin(th);
  const eR: V3 = [c, s, 0];
  const eT: V3 = [-s, c, 0];
  const M: V3 = [R * c, R * s, 0];

  return (
    <div>
      <SimCanvas camera={[0.3, -4.2, 6]} target={[0, 0, 0]} animate={playing}>
        <Ticker playing={playing} onTick={(dt) => setTh((x) => (x + w * dt) % (2 * Math.PI))} />
        <Path points={arc([0, 0, 0], [1, 0, 0], [0, 1, 0], R, 0, 2 * Math.PI, 96)} color={pal.ink} width={2} />
        <Path points={[[0, 0, 0], M]} color={pal.faint} width={1.4} dashed dash={0.08} />
        <Point position={[0, 0, 0]} color={pal.ink} r={0.06} flat />
        <Label position={[-0.25, -0.25, 0]} tex="O" color={pal.ink} />

        <Point position={M} color={pal.ink} r={0.1} />
        <Label position={add(M, mul(eR, 0.35))} tex="M" color={pal.ink} />
        <Arrow from={M} vec={mul(eT, R * w * KV)} color={pal.cobalt} label="\vec v" radius={0.038} />
        <Arrow from={M} vec={mul(eR, -R * w * w * KA)} color={pal.orange} label="\vec a" radius={0.038} />
      </SimCanvas>

      <Panel>
        <Slider label={<>Rayon <Tex tex="R" /></>} value={R} min={0.5} max={2.6} step={0.01} onChange={setR} display={`${fmt(R)} m`} />
        <Slider label={<>Vitesse angulaire <Tex tex="\omega" /></>} value={w} min={0.2} max={2} step={0.01} onChange={setW} display={`${fmt(w)} rad/s`} />
        <Footer
          playing={playing}
          onToggle={() => setPlaying((x) => !x)}
          result={`v = ${tex(R * w)}\\ \\text{m/s} \\qquad a = ${tex(R * w * w)}\\ \\text{m/s}^2`}
        />
      </Panel>
    </div>
  );
}
