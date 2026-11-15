"use client";

import { useSyncExternalStore } from "react";

function subscribeDark(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => mo.disconnect();
}

/** True when the site is in dark mode (`.dark` on <html>), kept in sync with theme switches. */
export function useIsDark() {
  return useSyncExternalStore(
    subscribeDark,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
}

const RM = "(prefers-reduced-motion: reduce)";
function subscribeRM(cb: () => void) {
  const mq = window.matchMedia(RM);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** True when the visitor asked for reduced motion: animations start paused. */
export function useReducedMotion() {
  return useSyncExternalStore(subscribeRM, () => window.matchMedia(RM).matches, () => true);
}

export type Palette = {
  dark: boolean;
  bg: string;
  ink: string;
  /** Faint ink: grids, construction lines. */
  faint: string;
  cobalt: string;
  orange: string;
  green: string;
  yellow: string;
  /** Translucent surfaces (cylinders, spheres, Gauss surfaces). */
  surface: string;
};

const LIGHT: Palette = {
  dark: false,
  bg: "#efede6",
  ink: "#0e0e0e",
  faint: "#b8b4a8",
  cobalt: "#2340ff",
  orange: "#ff5b22",
  green: "#139466",
  yellow: "#d9a900",
  surface: "#2340ff",
};

const DARK: Palette = {
  dark: true,
  bg: "#0e0e0e",
  ink: "#efede6",
  faint: "#3d3d3a",
  cobalt: "#6f82ff",
  orange: "#ff6d3a",
  green: "#19b07a",
  yellow: "#ffd60a",
  surface: "#6f82ff",
};

/** Site colours for 3D scenes (cobalt / orange / green / yellow on paper or ink). */
export function usePalette(): Palette {
  return useIsDark() ? DARK : LIGHT;
}
