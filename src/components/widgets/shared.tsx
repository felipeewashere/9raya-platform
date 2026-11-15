"use client";

import * as React from "react";
import { animate, useReducedMotion } from "motion/react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tex } from "@/components/math/md";

/** Card around every widget. `min-w-0` + inner overflow keep wide content from scrolling the page. */
export function WidgetFrame({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <section
      aria-label={label}
      className={cn(
        "@container min-w-0 max-w-full space-y-3 rounded-md border border-primary/25 bg-background p-3 text-card-foreground sm:p-4",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function Toolbar({ className, children, label }: { className?: string; children: React.ReactNode; label?: string }) {
  return (
    <div role="toolbar" aria-label={label} className={cn("flex flex-wrap items-center gap-2", className)}>
      {children}
    </div>
  );
}

/** Small pill-like toggle button (aria-pressed). */
export function ToggleChip({
  pressed,
  onPressedChange,
  children,
  className,
  ...rest
}: Omit<React.ComponentProps<"button">, "onChange"> & { pressed: boolean; onPressedChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        pressed
          ? "border-primary bg-brand-soft text-primary"
          : "border-border bg-background text-foreground hover:bg-muted dark:bg-input/30",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

type Tone = "neutral" | "success" | "danger" | "info" | "highlight";

const toneClass: Record<Tone, string> = {
  neutral: "border-border bg-muted text-foreground",
  success: "border-success/30 bg-success-soft text-foreground",
  danger: "border-danger/30 bg-danger-soft text-foreground",
  info: "border-primary/25 bg-brand-soft text-foreground",
  highlight: "border-reward/50 bg-reward-soft text-foreground",
};

export function Feedback({
  tone = "neutral",
  children,
  className,
  live = true,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
  live?: boolean;
}) {
  return (
    <div
      role={live ? "status" : undefined}
      className={cn("rounded-lg border px-3 py-2 text-sm leading-relaxed [overflow-wrap:anywhere]", toneClass[tone], className)}
    >
      {children}
    </div>
  );
}

/** ✓ / ≠ icon with an accessible label. */
export function Verdict({ ok, okLabel = "égal", koLabel = "différent" }: { ok: boolean; okLabel?: string; koLabel?: string }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 font-medium text-success">
      <Check className="size-4" aria-hidden />
      <span className="sr-only">{okLabel}</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 font-medium text-danger">
      <X className="size-4" aria-hidden />
      <span className="sr-only">{koLabel}</span>
    </span>
  );
}

/** Slider + number field, linked. `texLabel` is rendered with KaTeX. */
export function NumberSlider({
  id,
  texLabel,
  ariaLabel,
  value,
  onChange,
  min,
  max,
  step,
  inputStep,
  integer = false,
  className,
}: {
  id: string;
  texLabel: string;
  ariaLabel: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  inputStep?: number;
  integer?: boolean;
  className?: string;
}) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const commit = (raw: string) => {
    const v = Number(raw.replace(",", ".").replace("−", "-"));
    if (raw.trim() !== "" && Number.isFinite(v)) onChange(integer ? Math.round(v) : v);
    setDraft(null);
  };
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <label htmlFor={`${id}-n`} className="w-8 shrink-0 text-right">
        <Tex>{texLabel}</Tex>
      </label>
      <input
        type="range"
        aria-label={ariaLabel}
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, value))}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-6 min-w-0 flex-1 cursor-pointer accent-primary"
      />
      <input
        id={`${id}-n`}
        inputMode={integer ? "numeric" : "decimal"}
        aria-label={`${ariaLabel} (valeur)`}
        value={draft ?? String(value).replace(".", ",")}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const s = inputStep ?? step;
            onChange(Number((value + (e.key === "ArrowUp" ? s : -s)).toFixed(6)));
            setDraft(null);
          }
        }}
        className="h-8 w-16 shrink-0 rounded-lg border border-input bg-transparent px-2 text-center text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      />
    </div>
  );
}

/** Compact numeric text field accepting "1,5", "-2", "3/4". */
export function NumberField({
  value,
  onChange,
  ariaLabel,
  readOnly,
  className,
  step,
}: {
  value: number;
  onChange: (v: number) => void;
  ariaLabel: string;
  readOnly?: boolean;
  className?: string;
  /** When set, ArrowUp / ArrowDown change the value by this step. */
  step?: number;
}) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const commit = (raw: string) => {
    const s = raw.trim().replace(",", ".").replace("−", "-");
    let v = NaN;
    const m = s.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
    if (m) v = Number(m[1]) / Number(m[2]);
    else if (s !== "") v = Number(s);
    if (Number.isFinite(v)) onChange(v);
    setDraft(null);
  };
  return (
    <input
      inputMode="decimal"
      aria-label={ariaLabel}
      readOnly={readOnly}
      value={draft ?? String(Number(value.toPrecision(10))).replace(".", ",")}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
        if (step && !readOnly && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
          e.preventDefault();
          onChange(Number((value + (e.key === "ArrowUp" ? step : -step)).toFixed(6)));
          setDraft(null);
        }
      }}
      className={cn(
        "h-9 w-14 rounded-md border border-input bg-background text-center text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
        readOnly && "cursor-default border-transparent bg-muted",
        className,
      )}
    />
  );
}

/** A matrix drawn as an HTML grid between brackets; each cell is TeX. */
export function MatrixView({
  cells,
  cellClass,
  label,
  className,
}: {
  cells: string[][];
  cellClass?: (i: number, j: number) => string | undefined;
  label?: string;
  className?: string;
}) {
  const cols = cells[0]?.length ?? 0;
  return (
    <div role="img" aria-label={label} className={cn("relative inline-flex shrink-0 px-2 py-1", className)}>
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 rounded-l-md border-y-2 border-l-2 border-foreground/70" />
      <span aria-hidden className="absolute inset-y-0 right-0 w-1.5 rounded-r-md border-y-2 border-r-2 border-foreground/70" />
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(2.25rem, auto))` }}>
        {cells.map((row, i) =>
          row.map((c, j) => (
            <div
              key={`${i}-${j}`}
              className={cn(
                "flex min-h-8 items-center justify-center rounded-md px-1.5 py-0.5 text-sm tabular-nums transition-colors duration-200",
                cellClass?.(i, j),
              )}
            >
              <Tex>{c}</Tex>
            </div>
          )),
        )}
      </div>
    </div>
  );
}

/**
 * Smoothly tweens a numeric array towards `target` (motion's `animate`). Under reduced motion,
 * returns the target directly. `replay(from)` restarts the tween from another state.
 */
export function useTween(target: number[], duration = 0.45) {
  const reduce = useReducedMotion();
  const [value, setValue] = React.useState<number[]>(target);
  const current = React.useRef<number[]>(target);
  const controls = React.useRef<{ stop: () => void } | null>(null);
  const key = target.join("|");

  const run = React.useCallback((from: number[], to: number[], dur: number) => {
    controls.current?.stop();
    controls.current = animate(0, 1, {
      duration: dur,
      ease: "easeInOut",
      onUpdate: (p) => {
        const v = p >= 1 ? to : to.map((t, i) => (from[i] ?? t) + (t - (from[i] ?? t)) * p);
        current.current = v;
        setValue(v);
      },
    });
  }, []);

  React.useEffect(() => {
    if (reduce) {
      current.current = target;
      return;
    }
    if (current.current.join("|") === key) return;
    run(current.current, target, duration);
    return () => controls.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reduce]);

  const replay = React.useCallback(
    (from: number[], dur = 1.2) => {
      if (reduce) return;
      current.current = from;
      setValue(from);
      run(from, target, dur);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, reduce, run],
  );

  return { value: reduce ? target : value, replay, animating: !reduce && value.join("|") !== key };
}

// ------------------------------------------------------------------ SVG plane

/** Maps math coordinates in [-extent, extent]² to an SVG square of side `size`. */
export function makePlane(extent: number, size = 400) {
  const unit = size / (2 * extent);
  return {
    size,
    unit,
    extent,
    sx: (x: number) => size / 2 + x * unit,
    sy: (y: number) => size / 2 - y * unit,
  };
}
export type Plane = ReturnType<typeof makePlane>;

/** Background grid + axes. */
export function PlaneGrid({ plane, faint = false }: { plane: Plane; faint?: boolean }) {
  const { extent, sx, sy, size } = plane;
  const k = Math.floor(extent);
  const lines = [];
  for (let i = -k; i <= k; i++) {
    if (i === 0) continue;
    lines.push(
      <line key={`v${i}`} x1={sx(i)} x2={sx(i)} y1={0} y2={size} />,
      <line key={`h${i}`} x1={0} x2={size} y1={sy(i)} y2={sy(i)} />,
    );
  }
  return (
    <g aria-hidden>
      <g className={cn("stroke-border", faint && "opacity-70")} strokeWidth={1}>
        {lines}
      </g>
      <g className="stroke-muted-foreground/60" strokeWidth={1.25}>
        <line x1={0} x2={size} y1={sy(0)} y2={sy(0)} />
        <line x1={sx(0)} x2={sx(0)} y1={0} y2={size} />
      </g>
    </g>
  );
}

/** Arrow from (x1, y1) to (x2, y2) in SVG coordinates; the head is a polygon (no markers). */
export function Arrow({
  x1,
  y1,
  x2,
  y2,
  className,
  width = 2.5,
  head = 10,
  dashed = false,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  className?: string;
  width?: number;
  head?: number;
  dashed?: boolean;
}) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return <circle cx={x2} cy={y2} r={width * 1.2} className={cn("stroke-none", className)} fill="currentColor" />;
  const h = Math.min(head, len * 0.6);
  const ux = dx / len;
  const uy = dy / len;
  const bx = x2 - ux * h;
  const by = y2 - uy * h;
  const px = -uy * h * 0.5;
  const py = ux * h * 0.5;
  return (
    <g className={className}>
      <line
        x1={x1}
        y1={y1}
        x2={bx + ux * 1}
        y2={by + uy * 1}
        stroke="currentColor"
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={dashed ? "6 5" : undefined}
      />
      <polygon points={`${x2},${y2} ${bx + px},${by + py} ${bx - px},${by - py}`} fill="currentColor" />
    </g>
  );
}

/** Text label with a halo so it stays readable over grid lines. */
export function SvgLabel({
  x,
  y,
  children,
  className,
  anchor = "middle",
  size = 18,
}: {
  x: number;
  y: number;
  children: React.ReactNode;
  className?: string;
  anchor?: "start" | "middle" | "end";
  size?: number;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      dominantBaseline="middle"
      fontSize={size}
      className={cn("fill-current font-medium [paint-order:stroke] stroke-card", className)}
      strokeWidth={4}
      strokeLinejoin="round"
      style={{ fontStyle: "italic" }}
    >
      {children}
    </text>
  );
}

/** Clips a line through point p with direction d to the square [-E, E]²; null if outside. */
export function clipLine(p: [number, number], d: [number, number], E: number): [[number, number], [number, number]] | null {
  let t0 = -Infinity;
  let t1 = Infinity;
  for (let k = 0; k < 2; k++) {
    if (Math.abs(d[k]) < 1e-12) {
      if (p[k] < -E || p[k] > E) return null;
    } else {
      let a = (-E - p[k]) / d[k];
      let b = (E - p[k]) / d[k];
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
    }
  }
  if (!(t0 < t1)) return null;
  return [
    [p[0] + t0 * d[0], p[1] + t0 * d[1]],
    [p[0] + t1 * d[0], p[1] + t1 * d[1]],
  ];
}

/** TeX of a column vector. */
export function colTex(a: string, b: string): string {
  return `\\begin{pmatrix} ${a} \\\\ ${b} \\end{pmatrix}`;
}
