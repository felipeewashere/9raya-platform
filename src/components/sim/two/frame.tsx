"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Accent colours, as CSS variables set on the frame (slightly lighter cobalt in dark mode). */
export const C = {
  ink: "currentColor",
  blue: "var(--sim-blue)",
  orange: "var(--sim-orange)",
  green: "var(--sim-green)",
  yellow: "var(--sim-yellow)",
  /** translucent yellow for bands / highlighted zones (lighter in dark mode) */
  band: "var(--sim-band)",
  muted: "var(--muted-foreground)",
} as const;

/** ViewBox size shared by the 2D scenes (16:9). */
export const W = 800;
export const H = 450;

/**
 * Layout of a 2D maths scene: a responsive SVG stage (16:9, at most ~460px tall)
 * and one bar below it — the single control on the left, the single result line on the right.
 */
export function SimFrame({
  children,
  controls,
  info,
  label,
}: {
  /** SVG content, in viewBox units (W × H). */
  children: ReactNode;
  /** The one slider / button of the scene (optional when the interaction is dragging in the figure). */
  controls?: ReactNode;
  /** One short result line (e.g. "N = 11"). */
  info?: ReactNode;
  /** Accessible description of the figure. */
  label: string;
}) {
  return (
    <div
      className={cn(
        "text-foreground",
        "[--sim-blue:#2340ff] [--sim-orange:#ff5b22] [--sim-green:#19b07a] [--sim-yellow:#ffd60a]",
        "[--sim-band:color-mix(in_srgb,#ffd60a_40%,transparent)]",
        "dark:[--sim-blue:#6b7fff] dark:[--sim-green:#2fc98f] dark:[--sim-band:color-mix(in_srgb,#ffd60a_20%,transparent)]",
      )}
    >
      <div className="mx-auto aspect-video max-h-[460px] w-full">
        <svg viewBox={`0 0 ${W} ${H}`} className="block size-full select-none" role="img" aria-label={label} style={{ fontVariantNumeric: "tabular-nums" }}>
          {children}
        </svg>
      </div>
      {(controls || info) && (
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t-2 border-[var(--rule)] px-4 py-3">
          {controls && <div className="flex min-w-[220px] flex-1 flex-wrap items-center gap-3">{controls}</div>}
          {info && (
            <p className="ml-auto font-mono text-lg tabular-nums" aria-live="polite">
              {info}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
