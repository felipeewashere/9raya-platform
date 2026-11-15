"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, useMotionTemplate, useTransform } from "motion/react";
import { cn } from "@/lib/utils";
import { StickyScene, useScene } from "./scene";
import { timeline } from "./track-timeline";

export { trackPanelRange } from "./track-timeline";

function Track({ panels, dwell, className, children }: { panels: number; dwell: number; className?: string; children: ReactNode }) {
  const scene = useScene();
  const ref = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setDistance(Math.max(0, el.scrollWidth - el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, []);
  const { input, output } = useMemo(() => timeline(panels, dwell), [panels, dwell]);
  const along = useTransform(scene!.progress, input, output, { clamp: true });
  const shift = useTransform(along, (v) => -v * distance);
  const x = useMotionTemplate`${shift}px`;
  if (scene?.reduced) {
    return <div className={cn("flex h-full snap-x snap-mandatory overflow-x-auto [&>*]:snap-start", className)}>{children}</div>;
  }
  return (
    <div ref={ref} className="h-full w-full overflow-hidden">
      <motion.div className={cn("flex h-full w-max will-change-transform", className)} style={{ x }}>
        {children}
      </motion.div>
    </div>
  );
}

/**
 * Vertical scroll drives a horizontal strip of `panels` viewport-wide panels, pinned
 * while it moves. Children read the scene progress with useScene(); use
 * trackPanelRange(i, panels, dwell) to time things inside panel i.
 * Under reduced motion it becomes a native horizontal scroller with snap points.
 */
export function HorizontalTrack({
  panels,
  dwell = 0,
  className,
  trackClassName,
  id,
  label,
  children,
}: {
  panels: number;
  /** screens of scroll each panel stays still */
  dwell?: number;
  className?: string;
  trackClassName?: string;
  id?: string;
  label?: string;
  children: ReactNode;
}) {
  const { total } = timeline(panels, dwell);
  return (
    <StickyScene length={total + 1} restAt={1} className={className} id={id} label={label}>
      <Track panels={panels} dwell={dwell} className={trackClassName}>
        {children}
      </Track>
    </StickyScene>
  );
}
