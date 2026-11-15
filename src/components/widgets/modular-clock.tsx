"use client";

import * as React from "react";
import { animate, useReducedMotion } from "motion/react";
import { Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tex } from "@/components/math/md";
import { cn } from "@/lib/utils";
import { gcd, inverseMod, invertibleClasses, mod } from "./lib/modular";
import { Feedback, WidgetFrame } from "./shared";

export type ModularClockProps = { n: number; op: "+" | "*" };

const SIZE = 300;
const C = SIZE / 2;
const R = 112;

const pointAngle = (k: number, n: number) => (360 * k) / n; // degrees, clockwise from top
const polar = (deg: number, r: number): [number, number] => {
  const t = ((deg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(t), C + r * Math.sin(t)];
};

function ClassPicker({
  label,
  name,
  n,
  value,
  onChange,
  disabled,
}: {
  label: string;
  name: string;
  n: number;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="text-sm text-muted-foreground" id={`${name}-lbl`}>
        {label}
      </div>
      <div role="radiogroup" aria-labelledby={`${name}-lbl`} className="flex flex-wrap gap-1">
        {Array.from({ length: n }, (_, k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={value === k}
            aria-label={`classe de ${k}`}
            disabled={disabled}
            onClick={() => onChange(k)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                const next = mod(k + (e.key === "ArrowRight" ? 1 : -1), n);
                onChange(next);
                (e.currentTarget.parentElement?.children[next] as HTMLButtonElement | undefined)?.focus();
              }
            }}
            tabIndex={value === k ? 0 : -1}
            className={cn(
              "h-8 min-w-8 rounded-md border px-1.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60",
              value === k
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-muted dark:bg-input/30",
            )}
          >
            <Tex>{`\\bar{${k}}`}</Tex>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ModularClock({ n, op }: ModularClockProps) {
  const reduce = useReducedMotion();
  const uid = React.useId();
  const [a, setA] = React.useState(Math.min(n - 1, op === "+" ? Math.ceil(n / 2) + 1 : 2));
  const [b, setB] = React.useState(Math.min(n - 1, op === "+" ? Math.ceil(n / 2) : 3));
  const [angle, setAngle] = React.useState(op === "+" ? pointAngle(a, n) : 0);
  const [phase, setPhase] = React.useState<"idle" | "running" | "done">("idle");
  const [count, setCount] = React.useState(0);
  const token = React.useRef(0);
  const angleRef = React.useRef(angle);

  const result = op === "+" ? mod(a + b, n) : mod(a * b, n);
  const raw = op === "+" ? a + b : a * b;
  const invertibles = op === "*" ? invertibleClasses(n) : [];
  const stepSize = op === "+" ? 1 : a;
  const totalSteps = b;

  const setBoth = (v: number) => {
    angleRef.current = v;
    setAngle(v);
  };

  const reset = (na = a) => {
    token.current++;
    setPhase("idle");
    setCount(0);
    setBoth(op === "+" ? pointAngle(na, n) : 0);
  };

  React.useEffect(() => () => void token.current++, []);

  const run = async () => {
    const my = ++token.current;
    const start = op === "+" ? pointAngle(a, n) : 0;
    setBoth(start);
    setCount(0);
    if (reduce || totalSteps === 0) {
      setBoth(start + (360 * stepSize * totalSteps) / n);
      setCount(totalSteps);
      setPhase("done");
      return;
    }
    setPhase("running");
    const per = Math.min(op === "+" ? 0.3 : 0.45, (op === "+" ? 3 : 3.6) / totalSteps);
    for (let s = 1; s <= totalSteps; s++) {
      const from = angleRef.current;
      const to = start + (360 * stepSize * s) / n;
      await new Promise<void>((resolve) => {
        animate(from, to, {
          duration: per,
          ease: "easeInOut",
          onUpdate: (v) => token.current === my && setBoth(v),
          onComplete: resolve,
        });
      });
      if (token.current !== my) return;
      setCount(s);
    }
    setPhase("done");
  };

  const current = mod(Math.round((angle / 360) * n), n);
  const [hx, hy] = polar(angle, R - 30);

  return (
    <WidgetFrame label={`Horloge modulo ${n}`}>
      <div className="grid gap-3 @lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @lg:items-center">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={`Cercle des ${n} classes de Z/${n}Z ; l'aiguille montre la classe ${current}.`}
          className="mx-auto w-full max-w-[300px]"
        >
          <circle cx={C} cy={C} r={R} fill="none" className="stroke-border" strokeWidth={2} />
          {Array.from({ length: n }, (_, k) => {
            const [x, y] = polar(pointAngle(k, n), R);
            const isCurrent = phase !== "idle" && k === current;
            const isResult = phase === "done" && k === result;
            const inv = op === "*" && invertibles.includes(k);
            return (
              <g key={k}>
                <circle
                  cx={x}
                  cy={y}
                  r={15}
                  strokeWidth={inv ? 2.5 : 1.5}
                  className={cn(
                    "transition-colors duration-200",
                    isResult ? "fill-reward stroke-reward" : isCurrent ? "fill-primary stroke-primary" : "fill-card",
                    !isResult && !isCurrent && (inv ? "stroke-success" : "stroke-muted-foreground/50"),
                  )}
                />
                <text
                  x={x}
                  y={y + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={14}
                  className={cn(isResult ? "fill-black" : isCurrent ? "fill-primary-foreground" : "fill-foreground")}
                >
                  {k}
                </text>
                <line
                  x1={x - 4.5}
                  x2={x + 4.5}
                  y1={y - 8}
                  y2={y - 8}
                  strokeWidth={1.3}
                  className={isResult ? "stroke-black" : isCurrent ? "stroke-primary-foreground" : "stroke-foreground"}
                />
              </g>
            );
          })}
          <line x1={C} y1={C} x2={hx} y2={hy} strokeWidth={4} strokeLinecap="round" className="stroke-primary" />
          <circle cx={C} cy={C} r={6} className="fill-primary" />
        </svg>

        <div className="space-y-3">
          <ClassPicker
            label={op === "+" ? "Premier terme a" : "Premier facteur a"}
            name={`${uid}-a`}
            n={n}
            value={a}
            onChange={(v) => {
              setA(v);
              reset(v);
            }}
            disabled={phase === "running"}
          />
          <ClassPicker
            label={op === "+" ? "Second terme b" : "Second facteur b"}
            name={`${uid}-b`}
            n={n}
            value={b}
            onChange={(v) => {
              setB(v);
              reset(a);
            }}
            disabled={phase === "running"}
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={run} disabled={phase === "running"}>
              <Play aria-hidden /> {op === "+" ? `Avancer de ${b}` : `Faire ${b} saut${b > 1 ? "s" : ""} de ${a}`}
            </Button>
            <Button variant="outline" onClick={() => reset()} aria-label="Remettre l'aiguille au départ">
              <RotateCcw aria-hidden />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {op === "+" ? (
              <>
                L&apos;aiguille part de <Tex>{`\\bar{${a}}`}</Tex> et avance de <Tex>{String(b)}</Tex> cran
                {b > 1 ? "s" : ""}
              </>
            ) : (
              <>
                L&apos;aiguille part de <Tex>{"\\bar{0}"}</Tex> et fait <Tex>{String(b)}</Tex> saut{b > 1 ? "s" : ""} de{" "}
                <Tex>{String(a)}</Tex> crans (<Tex>{`${a}\\times ${b}`}</Tex> crans en tout)
              </>
            )}
            {phase !== "idle" && ` — ${count}/${totalSteps}`}.
          </p>
        </div>
      </div>

      {phase === "done" && (
        <Feedback tone="highlight">
          <div className="overflow-x-auto">
            <Tex>{`\\bar{${a}} ${op === "+" ? "+" : "\\times"} \\bar{${b}} = \\bar{${result}}`}</Tex>
            <span className="text-muted-foreground"> dans </span>
            <Tex>{`\\mathbb{Z}/${n}\\mathbb{Z}`}</Tex>
          </div>
          <div className="mt-1 overflow-x-auto text-sm">
            car <Tex>{`${a} ${op === "+" ? "+" : "\\times"} ${b} = ${raw} = ${Math.floor(raw / n)}\\times ${n} + ${result}`}</Tex>
          </div>
        </Feedback>
      )}

      {op === "*" && (
        <Feedback tone="neutral" live={false}>
          <p>
            <span className="inline-block size-3 rounded-full border-2 border-success align-middle" aria-hidden /> Classes
            inversibles (<Tex>{`\\operatorname{pgcd}(k, ${n}) = 1`}</Tex>) :{" "}
            <Tex>{invertibles.map((k) => `\\bar{${k}}`).join(",\\ ")}</Tex>
            {invertibles.length === n - 1 && (
              <>
                {" "}
                — toutes sauf <Tex>{"\\bar 0"}</Tex> : <Tex>{`\\mathbb{Z}/${n}\\mathbb{Z}`}</Tex> est un corps.
              </>
            )}
          </p>
          <p className="mt-1">
            {(() => {
              const inv = inverseMod(a, n);
              return inv === null ? (
                <>
                  <Tex>{`\\bar{${a}}`}</Tex> n&apos;est pas inversible :{" "}
                  <Tex>{`\\operatorname{pgcd}(${a}, ${n}) = ${gcd(a, n)}`}</Tex>.
                </>
              ) : (
                <>
                  <Tex>{`\\bar{${a}}`}</Tex> est inversible, d&apos;inverse <Tex>{`\\bar{${inv}}`}</Tex> car{" "}
                  <Tex>{`\\bar{${a}} \\times \\bar{${inv}} = \\bar 1`}</Tex>.
                </>
              );
            })()}
          </p>
        </Feedback>
      )}
    </WidgetFrame>
  );
}

export default ModularClock;
