"use client";

import { useMemo, type ReactNode } from "react";
import katex from "katex";
import { Pause, Play } from "lucide-react";

/** Inline KaTeX. */
export function Tex({ tex, className }: { tex: string; className?: string }) {
  const html = useMemo(() => katex.renderToString(tex, { throwOnError: false, output: "html" }), [tex]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Control panel under the canvas: at most two sliders, then the result line. */
export function Panel({ children }: { children: ReactNode }) {
  return <div className="grid gap-x-8 gap-y-4 border-t-2 border-[var(--rule)] px-4 py-4 sm:grid-cols-2">{children}</div>;
}

/** Labelled range input showing its current value. */
export function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  display,
}: {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  /** Formatted current value (with unit). */
  display: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="flex items-baseline justify-between gap-3 text-base">
        <span className="truncate">{label}</span>
        <span className="shrink-0 font-label text-sm tabular-nums">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-7 w-full cursor-pointer accent-[#2340ff] dark:accent-[#6f82ff]"
      />
    </label>
  );
}

/** Bottom row of the panel: optional play / pause button and the single result line. */
export function Footer({ playing, onToggle, result }: { playing?: boolean; onToggle?: () => void; result: string }) {
  return (
    <div className="col-span-full flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-dashed border-[var(--rule)] pt-3">
      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          className="label inline-flex items-center gap-1.5 border-2 border-[var(--rule)] bg-foreground px-3 py-1.5 text-background"
        >
          {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
          {playing ? "Pause" : "Lecture"}
        </button>
      )}
      <Tex tex={result} className="text-lg" />
    </div>
  );
}
