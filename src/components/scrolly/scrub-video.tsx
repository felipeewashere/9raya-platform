"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useReducedMotion, type MotionValue } from "motion/react";
import { cn } from "@/lib/utils";
import { withBase } from "@/lib/base-path";
import { useSceneProgress } from "./scene";

export type ScrubClip = {
  /** All-intra MP4 (every frame a keyframe) so any frame can be shown instantly. */
  src: string;
  /** Still frame shown before loading and under reduced motion. */
  poster: string;
};

/**
 * A muted video whose current frame follows scroll progress (Apple product-page style).
 *
 * - progress comes from the `progress` prop or from the enclosing StickyScene / ScrollRegion;
 * - `range` picks the slice of progress that plays the whole clip (clamped outside);
 * - frame updates run in requestAnimationFrame, only while the video is near the viewport,
 *   with light smoothing so wheel steps don't look jerky;
 * - the file is only requested when the element comes close to the viewport;
 * - prefers-reduced-motion shows the poster image, no scrubbing.
 */
export function ScrubVideo({
  clip,
  progress,
  range = [0, 1],
  reverse = false,
  smoothing = 0.22,
  fit = "cover",
  className,
  style,
}: {
  clip: ScrubClip;
  progress?: MotionValue<number>;
  range?: [number, number];
  /** Play the clip backwards as progress grows. */
  reverse?: boolean;
  /** 0..1: fraction of the remaining distance covered each frame (1 = no smoothing). */
  smoothing?: number;
  fit?: "cover" | "contain";
  className?: string;
  style?: CSSProperties;
}) {
  const sceneProgress = useSceneProgress(1);
  const source = progress ?? sceneProgress;
  const reduced = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const [requested, setRequested] = useState(false);

  // Lazy load + pause work offscreen.
  useEffect(() => {
    const el = videoRef.current;
    if (!el || reduced) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setNear(entry.isIntersecting);
        if (entry.isIntersecting) setRequested(true);
      },
      { rootMargin: "60% 0px 60% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  // Frame loop.
  const [r0, r1] = range;
  useEffect(() => {
    const video = videoRef.current;
    if (!video || reduced || !near) return;
    let raf = 0;
    let shown = -1;
    let primed = false;

    const prime = () => {
      // iOS Safari only paints seeked frames after the element has played once.
      if (primed) return;
      primed = true;
      const p = video.play();
      if (p) p.then(() => video.pause()).catch(() => {});
    };
    if (video.readyState >= 1) prime();
    else video.addEventListener("loadedmetadata", prime, { once: true });

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const duration = video.duration;
      if (!duration || Number.isNaN(duration) || video.readyState < 1) return;
      const span = r1 - r0 || 1;
      let t = Math.min(1, Math.max(0, (source.get() - r0) / span));
      if (reverse) t = 1 - t;
      // stay a hair before the end: seeking to `duration` can show a black frame
      const target = t * Math.max(0, duration - 0.05);
      if (shown < 0) shown = target;
      else shown += (target - shown) * smoothing;
      if (Math.abs(target - shown) < 0.004) shown = target;
      if (!video.seeking && Math.abs(video.currentTime - shown) > 0.012) {
        if (!video.paused) video.pause();
        video.currentTime = shown;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      video.removeEventListener("loadedmetadata", prime);
    };
  }, [near, reduced, source, r0, r1, reverse, smoothing]);

  const fitClass = fit === "cover" ? "object-cover" : "object-contain";

  if (reduced) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={withBase(clip.poster)} alt="" aria-hidden className={cn(fitClass, className)} style={style} />;
  }

  return (
    <video
      ref={videoRef}
      src={requested ? withBase(clip.src) : undefined}
      poster={withBase(clip.poster)}
      muted
      playsInline
      preload={requested ? "auto" : "none"}
      disablePictureInPicture
      disableRemotePlayback
      aria-hidden
      tabIndex={-1}
      className={cn(fitClass, "pointer-events-none select-none", className)}
      style={style}
    />
  );
}
