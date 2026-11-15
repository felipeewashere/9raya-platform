"use client";

import { MotionConfig } from "motion/react";

/** Every Motion animation in the app follows the OS "reduce motion" setting. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 380, damping: 32 }}>
      {children}
    </MotionConfig>
  );
}
