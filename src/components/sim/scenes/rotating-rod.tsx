"use client";

import { useMemo, useState } from "react";
import { SimCanvas, Ticker } from "../three/canvas";
import { Arrow, Label, Path, Point } from "../three/primitives";
import { Footer, Panel, Slider, Tex } from "../three/panel";
import { add, fmt, mul, numParam, tex, type V3 } from "../three/math";
import { usePalette, useReducedMotion } from "../three/theme";

const L = 2.8; // half-length of the rod (m)
const R0 = 0.4; // starting point of the ring on the rod (m)
const KV = 1.5; // display length of 1 m/s

/**
 * Scene "rotating-rod": a ring slides at constant speed u along a rod rotating at ω about Oz.
 * v_r = u e_r (relative, along the rod), v_e = rω e_θ (entraînement), v_a = v_r + v_e (absolue).
 */
export default function Scene({ params }: { params?: Record<string, unknown> }) {
  const pal = usePalette();
  const reduced = useReducedMotion();
  const [w, setW] = useState(numParam(params, "omega", 0.8));
  const [u, setU] = useState(numParam(params, "u", 0.5));
  const [clock, setClock] = useState({ t: 2.4, th0: 0.3 }); // time since start, rod angle at start
  const [playing, setPlaying] = useState(!reduced);

  const { t, th0 } = clock;
  const r = R0 + u * t;
  const th = th0 + w * t;
  const eR: V3 = [Math.cos(th), Math.sin(th), 0];
  const eT: V3 = [-Math.sin(th), Math.cos(th), 0];
  const M = mul(eR, r);
  const vr = mul(eR, u);
  const ve = mul(eT, r * w);
  const va = add(vr, ve);

  const tick = (dt: number) =>
    setClock(({ t: t0, th0: a0 }) => {
      const t1 = t0 + dt;
      if (R0 + u * t1 > L) return { t: 0, th0: (a0 + w * t1) % (2 * Math.PI) };
      return { t: t1, th0: a0 };
    });

  // path followed by the ring in the fixed frame since the start (a spiral)
  const traj = useMemo(() => {
    const pts: V3[] = [];
    const n = 100;
    for (let i = 0; i <= n; i++) {
      const s = (t * i) / n;
      const a = th0 + w * s;
      pts.push([(R0 + u * s) * Math.cos(a), (R0 + u * s) * Math.sin(a), 0]);
    }
    return pts;
  }, [t, th0, w, u]);

  return (
    <div>
      <SimCanvas camera={[0.3, -5, 4.6]} target={[0, 0, 0.2]} animate={playing}>
        <Ticker playing={playing} onTick={tick} />
        {/* rotation axis and ω */}
        <Arrow from={[0, 0, 0]} vec={[0, 0, 0.8 + w * 0.8]} color={pal.ink} radius={0.026} label="\vec\omega" labelOffset={[0.3, 0, -0.1]} />
        {/* rod and ring */}
        <group rotation={[0, 0, th]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.03, 0.03, 2 * L, 10]} />
            <meshStandardMaterial color={pal.ink} />
          </mesh>
          <mesh position={[r, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.12, 0.04, 12, 32]} />
            <meshStandardMaterial color={pal.yellow} roughness={0.5} />
          </mesh>
        </group>
        <Point position={[0, 0, 0]} color={pal.ink} r={0.07} />
        <Path points={traj} color={pal.faint} width={1.6} dashed dash={0.07} />
        <Label position={add(M, mul(eR, -0.4))} tex="M" color={pal.ink} />

        <Arrow from={M} vec={mul(vr, KV)} color={pal.green} label="\vec v_r" radius={0.03} />
        <Arrow from={M} vec={mul(ve, KV)} color={pal.orange} label="\vec v_e" radius={0.03} />
        <Arrow from={M} vec={mul(va, KV)} color={pal.cobalt} label="\vec v_a" radius={0.04} />
      </SimCanvas>

      <Panel>
        <Slider label={<>Rotation <Tex tex="\omega" /></>} value={w} min={0.1} max={2} step={0.01} onChange={setW} display={`${fmt(w)} rad/s`} />
        <Slider label={<>Glissement <Tex tex="u" /></>} value={u} min={0.1} max={1.5} step={0.01} onChange={setU} display={`${fmt(u)} m/s`} />
        <Footer
          playing={playing}
          onToggle={() => setPlaying((x) => !x)}
          result={`v_a = ${tex(Math.hypot(u, r * w))}\\ \\text{m/s}`}
        />
      </Panel>
    </div>
  );
}
