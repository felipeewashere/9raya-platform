"use client";

import { useMemo } from "react";
import katex from "katex";
import { ConeGeometry, CylinderGeometry, Quaternion, SphereGeometry, Vector3 } from "three";
import { Html, Line } from "@react-three/drei";
import { add, mul, norm, type V3 } from "./math";

// Unit geometries shared by every arrow / point (scaled per instance, never rebuilt).
const CYL = new CylinderGeometry(1, 1, 1, 12);
const CONE = new ConeGeometry(1, 1, 18);
const SPHERE = new SphereGeometry(1, 24, 16);
const Y = new Vector3(0, 1, 0);

/** KaTeX math label anchored to a 3D point (site fonts, no network). */
export function Label({
  position,
  tex,
  color,
  size = 19,
}: {
  position: V3;
  tex: string;
  color: string;
  size?: number;
}) {
  const html = useMemo(() => katex.renderToString(tex, { throwOnError: false, output: "html" }), [tex]);
  return (
    <Html position={position} center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
      <span
        className="select-none whitespace-nowrap"
        style={{
          color,
          fontSize: size,
          textShadow: "0 0 3px var(--background), 0 0 3px var(--background), 0 0 6px var(--background)",
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </Html>
  );
}

/**
 * Vector drawn from `from` along `vec` (shaft + cone head), with an optional math label
 * near its tip. A zero vector draws nothing.
 */
export function Arrow({
  from = [0, 0, 0],
  vec,
  color,
  label,
  labelOffset = [0, 0, 0],
  radius = 0.028,
  headLength,
  opacity = 1,
}: {
  from?: V3;
  vec: V3;
  color: string;
  label?: string;
  labelOffset?: V3;
  radius?: number;
  headLength?: number;
  opacity?: number;
}) {
  const len = norm(vec);
  const [vx, vy, vz] = vec;
  const q = useMemo(() => {
    const d = new Vector3(vx, vy, vz);
    return d.lengthSq() > 1e-12 ? new Quaternion().setFromUnitVectors(Y, d.normalize()) : new Quaternion();
  }, [vx, vy, vz]);
  if (len < 1e-4) return null;
  const head = Math.min(headLength ?? radius * 7, len * 0.45);
  const shaft = len - head;
  const transparent = opacity < 1;
  const tip = add(from, mul(vec, 1 + 0.2 / Math.max(len, 0.3)));
  return (
    <>
      <group position={from} quaternion={q}>
        {shaft > 1e-4 && (
          <mesh geometry={CYL} position={[0, shaft / 2, 0]} scale={[radius, shaft, radius]}>
            <meshBasicMaterial color={color} transparent={transparent} opacity={opacity} />
          </mesh>
        )}
        <mesh geometry={CONE} position={[0, shaft + head / 2, 0]} scale={[radius * 2.6, head, radius * 2.6]}>
          <meshBasicMaterial color={color} transparent={transparent} opacity={opacity} />
        </mesh>
      </group>
      {label && <Label position={add(tip, labelOffset)} tex={label} color={color} />}
    </>
  );
}

/** A small sphere (point M, a charge, a bob…). Lit by default so it reads as a volume. */
export function Point({ position, color, r = 0.07, flat = false }: { position: V3; color: string; r?: number; flat?: boolean }) {
  return (
    <mesh geometry={SPHERE} position={position} scale={r}>
      {flat ? <meshBasicMaterial color={color} /> : <meshStandardMaterial color={color} roughness={0.55} />}
    </mesh>
  );
}

/** Polyline (fat line, constant pixel width). `segments`: points taken by pairs. */
export function Path({
  points,
  color,
  width = 1.5,
  dashed = false,
  dash = 0.08,
  opacity = 1,
  segments = false,
}: {
  points: V3[];
  color: string;
  width?: number;
  dashed?: boolean;
  dash?: number;
  opacity?: number;
  segments?: boolean;
}) {
  if (points.length < 2) return null;
  return (
    <Line
      points={points}
      color={color}
      lineWidth={width}
      dashed={dashed}
      dashSize={dash}
      gapSize={dash * 0.8}
      transparent={opacity < 1}
      opacity={opacity}
      segments={segments}
    />
  );
}

const AXES: V3[] = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

/** Cartesian axes x, y, z from the origin (z up), with a faint negative part and labels. */
export function Axes({
  size = 3,
  color,
  faint,
  labels = ["x", "y", "z"],
  negative = true,
}: {
  size?: number;
  color: string;
  faint: string;
  labels?: [string, string, string];
  negative?: boolean;
}) {
  return (
    <group>
      {AXES.map((d, i) => (
        <group key={i}>
          <Arrow vec={mul(d, size)} color={color} radius={0.011} headLength={0.14} />
          {negative && <Path points={[[0, 0, 0], mul(d, -size * 0.6)]} color={faint} width={1} />}
          <Label position={mul(d, size + 0.25)} tex={labels[i]} color={color} size={17} />
        </group>
      ))}
      <Label position={[-0.16, -0.16, -0.12]} tex="O" color={color} size={15} />
    </group>
  );
}

/** Square grid in the plane z = `z` (xOy floor). */
export function FloorGrid({ size = 6, divisions = 12, color, z = 0 }: { size?: number; divisions?: number; color: string; z?: number }) {
  const pts = useMemo(() => {
    const p: V3[] = [];
    const h = size / 2;
    for (let i = 0; i <= divisions; i++) {
      const t = -h + (size * i) / divisions;
      p.push([t, -h, z], [t, h, z], [-h, t, z], [h, t, z]);
    }
    return p;
  }, [size, divisions, z]);
  return <Line points={pts} segments color={color} lineWidth={1} />;
}
