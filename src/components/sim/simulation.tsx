"use client";

import { lazy, Suspense, useEffect, useRef, useState, type ComponentType, type LazyExoticComponent } from "react";
import { Box } from "lucide-react";
import { SCENE_LOADERS, type SceneProps } from "./registry";
import { SIM_SCENES, type SimScene } from "@/content/sim-scenes";

/** One lazy component per scene, created once at module load (never during render). */
const SCENES = Object.fromEntries(
  (Object.keys(SCENE_LOADERS) as SimScene[]).map((name) => [name, lazy(SCENE_LOADERS[name])]),
) as Record<SimScene, LazyExoticComponent<ComponentType<SceneProps>>>;

/**
 * An interactive simulation inside a lesson or a TD exercise.
 * The scene's code (and three.js for 3D scenes) only loads when the frame scrolls into view.
 */
export function Simulation({ scene, params }: { scene: string; params?: Record<string, unknown>; caption?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const known = scene in SCENE_LOADERS;

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: "300px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);


  return (
    <figure className="not-prose my-6 overflow-hidden border-2 border-[var(--rule)] bg-card">
      <div className="label flex items-center gap-2 bg-foreground px-4 py-2 text-background">
        <Box className="size-4" aria-hidden /> Simulation
        {known && <span className="truncate font-normal opacity-70">— {SIM_SCENES[scene as SimScene].split(" : ")[0]}</span>}
      </div>
      <div ref={ref} className="min-h-[220px]">
        {!known ? (
          <p className="p-4 text-muted-foreground">Simulation inconnue : {scene}</p>
        ) : visible ? (
          <Suspense fallback={<div className="aspect-video animate-pulse bg-muted" />}>
            <LazyScene name={scene as SimScene} params={params} />
          </Suspense>
        ) : (
          <div className="aspect-video bg-muted" />
        )}
      </div>
    </figure>
  );
}

function LazyScene({ name, params }: { name: SimScene; params?: Record<string, unknown> }) {
  const Scene = SCENES[name];
  return <Scene params={params} />;
}
