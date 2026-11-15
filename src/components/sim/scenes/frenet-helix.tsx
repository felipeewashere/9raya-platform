"use client";

import { useMemo, useState } from "react";
import { SimCanvas, Ticker } from "../three/canvas";
import { Arrow, Label, Path, Point } from "../three/primitives";
import { Footer, Panel, Slider, Tex } from "../three/panel";
import { add, fmt, mul, numParam, tex, type V3 } from "../three/math";
import { usePalette, useReducedMotion } from "../three/theme";

const TURNS = 3;
const KV = 1.3; // display length of 1 m/s
const KA = 1.4; // display length of 1 m/s²

/**
 * Scene "frenet-helix": uniform motion on a helix x = R cos ωt, y = R sin ωt, z = (p/2π) ωt.
 * v is tangent to the curve; a = −Rω² e_ρ points towards the axis (normal, a_T = 0).
 */
export default function Scene({ params }: { params?: Record<string, unknown> }) {
  const pal = usePalette();
  const reduced = useReducedMotion();
  const [R, setR] = useState(numParam(params, "R", 1.4));
  const [p, setP] = useState(numParam(params, "pitch", 1.1));
  const w = numParam(params, "omega", 0.9);
  const [u, setU] = useState(1.2); // angle ωt
  const [playing, setPlaying] = useState(!reduced);

  const b = p / (2 * Math.PI);
  const z0 = -(p * TURNS) / 2; // centre the helix vertically
  const curve = useMemo(() => {
    const pts: V3[] = [];
    const n = 240;
    for (let i = 0; i <= n; i++) {
      const t = (2 * Math.PI * TURNS * i) / n;
      pts.push([R * Math.cos(t), R * Math.sin(t), z0 + b * t]);
    }
    return pts;
  }, [R, b, z0]);

  const c = Math.cos(u);
  const s = Math.sin(u);
  const M: V3 = [R * c, R * s, z0 + b * u];
  const v: V3 = [-R * w * s, R * w * c, b * w];
  const a: V3 = [-R * w * w * c, -R * w * w * s, 0];

  return (
    <div>
      <SimCanvas camera={[6.6, 2.8, 3]} target={[0, 0, 0]} animate={playing}>
        <Ticker playing={playing} onTick={(dt) => setU((x) => (x + w * dt) % (2 * Math.PI * TURNS))} />
        {/* axis of the helix */}
        <Path points={[[0, 0, z0 - 0.4], [0, 0, z0 + p * TURNS + 0.4]]} color={pal.faint} width={1.2} dashed dash={0.1} />
        <Label position={[0, 0, z0 + p * TURNS + 0.65]} tex="z" color={pal.ink} />
        <Path points={curve} color={pal.ink} width={2} />

        <Point position={M} color={pal.ink} r={0.09} />
        <Label position={add(M, [0, 0, -0.32])} tex="M" color={pal.ink} />
        <Arrow from={M} vec={mul(v, KV)} color={pal.cobalt} label="\vec v" radius={0.036} />
        <Arrow from={M} vec={mul(a, KA)} color={pal.orange} label="\vec a" radius={0.036} />
      </SimCanvas>

      <Panel>
        <Slider label={<>Rayon <Tex tex="R" /></>} value={R} min={0.4} max={2} step={0.01} onChange={setR} display={`${fmt(R)} m`} />
        <Slider label={<>Pas <Tex tex="p" /></>} value={p} min={0.1} max={1.4} step={0.01} onChange={setP} display={`${fmt(p)} m`} />
        <Footer
          playing={playing}
          onToggle={() => setPlaying((x) => !x)}
          result={`v = ${tex(w * Math.hypot(R, b))}\\ \\text{m/s} \\qquad a = ${tex(R * w * w)}\\ \\text{m/s}^2`}
        />
      </Panel>
    </div>
  );
}
