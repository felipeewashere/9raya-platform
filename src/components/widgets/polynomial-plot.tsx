"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tex } from "@/components/math/md";
import { cn } from "@/lib/utils";
import { fmtNum, texNum } from "./lib/format";
import { degree, derivNum, evalNum, polyFromNumbers, polyTex, trimNum } from "./lib/polynomial";
import { cauchyBound, multiplicityName, numericRootsIn, realRoots, type RealRoot } from "./lib/roots";
import { Feedback, NumberField, WidgetFrame } from "./shared";

export type PolynomialPlotProps = { coeffs: number[]; editable?: boolean };

const W = 480;
const H = 300;
const MAX_TERMS = 6;

function niceStep(span: number, target = 6): number {
  const raw = span / target;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
}

function ticks(lo: number, hi: number): number[] {
  const s = niceStep(hi - lo);
  const out: number[] = [];
  for (let t = Math.ceil(lo / s) * s; t <= hi + 1e-9; t += s) out.push(Number(t.toPrecision(10)));
  return out;
}

/** Window that shows roots, extrema and inflection points (plus the origin). */
function autoRange(coeffs: number[], roots: RealRoot[]) {
  const p = trimNum(coeffs);
  const pts: number[] = roots.map((r) => r.value);
  if (p.length >= 2) {
    const B = cauchyBound(p) + 2;
    const d1 = derivNum(p);
    pts.push(...numericRootsIn(d1, -B * 2, B * 2), ...numericRootsIn(derivNum(d1), -B * 2, B * 2));
  }
  let xmin = -3;
  let xmax = 3;
  if (pts.length) {
    const lo = Math.min(0, ...pts);
    const hi = Math.max(0, ...pts);
    const span = Math.max(hi - lo, 2);
    const pad = 0.25 * span + 0.5;
    xmin = lo - pad;
    xmax = hi + pad;
  }
  const f = (x: number) => evalNum(p, x);
  const vals = [0, f(0), ...pts.map(f)];
  let ylo = Math.min(...vals);
  let yhi = Math.max(...vals);
  const spanY = Math.max(yhi - ylo, 1);
  for (const x of [xmin, xmax, (xmin + xmax) / 2]) {
    const v = Math.max(ylo - 1.5 * spanY, Math.min(yhi + 1.5 * spanY, f(x)));
    ylo = Math.min(ylo, v);
    yhi = Math.max(yhi, v);
  }
  const padY = Math.max(0.1 * (yhi - ylo), 0.5);
  return { xmin, xmax, ymin: ylo - padY, ymax: yhi + padY };
}

export function PolynomialPlot({ coeffs: initial, editable = true }: PolynomialPlotProps) {
  const [coeffs, setCoeffs] = React.useState<number[]>(initial.length ? initial : [0]);
  const clipId = React.useId().replace(/:/g, "");
  const P = React.useMemo(() => polyFromNumbers(coeffs), [coeffs]);
  const deg = degree(P);
  const roots = React.useMemo(() => realRoots(coeffs), [coeffs]);
  const { xmin, xmax, ymin, ymax } = React.useMemo(() => autoRange(coeffs, roots), [coeffs, roots]);

  const X = (x: number) => ((x - xmin) / (xmax - xmin)) * W;
  const Y = (y: number) => H - ((y - ymin) / (ymax - ymin)) * H;
  const clampY = (v: number) => Math.max(-2 * H, Math.min(3 * H, v));

  const N = 360;
  let d = "";
  for (let i = 0; i <= N; i++) {
    const x = xmin + ((xmax - xmin) * i) / N;
    d += `${i ? "L" : "M"}${X(x).toFixed(2)},${clampY(Y(evalNum(coeffs, x))).toFixed(2)}`;
  }

  const xt = ticks(xmin, xmax).filter((t) => t !== 0 && X(t) > 14 && X(t) < W - 14);
  const yt = ticks(ymin, ymax).filter((t) => t !== 0 && Y(t) > 12 && Y(t) < H - 12);
  const x0 = X(0);
  const y0 = Y(0);

  const setCoef = (k: number, v: number) => setCoeffs((c) => c.map((x, i) => (i === k ? v : x)));
  const rootTex = (r: RealRoot) => (r.exact ? `x = ${r.exact.toTex()}` : `x \\approx ${texNum(r.value)}`);

  return (
    <WidgetFrame label="Courbe d'un polynôme">
      <div className="overflow-x-auto rounded-lg bg-muted px-3 py-2 text-center">
        <Tex>{`P(X) = ${polyTex(P)}`}</Tex>
        <span className="ml-3 text-sm text-muted-foreground">
          <Tex>{`\\deg P = ${deg < 0 ? "-\\infty" : deg}`}</Tex>
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Courbe de P sur [${fmtNum(xmin, 1)} ; ${fmtNum(xmax, 1)}]. ${
          roots.length
            ? `Racines réelles : ${roots.map((r) => `${r.exact ? r.exact.toString() : fmtNum(r.value)} (${multiplicityName(r.multiplicity)})`).join(", ")}.`
            : "Aucune racine réelle."
        }`}
        className="w-full rounded-lg border border-border bg-card"
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={0} y={0} width={W} height={H} />
          </clipPath>
        </defs>
        <g aria-hidden>
          <g className="stroke-border" strokeWidth={1}>
            {xt.map((t) => (
              <line key={`gx${t}`} x1={X(t)} x2={X(t)} y1={0} y2={H} />
            ))}
            {yt.map((t) => (
              <line key={`gy${t}`} x1={0} x2={W} y1={Y(t)} y2={Y(t)} />
            ))}
          </g>
          <g className="stroke-muted-foreground/70" strokeWidth={1.3}>
            <line x1={0} x2={W} y1={y0} y2={y0} />
            <line x1={x0} x2={x0} y1={0} y2={H} />
          </g>
          <g className="fill-muted-foreground" fontSize={15}>
            {xt.map((t) => (
              <text key={`tx${t}`} x={X(t)} y={Math.min(H - 4, Math.max(12, y0 + 14))} textAnchor="middle">
                {fmtNum(t, 2)}
              </text>
            ))}
            {yt.map((t) => (
              <text
                key={`ty${t}`}
                x={Math.min(W - 4, Math.max(4, x0 - 5))}
                y={Y(t) + 4}
                textAnchor={x0 - 5 < 30 ? "start" : "end"}
              >
                {fmtNum(t, 2)}
              </text>
            ))}
          </g>
        </g>
        <g clipPath={`url(#${clipId})`}>
          {deg < 0 ? (
            <line x1={0} x2={W} y1={y0} y2={y0} className="stroke-primary" strokeWidth={3} />
          ) : (
            <motion.path
              fill="none"
              className="stroke-primary"
              strokeWidth={2.5}
              strokeLinejoin="round"
              initial={false}
              animate={{ d }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
            />
          )}
        </g>
        {roots.map((r) => (
          <g key={r.value}>
            {r.multiplicity > 1 && <circle cx={X(r.value)} cy={y0} r={10} className="fill-none stroke-reward" strokeWidth={3} />}
            <circle
              cx={X(r.value)}
              cy={y0}
              r={4.5}
              className={cn(r.multiplicity > 1 ? "fill-reward-foreground" : "fill-primary", "stroke-card")}
              strokeWidth={1.5}
            />
          </g>
        ))}
      </svg>

      <div aria-live="polite">
        {deg < 0 ? (
          <Feedback tone="info">Polynôme nul : tout réel est racine.</Feedback>
        ) : roots.length === 0 ? (
          <Feedback tone="neutral">
            Aucune racine réelle : la courbe ne coupe pas l&apos;axe des abscisses
            {deg >= 2 ? " (les racines éventuelles sont complexes non réelles)." : "."}
          </Feedback>
        ) : (
          <Feedback tone="neutral">
            <p className="mb-1.5">Racines réelles :</p>
            <ul className="flex flex-wrap gap-1.5">
              {roots.map((r) => (
                <li
                  key={r.value}
                  className={cn(
                    "rounded-md border px-2 py-0.5",
                    r.multiplicity > 1 ? "border-reward/60 bg-reward-soft" : "border-border bg-card",
                  )}
                >
                  <Tex>{rootTex(r)}</Tex> : {multiplicityName(r.multiplicity)}
                </li>
              ))}
            </ul>
            {roots.some((r) => r.multiplicity % 2 === 0) && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                En une racine de multiplicité paire, la courbe touche l&apos;axe sans le traverser.
              </p>
            )}
            {roots.some((r) => r.multiplicity >= 3 && r.multiplicity % 2 === 1) && (
              <p className="mt-1 text-xs text-muted-foreground">
                En une racine triple, la courbe traverse l&apos;axe en y étant tangente (point d&apos;inflexion).
              </p>
            )}
          </Feedback>
        )}
      </div>

      {editable && (
        <fieldset className="space-y-2 rounded-lg border border-border p-2.5">
          <legend className="px-1 text-xs font-medium text-muted-foreground">Coefficients par degré croissant</legend>
          <div className="flex flex-wrap gap-2">
            {coeffs.map((c, k) => (
              <label key={k} className="flex items-center gap-1 text-sm">
                <Tex>{`a_{${k}}`}</Tex>
                <NumberField value={c} step={1} onChange={(v) => setCoef(k, v)} ariaLabel={`Coefficient de X puissance ${k}`} />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={coeffs.length >= MAX_TERMS} onClick={() => setCoeffs((c) => [...c, 1])}>
              <Plus aria-hidden /> Degré
            </Button>
            <Button variant="outline" size="sm" disabled={coeffs.length <= 1} onClick={() => setCoeffs((c) => c.slice(0, -1))}>
              <Minus aria-hidden /> Degré
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCoeffs(initial)}>
              <RotateCcw aria-hidden /> Réinitialiser
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            <Tex>{`P = a_0 + a_1X + \\dots`}</Tex> ; fractions acceptées (ex. <Tex>{"3/4"}</Tex>) ; flèches haut/bas : ±1.
          </p>
        </fieldset>
      )}
    </WidgetFrame>
  );
}

export default PolynomialPlot;
