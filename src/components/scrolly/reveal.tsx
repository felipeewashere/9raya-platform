"use client";

import { motion, useMotionTemplate, useTransform, type MotionValue } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useScene, useSceneProgress } from "./scene";

type Track<T> = { at: number[]; to: T[] };

function useTrack(progress: MotionValue<number>, track: Track<number> | undefined, rest: number) {
  return useTransform(progress, track?.at ?? [0, 1], track?.to ?? [rest, rest], { clamp: true });
}

const LAYER_TAGS = { div: motion.div, li: motion.li, span: motion.span } as const;

/**
 * A block whose transform / opacity follows the scene progress.
 * Each track maps progress stops (`at`) to values (`to`); omitted tracks stay neutral.
 * Only compositor-friendly properties (transform, opacity).
 */
export function SceneLayer({
  opacity,
  x,
  y,
  scale,
  rotate,
  unit = "px",
  as = "div",
  className,
  style,
  children,
  progress,
}: {
  opacity?: Track<number>;
  x?: Track<number>;
  y?: Track<number>;
  scale?: Track<number>;
  rotate?: Track<number>;
  /** unit for x / y */
  unit?: "px" | "%" | "vw" | "vh";
  /** element to render (li inside lists, span inside text) */
  as?: "div" | "li" | "span";
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  progress?: MotionValue<number>;
}) {
  const scene = useScene();
  const sceneProgress = useSceneProgress();
  const p = progress ?? sceneProgress;
  const o = useTrack(p, opacity, 1);
  const tx = useTrack(p, x, 0);
  const ty = useTrack(p, y, 0);
  const s = useTrack(p, scale, 1);
  const r = useTrack(p, rotate, 0);
  const xs = useMotionTemplate`${tx}${unit}`;
  const ys = useMotionTemplate`${ty}${unit}`;
  const Tag = LAYER_TAGS[as];
  return (
    <Tag className={className} style={scene?.reduced ? style : { ...style, opacity: o, x: xs, y: ys, scale: s, rotate: r }}>
      {children}
    </Tag>
  );
}

/** A line of type that slides up out of a mask over `at` (progress range). */
export function MaskReveal({
  at = [0, 0.2],
  from = 110,
  className,
  innerClassName,
  children,
  progress,
}: {
  at?: [number, number];
  /** start offset in % of the line height (negative = from above) */
  from?: number;
  className?: string;
  innerClassName?: string;
  children: ReactNode;
  progress?: MotionValue<number>;
}) {
  const scene = useScene();
  const sceneProgress = useSceneProgress();
  const y = useTransform(progress ?? sceneProgress, at, [`${from}%`, "0%"], { clamp: true });
  return (
    <span className={cn("block overflow-hidden", className)}>
      <motion.span className={cn("block will-change-transform", innerClassName)} style={scene?.reduced ? undefined : { y }}>
        {children}
      </motion.span>
    </span>
  );
}

/** Content that is uncovered left → right (or top → bottom) as if written. Good for KaTeX. */
export function WipeReveal({
  at = [0, 0.3],
  direction = "right",
  className,
  children,
  progress,
}: {
  at?: [number, number];
  direction?: "right" | "down";
  className?: string;
  children: ReactNode;
  progress?: MotionValue<number>;
}) {
  const scene = useScene();
  const sceneProgress = useSceneProgress();
  const hidden = useTransform(progress ?? sceneProgress, at, [100, 0], { clamp: true });
  const clipRight = useMotionTemplate`inset(-20% ${hidden}% -20% -2%)`;
  const clipDown = useMotionTemplate`inset(-2% -2% ${hidden}% -2%)`;
  const clip = direction === "right" ? clipRight : clipDown;
  return (
    <motion.div className={className} style={scene?.reduced ? undefined : { clipPath: clip }}>
      {children}
    </motion.div>
  );
}

function Word({ word, progress, at, dim }: { word: string; progress: MotionValue<number>; at: [number, number]; dim: number }) {
  const opacity = useTransform(progress, at, [dim, 1], { clamp: true });
  return (
    <motion.span style={{ opacity }} className="inline-block whitespace-pre">
      {word}
    </motion.span>
  );
}

/** Words light up one after the other across `at`. */
export function ScrollWords({
  text,
  at = [0, 0.5],
  dim = 0.12,
  className,
  progress,
}: {
  text: string;
  at?: [number, number];
  dim?: number;
  className?: string;
  progress?: MotionValue<number>;
}) {
  const scene = useScene();
  const sceneProgress = useSceneProgress();
  const p = progress ?? sceneProgress;
  const words = text.split(/(\s+)/).filter(Boolean);
  if (scene?.reduced) return <span className={className}>{text}</span>;
  const step = (at[1] - at[0]) / Math.max(1, words.length);
  return (
    <span className={className}>
      {words.map((w, i) => (
        <Word key={i} word={w} progress={p} at={[at[0] + i * step, at[0] + (i + 1) * step]} dim={dim} />
      ))}
    </span>
  );
}

/** An SVG path that draws itself across `at`. Put it inside your own <svg>. */
type PathProps = {
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeLinecap?: "round" | "butt" | "square";
  strokeLinejoin?: "round" | "miter" | "bevel";
  vectorEffect?: "non-scaling-stroke" | "none";
  filter?: string;
  className?: string;
};

export function DrawPath({ at = [0, 0.4], progress, ...props }: { at?: [number, number]; progress?: MotionValue<number> } & PathProps) {
  const scene = useScene();
  const sceneProgress = useSceneProgress();
  const length = useTransform(progress ?? sceneProgress, at, [0, 1], { clamp: true });
  const opacity = useTransform(length, [0, 0.02], [0, 1]);
  if (scene?.reduced) return <path {...props} />;
  return <motion.path {...props} style={{ pathLength: length, opacity }} />;
}
