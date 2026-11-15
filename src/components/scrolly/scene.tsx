"use client";

import { createContext, useContext, useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import {
  motionValue,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
  type UseScrollOptions,
} from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Scroll progress shared with every scrolly child (ScrubVideo, reveals, paths...).
 * `progress` runs 0 → 1 across the region. Under reduced motion it is a constant
 * (`restAt`) so the composition shows one complete, still state.
 */
type SceneState = { progress: MotionValue<number>; reduced: boolean };

const SceneContext = createContext<SceneState | null>(null);

export function useScene(): SceneState | null {
  return useContext(SceneContext);
}

/** Progress of the closest scene, or a constant fallback when used outside of one. */
export function useSceneProgress(fallback = 1): MotionValue<number> {
  const scene = useContext(SceneContext);
  const still = useMemo(() => motionValue(fallback), [fallback]);
  return scene?.progress ?? still;
}

/** Maps a sub-range of the scene progress to an output range (clamped). */
export function useSceneRange<T>(range: [number, number], output: [T, T], progress?: MotionValue<number>) {
  const sceneProgress = useSceneProgress();
  return useTransform(progress ?? sceneProgress, range, output, { clamp: true });
}

type Offset = NonNullable<UseScrollOptions["offset"]>;

function useRegionProgress(offset: Offset, restAt: number) {
  const ref = useRef<HTMLElement>(null);
  const reduced = Boolean(useReducedMotion());
  const { scrollYProgress } = useScroll({ target: ref, offset });
  const still = useMemo(() => motionValue(restAt), [restAt]);
  const state = useMemo<SceneState>(
    () => ({ progress: reduced ? still : scrollYProgress, reduced }),
    [reduced, still, scrollYProgress],
  );
  return { ref, state, reduced };
}

/**
 * A tall section whose stage stays pinned to the viewport while the user scrolls
 * through `length` screens. Children read the progress with `useScene()`.
 */
export function StickyScene({
  length = 3,
  restAt = 0.6,
  className,
  stageClassName,
  stageStyle,
  style,
  id,
  children,
  label,
}: {
  /** Scroll distance in viewport heights (≥ 1). */
  length?: number;
  /** Progress shown (frozen) when the visitor prefers reduced motion. */
  restAt?: number;
  className?: string;
  stageClassName?: string;
  /** Pinned stages are their own stacking context: give them a background when children use mix-blend-mode. */
  stageStyle?: CSSProperties;
  style?: CSSProperties;
  id?: string;
  label?: string;
  children: ReactNode;
}) {
  const { ref, state, reduced } = useRegionProgress(["start start", "end end"], restAt);
  return (
    <SceneContext.Provider value={state}>
      <section
        ref={ref}
        id={id}
        aria-label={label}
        className={cn("relative", className)}
        style={{ height: reduced ? "auto" : `${Math.max(1, length) * 100}svh`, ...style }}
      >
        <div className={cn("relative h-svh w-full overflow-hidden", !reduced && "sticky top-0", stageClassName)} style={stageStyle}>
          {children}
        </div>
      </section>
    </SceneContext.Provider>
  );
}

/**
 * A normal-flow region (no pinning) that exposes its progress through the viewport:
 * 0 when its top meets the bottom of the screen, 1 when its bottom leaves the top
 * (override with `offset`).
 */
export function ScrollRegion({
  offset = ["start end", "end start"],
  restAt = 0.5,
  className,
  style,
  id,
  as: Tag = "section",
  children,
}: {
  offset?: Offset;
  restAt?: number;
  className?: string;
  style?: CSSProperties;
  id?: string;
  as?: "section" | "div" | "header" | "footer";
  children: ReactNode;
}) {
  const { ref, state } = useRegionProgress(offset, restAt);
  return (
    <SceneContext.Provider value={state}>
      <Tag ref={ref as React.Ref<HTMLElement & HTMLDivElement>} id={id} className={cn("relative", className)} style={style}>
        {children}
      </Tag>
    </SceneContext.Provider>
  );
}
