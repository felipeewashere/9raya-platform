"use client";

import { useCallback, useEffect, useRef } from "react";
import { animate, useReducedMotion } from "motion/react";

/**
 * Tweens a number from `from` to `to`, calling `onUpdate` every frame.
 * With prefers-reduced-motion the final value is applied at once.
 * Returns [run, stop, reduced]; a new run cancels the previous one.
 */
export function useTween() {
  const reduce = useReducedMotion();
  const ctrl = useRef<{ stop: () => void } | null>(null);
  const stop = useCallback(() => {
    ctrl.current?.stop();
    ctrl.current = null;
  }, []);
  useEffect(() => stop, [stop]);
  const run = useCallback(
    (from: number, to: number, onUpdate: (v: number) => void, opts: { duration?: number; onComplete?: () => void } = {}) => {
      stop();
      if (reduce) {
        onUpdate(to);
        opts.onComplete?.();
        return;
      }
      ctrl.current = animate(from, to, {
        duration: opts.duration ?? 1.2,
        ease: "easeInOut",
        onUpdate,
        onComplete: () => {
          ctrl.current = null;
          opts.onComplete?.();
        },
      });
    },
    [reduce, stop],
  );
  return [run, stop, !!reduce] as const;
}
