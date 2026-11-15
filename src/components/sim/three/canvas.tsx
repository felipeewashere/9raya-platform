"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import { OrbitControls } from "@react-three/drei";
import type { V3 } from "./math";
import { usePalette } from "./theme";

/**
 * Shared 3D canvas of the physics scenes: z-up axes (physics convention), orbit controls
 * (mouse and touch), site background, dpr capped at 2. Renders on demand unless `animate`.
 */
export function SimCanvas({
  children,
  camera = [6, 4.5, 4],
  target = [0, 0, 0],
  fov = 38,
  animate = false,
  minDistance = 2,
  maxDistance = 30,
}: {
  children: ReactNode;
  camera?: V3;
  target?: V3;
  fov?: number;
  /** Continuous rendering (an animation is playing). */
  animate?: boolean;
  minDistance?: number;
  maxDistance?: number;
}) {
  const pal = usePalette();
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="relative aspect-[4/3] max-h-[460px] w-full overflow-hidden sm:aspect-video" style={{ background: pal.bg }}>
      <Canvas
        frameloop={animate && inView ? "always" : "demand"}
        dpr={[1, 2]}
        flat
        camera={{ position: camera, up: [0, 0, 1], fov, near: 0.05, far: 200 }}
        gl={{ antialias: true, powerPreference: "low-power" }}
        aria-label="Simulation 3D : faites glisser pour tourner, pincez ou utilisez la molette pour zoomer"
      >
        <color attach="background" args={[pal.bg]} />
        <ambientLight intensity={1.1} />
        <directionalLight position={[4, -3, 8]} intensity={1.6} />
        <KeepWidth fov={fov} />
        <OrbitControls makeDefault target={target} enablePan={false} minDistance={minDistance} maxDistance={maxDistance} />
        {children}
      </Canvas>
    </div>
  );
}

/**
 * Keeps the horizontal field of view of a 16:9 frame on narrower canvases (phones, 4:3),
 * so wide scenes are not cropped on the sides.
 */
function KeepWidth({ fov }: { fov: number }) {
  const { width, height } = useThree((s) => s.size);
  const get = useThree((s) => s.get);
  useEffect(() => {
    const { camera, invalidate } = get();
    const cam = camera as PerspectiveCamera;
    const aspect = width / Math.max(1, height);
    const ref = 16 / 9;
    const t = Math.tan((fov * Math.PI) / 360) * (aspect < ref ? ref / aspect : 1);
    cam.fov = (Math.atan(t) * 360) / Math.PI;
    cam.updateProjectionMatrix();
    invalidate();
  }, [get, width, height, fov]);
  return null;
}

/** Calls `onTick(dt)` every frame while `playing` (dt in seconds, clamped). Put inside <SimCanvas>. */
export function Ticker({ playing, onTick }: { playing: boolean; onTick: (dt: number) => void }) {
  useFrame((_, dt) => {
    if (playing) onTick(Math.min(dt, 1 / 20));
  });
  return null;
}
