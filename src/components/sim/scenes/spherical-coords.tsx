"use client";

import { useState } from "react";
import { SimCanvas } from "../three/canvas";
import { Arrow, Axes, Label, Path, Point } from "../three/primitives";
import { Footer, Panel, Slider, Tex } from "../three/panel";
import { arc, numParam, rad, tex, type V3 } from "../three/math";
import { usePalette } from "../three/theme";

/** Scene "spherical-coords": point M(r, θ, φ) and the local basis (e_r, e_θ, e_φ). θ and φ vary, r is fixed. */
export default function Scene({ params }: { params?: Record<string, unknown> }) {
  const pal = usePalette();
  const r = numParam(params, "r", 2);
  const [thetaDeg, setThetaDeg] = useState(numParam(params, "theta", 55));
  const [phiDeg, setPhiDeg] = useState(numParam(params, "phi", 40));

  const th = rad(thetaDeg);
  const ph = rad(phiDeg);
  const st = Math.sin(th);
  const ct = Math.cos(th);
  const sp = Math.sin(ph);
  const cp = Math.cos(ph);
  const eR: V3 = [st * cp, st * sp, ct];
  const eTh: V3 = [ct * cp, ct * sp, -st];
  const ePh: V3 = [-sp, cp, 0];
  const u: V3 = [cp, sp, 0]; // horizontal direction of the meridian half-plane
  const M: V3 = [r * eR[0], r * eR[1], r * eR[2]];
  const m: V3 = [M[0], M[1], 0];

  return (
    <div>
      <SimCanvas camera={[3.8, -2.8, 6.4]} target={[0, 0, 0.8]}>
        <Axes size={2.8} color={pal.ink} faint={pal.faint} />

        <Path points={[[0, 0, 0], M]} color={pal.ink} width={2.4} />
        <Path points={[[0, 0, 0], m]} color={pal.faint} width={1.4} dashed dash={0.09} />
        <Path points={[m, M]} color={pal.faint} width={1.4} dashed dash={0.09} />
        <Path points={arc([0, 0, 0], [0, 0, 1], u, 0.75, 0, th, 40)} color={pal.orange} width={2.5} />
        <Path points={arc([0, 0, 0], [1, 0, 0], [0, 1, 0], 0.6, 0, ph, 40)} color={pal.green} width={2.5} />
        <Label position={[1.05 * Math.sin(th / 2) * cp, 1.05 * Math.sin(th / 2) * sp, 1.05 * Math.cos(th / 2)]} tex="\theta" color={pal.orange} />
        <Label position={[0.9 * Math.cos(ph / 2), 0.9 * Math.sin(ph / 2), 0]} tex="\varphi" color={pal.green} />
        <Label position={[M[0] / 2 - 0.2 * eTh[0], M[1] / 2 - 0.2 * eTh[1], M[2] / 2 - 0.2 * eTh[2]]} tex="r" color={pal.ink} />

        <Point position={M} color={pal.ink} r={0.08} />
        <Label position={[M[0] - 0.3 * ePh[0], M[1] - 0.3 * ePh[1], M[2] + 0.25]} tex="M" color={pal.ink} />
        <Arrow from={M} vec={eR} color={pal.cobalt} label="\vec e_r" radius={0.034} />
        <Arrow from={M} vec={eTh} color={pal.orange} label="\vec e_\theta" radius={0.034} />
        <Arrow from={M} vec={ePh} color={pal.green} label="\vec e_\varphi" radius={0.034} />
      </SimCanvas>

      <Panel>
        <Slider label={<>Angle <Tex tex="\theta" /></>} value={thetaDeg} min={0} max={180} step={1} onChange={setThetaDeg} display={`${Math.round(thetaDeg)}°`} />
        <Slider label={<>Angle <Tex tex="\varphi" /></>} value={phiDeg} min={0} max={360} step={1} onChange={setPhiDeg} display={`${Math.round(phiDeg)}°`} />
        <Footer result={`(x,\\ y,\\ z) = (${tex(M[0])}\\ ;\\ ${tex(M[1])}\\ ;\\ ${tex(M[2])})`} />
      </Panel>
    </div>
  );
}
