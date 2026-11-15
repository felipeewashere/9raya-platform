"use client";

import { useState } from "react";
import { SimCanvas, Ticker } from "../three/canvas";
import { Arrow, Label, Path, Point } from "../three/primitives";
import { Footer, Panel, Slider, Tex } from "../three/panel";
import { add, arc, fmt, mul, numParam, rad, tex, type V3 } from "../three/math";
import { usePalette, useReducedMotion } from "../three/theme";

const G = 9.81;
const SCALE = 1.5; // scene units per metre
const KF = 0.9; // scene length of the weight mg (the tension is drawn relative to it)

/** Complete elliptic integral of the first kind K(k), by the arithmetic–geometric mean. */
function ellipK(k: number) {
  let a = 1;
  let b = Math.sqrt(1 - k * k);
  for (let i = 0; i < 12; i++) [a, b] = [(a + b) / 2, Math.sqrt(a * b)];
  return Math.PI / (2 * a);
}

/** One RK4 step of θ̈ = −(g/ℓ) sin θ. */
function step(th: number, om: number, w2: number, h: number) {
  const f = (x: number) => -w2 * Math.sin(x);
  const k1t = om;
  const k1o = f(th);
  const k2t = om + (h / 2) * k1o;
  const k2o = f(th + (h / 2) * k1t);
  const k3t = om + (h / 2) * k2o;
  const k3o = f(th + (h / 2) * k2t);
  const k4t = om + h * k3o;
  const k4o = f(th + h * k3t);
  return [th + (h / 6) * (k1t + 2 * k2t + 2 * k3t + k4t), om + (h / 6) * (k1o + 2 * k2o + 2 * k3o + k4o)] as const;
}

/**
 * Scene "pendulum": simple pendulum (exact equation θ̈ + (g/ℓ) sin θ = 0, RK4), weight P and
 * tension T. The period is compared with the small-angle value T0 = 2π√(ℓ/g).
 */
export default function Scene({ params }: { params?: Record<string, unknown> }) {
  const pal = usePalette();
  const reduced = useReducedMotion();
  const [len, setLen] = useState(numParam(params, "length", 1.5));
  const [th0Deg, setTh0Deg] = useState(numParam(params, "theta0", 30));
  const [st, setSt] = useState({ th: rad(numParam(params, "theta0", 30)), om: 0 });
  const [playing, setPlaying] = useState(!reduced);

  const th0 = rad(th0Deg);
  const w2 = G / len;
  const T0 = 2 * Math.PI * Math.sqrt(len / G);
  const Treal = 4 * Math.sqrt(len / G) * ellipK(Math.sin(th0 / 2));

  const tick = (dt: number) =>
    setSt((s) => {
      let { th, om } = s;
      for (let i = 0; i < 4; i++) [th, om] = step(th, om, w2, dt / 4);
      return { th, om };
    });

  const { th, om } = st;
  const Ls = len * SCALE;
  const O: V3 = [0, 0, 0];
  const eR: V3 = [Math.sin(th), 0, -Math.cos(th)]; // from O towards the bob
  const eT: V3 = [Math.cos(th), 0, Math.sin(th)];
  const M = mul(eR, Ls);
  const tensionOverP = Math.cos(th) + (len * om * om) / G;

  return (
    <div>
      <SimCanvas camera={[0.3, -6.6, -1.2]} target={[0, 0, -1.5]} animate={playing}>
        <Ticker playing={playing} onTick={tick} />
        {/* support and vertical */}
        <mesh position={[0, 0, 0.06]}>
          <boxGeometry args={[1.4, 0.4, 0.12]} />
          <meshStandardMaterial color={pal.faint} />
        </mesh>
        <Path points={[O, [0, 0, -Ls - 0.4]]} color={pal.faint} width={1.2} dashed dash={0.08} />
        <Path points={arc(O, [0, 0, -1], [1, 0, 0], 0.6, 0, th, 24)} color={pal.ink} width={2} />
        <Label position={[0.9 * Math.sin(th / 2), 0, -0.9 * Math.cos(th / 2)]} tex="\theta" color={pal.ink} />

        <Path points={[O, M]} color={pal.ink} width={2.4} />
        <Point position={O} color={pal.ink} r={0.05} flat />
        <Point position={M} color={pal.ink} r={0.16} />
        <Label position={add(M, mul(eT, -0.4))} tex="M" color={pal.ink} />
        <Arrow from={M} vec={[0, 0, -KF]} color={pal.orange} label="\vec P" radius={0.034} />
        <Arrow from={M} vec={mul(eR, -tensionOverP * KF)} color={pal.cobalt} label="\vec T" radius={0.034} labelOffset={[0.22, 0, 0]} />
      </SimCanvas>

      <Panel>
        <Slider
          label={<>Amplitude <Tex tex="\theta_0" /></>}
          value={th0Deg}
          min={2}
          max={170}
          step={1}
          onChange={(x) => {
            setTh0Deg(x);
            setSt({ th: rad(x), om: 0 });
          }}
          display={`${Math.round(th0Deg)}°`}
        />
        <Slider
          label={<>Longueur <Tex tex="\ell" /></>}
          value={len}
          min={0.3}
          max={2}
          step={0.01}
          onChange={(x) => {
            setLen(x);
            setSt({ th: th0, om: 0 });
          }}
          display={`${fmt(len)} m`}
        />
        <Footer
          playing={playing}
          onToggle={() => setPlaying((x) => !x)}
          result={`\\text{Période} = ${tex(Treal)}\\ \\text{s} \\quad (\\text{petits angles : } ${tex(T0)}\\ \\text{s})`}
        />
      </Panel>
    </div>
  );
}
