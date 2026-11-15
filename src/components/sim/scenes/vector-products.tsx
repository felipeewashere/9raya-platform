"use client";

import { useState } from "react";
import { DoubleSide, Matrix4, PlaneGeometry, Vector3 } from "three";
import { SimCanvas } from "../three/canvas";
import { Arrow, Axes, Label, Path } from "../three/primitives";
import { Footer, Panel, Slider, Tex } from "../three/panel";
import { add, arc, cross, dot, fmt, mul, norm, numParam, rad, tex, unit, type V3 } from "../three/math";
import { usePalette } from "../three/theme";

// Unit square [0,1]², mapped onto the parallelogram (a, b) by a basis matrix.
const SQUARE = new PlaneGeometry(1, 1).translate(0.5, 0.5, 0);

/**
 * Scene "vector-products": a fixed on Ox, b in the plane xOy at angle θ.
 * a·b (sign with the angle) and a∧b (normal to the plane, length = area of the parallelogram).
 */
export default function Scene({ params }: { params?: Record<string, unknown> }) {
  const pal = usePalette();
  const na = numParam(params, "a", 1.8);
  const [nb, setNb] = useState(numParam(params, "b", 1.5));
  const [thDeg, setThDeg] = useState(numParam(params, "alpha", 60));

  const th = rad(thDeg);
  const a: V3 = [na, 0, 0];
  const b: V3 = [nb * Math.cos(th), nb * Math.sin(th), 0];
  const ab = dot(a, b);
  const c = cross(a, b);
  const area = norm(c);
  const angle = Math.acos(Math.max(-1, Math.min(1, ab / (na * nb))));
  const n = area > 1e-6 ? unit(c) : ([0, 0, 1] as V3);
  const matrix = new Matrix4().makeBasis(new Vector3(...a), new Vector3(...b), new Vector3(...n));

  // angle arc from a to b, in their plane
  const ua: V3 = [1, 0, 0];
  const vperp = unit(cross(n, ua));
  const angMid = add(mul(ua, 0.75 * Math.cos(angle / 2)), mul(vperp, 0.75 * Math.sin(angle / 2)));

  return (
    <div>
      <SimCanvas camera={[3, -5, 3.2]} target={[0.5, 0.5, 0.9]}>
        <Axes size={2.4} color={pal.faint} faint={pal.faint} negative={false} labels={["x", "y", ""]} />

        <mesh geometry={SQUARE} matrix={matrix} matrixAutoUpdate={false}>
          <meshBasicMaterial color={pal.yellow} transparent opacity={0.3} side={DoubleSide} depthWrite={false} />
        </mesh>
        <Path points={arc([0, 0, 0], ua, vperp, 0.5, 0, angle, 32)} color={pal.ink} width={2} />
        <Label position={angMid} tex="\theta" color={pal.ink} />

        <Arrow vec={a} color={pal.cobalt} label="\vec a" radius={0.04} />
        <Arrow vec={b} color={pal.orange} label="\vec b" radius={0.04} />
        <Arrow vec={c} color={pal.green} label="\vec a\wedge\vec b" radius={0.04} />
      </SimCanvas>

      <Panel>
        <Slider label={<>Angle <Tex tex="\theta" /></>} value={thDeg} min={0} max={360} step={1} onChange={setThDeg} display={`${Math.round(thDeg)}°`} />
        <Slider label={<>Longueur de <Tex tex="\vec b" /></>} value={nb} min={0.3} max={2} step={0.01} onChange={setNb} display={fmt(nb)} />
        <Footer result={`\\vec a\\cdot\\vec b = ${tex(ab)} \\qquad \\|\\vec a\\wedge\\vec b\\| = ${tex(area)}`} />
      </Panel>
    </div>
  );
}
