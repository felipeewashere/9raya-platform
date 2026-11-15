"use client";

import { useState } from "react";
import { SimCanvas } from "../three/canvas";
import { Arrow, Axes, Label, Path, Point } from "../three/primitives";
import { Footer, Panel, Slider, Tex } from "../three/panel";
import { arc, fmt, numParam, rad, tex, type V3 } from "../three/math";
import { usePalette } from "../three/theme";

/** Scene "cylindrical-coords": point M(ρ, φ, z) and the local basis (e_ρ, e_φ, e_z). ρ and φ vary, z is fixed. */
export default function Scene({ params }: { params?: Record<string, unknown> }) {
  const pal = usePalette();
  const [rho, setRho] = useState(numParam(params, "rho", 1.8));
  const [phiDeg, setPhiDeg] = useState(numParam(params, "phi", 50));
  const z = numParam(params, "z", 1.4);

  const phi = rad(phiDeg);
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  const M: V3 = [rho * c, rho * s, z];
  const m: V3 = [rho * c, rho * s, 0];
  const mid = phi / 2;

  return (
    <div>
      <SimCanvas camera={[6.3, 1.2, 4.2]} target={[0, 0, 0.8]}>
        <Axes size={2.8} color={pal.ink} faint={pal.faint} />

        {/* ρ on the floor, then z up to M */}
        <Path points={[[0, 0, 0], m]} color={pal.ink} width={2} dashed dash={0.09} />
        <Path points={[m, M]} color={pal.ink} width={2} dashed dash={0.09} />
        <Path points={arc([0, 0, 0], [1, 0, 0], [0, 1, 0], 0.6, 0, phi, 40)} color={pal.orange} width={2.5} />
        <Label position={[0.9 * Math.cos(mid), 0.9 * Math.sin(mid), 0]} tex="\varphi" color={pal.orange} />
        <Label position={[(rho / 2) * c + 0.2 * s, (rho / 2) * s - 0.2 * c, 0]} tex="\rho" color={pal.ink} />
        <Label position={[m[0] + 0.25 * c, m[1] + 0.25 * s, z / 2]} tex="z" color={pal.ink} />

        <Point position={M} color={pal.ink} r={0.08} />
        <Label position={[M[0] - 0.25 * c, M[1] - 0.25 * s, M[2] + 0.25]} tex="M" color={pal.ink} />

        <Arrow from={M} vec={[c, s, 0]} color={pal.cobalt} label="\vec e_\rho" radius={0.034} />
        <Arrow from={M} vec={[-s, c, 0]} color={pal.orange} label="\vec e_\varphi" radius={0.034} />
        <Arrow from={M} vec={[0, 0, 1]} color={pal.green} label="\vec e_z" radius={0.034} />
      </SimCanvas>

      <Panel>
        <Slider label={<>Distance <Tex tex="\rho" /></>} value={rho} min={0.3} max={2.6} step={0.01} onChange={setRho} display={fmt(rho)} />
        <Slider label={<>Angle <Tex tex="\varphi" /></>} value={phiDeg} min={0} max={360} step={1} onChange={setPhiDeg} display={`${Math.round(phiDeg)}°`} />
        <Footer result={`(x,\\ y,\\ z) = (${tex(M[0])}\\ ;\\ ${tex(M[1])}\\ ;\\ ${tex(z)})`} />
      </Panel>
    </div>
  );
}
