"use client";

import { useId, type ReactNode } from "react";

/** A labelled range input with its live value. */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  /** Formatted value shown next to the label. */
  display?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex min-w-[200px] flex-1 flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[0.95rem]">
          {label}
        </label>
        <output htmlFor={id} className="font-mono text-sm tabular-nums">
          {display ?? value}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-6 w-full cursor-pointer accent-[var(--sim-blue)]"
      />
    </div>
  );
}

/** A plain action button. */
export function Btn({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="label min-h-9 border-2 border-[var(--rule)] px-3 py-1.5 hover:bg-foreground hover:text-background disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}
