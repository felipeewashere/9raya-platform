"use client";

import * as React from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tex } from "@/components/math/md";
import { cn } from "@/lib/utils";
import { Frac } from "./lib/fraction";
import { inverse2, mulVec2, toFMat2, type FMat2, type Mat2 } from "./lib/linalg2";
import { Arrow, Feedback, PlaneGrid, SvgLabel, WidgetFrame, clipLine, colTex, makePlane } from "./shared";

export type BasisChangeProps = { P: Mat2; x: [number, number] };

const matTex = (m: FMat2) =>
  `\\begin{pmatrix} ${m[0][0].toTex()} & ${m[0][1].toTex()} \\\\ ${m[1][0].toTex()} & ${m[1][1].toTex()} \\end{pmatrix}`;

export function BasisChange({ P, x }: BasisChangeProps) {
  const FP = React.useMemo(() => toFMat2(P), [P]);
  const Pinv = React.useMemo(() => inverse2(FP), [FP]);
  const [X, setX] = React.useState<[number, number]>(x);
  const [focused, setFocused] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const clipId = React.useId().replace(/:/g, "");

  const eps1: [number, number] = [P[0][0], P[1][0]];
  const eps2: [number, number] = [P[0][1], P[1][1]];

  const E = React.useMemo(() => {
    const pts = [x, eps1, eps2, [eps1[0] + eps2[0], eps1[1] + eps2[1]]];
    if (Pinv) {
      const xp = mulVec2(Pinv, [Frac.fromNumber(x[0]), Frac.fromNumber(x[1])]).map((f) => f.toNumber());
      pts.push([xp[0] * eps1[0], xp[0] * eps1[1]]);
    }
    return Math.min(8, Math.max(4, Math.ceil(Math.max(...pts.flat().map(Math.abs)) + 1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [P, x, Pinv]);

  const plane = makePlane(E);
  const { sx, sy, size, unit } = plane;
  const lim = E - 0.5;
  const clamp = (v: number) => Math.max(-lim, Math.min(lim, v));

  const FX: [Frac, Frac] = [Frac.fromNumber(X[0]), Frac.fromNumber(X[1])];
  const Xp = Pinv ? mulVec2(Pinv, FX) : null;

  const snap = (p: [number, number]): [number, number] => {
    const half: [number, number] = [Math.round(p[0] * 2) / 2, Math.round(p[1] * 2) / 2];
    if (Pinv) {
      const c = mulVec2(Pinv, [Frac.fromNumber(Number(p[0].toFixed(6))), Frac.fromNumber(Number(p[1].toFixed(6)))]).map((f) =>
        Math.round(f.toNumber()),
      );
      const lat: [number, number] = [c[0] * eps1[0] + c[1] * eps2[0], c[0] * eps1[1] + c[1] * eps2[1]];
      if (Math.hypot(lat[0] - p[0], lat[1] - p[1]) < 0.3 && Math.abs(lat[0]) <= lim && Math.abs(lat[1]) <= lim) return lat;
    }
    return [clamp(half[0]), clamp(half[1])];
  };

  const fromPointer = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    setX(snap([(pt.x - size / 2) / unit, (size / 2 - pt.y) / unit]));
  };

  const onKey = (e: React.KeyboardEvent) => {
    const d = e.shiftKey ? 0.5 : 1;
    const moves: Record<string, [number, number]> = {
      ArrowUp: [0, d],
      ArrowDown: [0, -d],
      ArrowLeft: [-d, 0],
      ArrowRight: [d, 0],
    };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    setX(([a, b]) => [clamp(a + m[0]), clamp(b + m[1])]);
  };

  // new-basis grid lines
  const gridLines: React.ReactNode[] = [];
  if (Pinv) {
    const corners: [number, number][] = [
      [-E, -E],
      [-E, E],
      [E, -E],
      [E, E],
    ];
    const cc = corners.map((c) => mulVec2(Pinv, [Frac.fromNumber(c[0]), Frac.fromNumber(c[1])]).map((f) => f.toNumber()));
    const range = (i: number) => {
      const vals = cc.map((c) => c[i]);
      return [Math.max(-30, Math.floor(Math.min(...vals))), Math.min(30, Math.ceil(Math.max(...vals)))];
    };
    const [s0, s1] = range(0);
    const [t0, t1] = range(1);
    for (let k = s0; k <= s1; k++) {
      const seg = clipLine([k * eps1[0], k * eps1[1]], eps2, E);
      if (seg)
        gridLines.push(
          <line
            key={`s${k}`}
            x1={sx(seg[0][0])}
            y1={sy(seg[0][1])}
            x2={sx(seg[1][0])}
            y2={sy(seg[1][1])}
            strokeWidth={k === 0 ? 1.8 : 1}
            className={k === 0 ? "stroke-primary/70" : "stroke-primary/30"}
          />,
        );
    }
    for (let k = t0; k <= t1; k++) {
      const seg = clipLine([k * eps2[0], k * eps2[1]], eps1, E);
      if (seg)
        gridLines.push(
          <line
            key={`t${k}`}
            x1={sx(seg[0][0])}
            y1={sy(seg[0][1])}
            x2={sx(seg[1][0])}
            y2={sy(seg[1][1])}
            strokeWidth={k === 0 ? 1.8 : 1}
            className={k === 0 ? "stroke-primary/70" : "stroke-primary/30"}
          />,
        );
    }
  }

  const xp = Xp ? Xp.map((f) => f.toNumber()) : null;
  const mid: [number, number] | null = xp ? [xp[0] * eps1[0], xp[0] * eps1[1]] : null;
  const tipLabel = (p: [number, number]): [number, number] => {
    const len = Math.hypot(p[0], p[1]) || 1;
    return [sx(p[0]) + (p[0] / len) * 16, sy(p[1]) - (p[1] / len) * 16];
  };
  const XTex = colTex(FX[0].toTex(), FX[1].toTex());
  const XpTex = Xp ? colTex(Xp[0].toTex(), Xp[1].toTex()) : "";

  return (
    <WidgetFrame label="Changement de base">
      <div className="grid gap-3 @2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] @2xl:items-start">
        <div className="space-y-1">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${size} ${size}`}
            role="img"
            aria-label={`Plan avec la base canonique et la nouvelle base ε1 = (${eps1.join(", ")}), ε2 = (${eps2.join(", ")}). Vecteur x = (${FX.map(String).join(", ")}).`}
            className={cn(
              "mx-auto w-full max-w-[420px] touch-none rounded-lg border border-border bg-card select-none",
              dragging ? "cursor-grabbing" : "cursor-crosshair",
            )}
            onPointerDown={(e) => {
              (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
              setDragging(true);
              fromPointer(e);
            }}
            onPointerMove={(e) => dragging && fromPointer(e)}
            onPointerUp={() => setDragging(false)}
            onPointerCancel={() => setDragging(false)}
          >
            <defs>
              <clipPath id={clipId}>
                <rect x={0} y={0} width={size} height={size} />
              </clipPath>
            </defs>
            <PlaneGrid plane={plane} faint />
            <g clipPath={`url(#${clipId})`}>{gridLines}</g>
            {/* canonical decomposition */}
            <g className="stroke-muted-foreground/70" strokeWidth={1.3} strokeDasharray="4 4" fill="none">
              <line x1={sx(0)} y1={sy(0)} x2={sx(X[0])} y2={sy(0)} />
              <line x1={sx(X[0])} y1={sy(0)} x2={sx(X[0])} y2={sy(X[1])} />
            </g>
            {/* new-basis decomposition */}
            {mid && (
              <g className="stroke-primary" strokeWidth={2} strokeDasharray="6 4" fill="none">
                <line x1={sx(0)} y1={sy(0)} x2={sx(mid[0])} y2={sy(mid[1])} />
                <line x1={sx(mid[0])} y1={sy(mid[1])} x2={sx(X[0])} y2={sy(X[1])} />
              </g>
            )}
            <Arrow x1={sx(0)} y1={sy(0)} x2={sx(1)} y2={sy(0)} className="text-muted-foreground" width={2} />
            <Arrow x1={sx(0)} y1={sy(0)} x2={sx(0)} y2={sy(1)} className="text-muted-foreground" width={2} />
            <Arrow x1={sx(0)} y1={sy(0)} x2={sx(eps1[0])} y2={sy(eps1[1])} className="text-primary" width={3} />
            <Arrow x1={sx(0)} y1={sy(0)} x2={sx(eps2[0])} y2={sy(eps2[1])} className="text-primary" width={3} />
            <SvgLabel x={tipLabel(eps1)[0]} y={tipLabel(eps1)[1]} className="text-primary">
              ε₁
            </SvgLabel>
            <SvgLabel x={tipLabel(eps2)[0]} y={tipLabel(eps2)[1]} className="text-primary">
              ε₂
            </SvgLabel>
            <Arrow x1={sx(0)} y1={sy(0)} x2={sx(X[0])} y2={sy(X[1])} className="text-foreground" width={3.5} head={13} />
            <SvgLabel x={tipLabel(X)[0] + 10} y={tipLabel(X)[1]} className="text-foreground">
              x
            </SvgLabel>
            <g
              role="button"
              tabIndex={0}
              aria-roledescription="point déplaçable"
              aria-label={`Extrémité du vecteur x, en (${FX.map(String).join(", ")}). Flèches pour déplacer (Maj : demi-pas).`}
              onKeyDown={onKey}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className="cursor-grab outline-none"
            >
              <circle cx={sx(X[0])} cy={sy(X[1])} r={16} className="fill-transparent" />
              <circle
                cx={sx(X[0])}
                cy={sy(X[1])}
                r={focused || dragging ? 9 : 7}
                strokeWidth={2.5}
                className={cn("fill-reward stroke-card transition-[r]", focused && "stroke-primary")}
              />
            </g>
          </svg>
          <p className="text-center text-xs text-muted-foreground">
            Faites glisser l&apos;extrémité de <Tex>x</Tex> (ou utilisez les flèches du clavier après l&apos;avoir sélectionnée).
          </p>
        </div>

        <div className="min-w-0 space-y-3">
          {!Pinv ? (
            <Feedback tone="danger">
              <Tex>{`P = ${matTex(FP)}`}</Tex> n&apos;est pas inversible (<Tex>{"\\det P = 0"}</Tex>) : ses colonnes ne forment
              pas une base de <Tex>{"\\mathbb{R}^2"}</Tex>, on ne peut pas définir <Tex>{"X'"}</Tex>.
            </Feedback>
          ) : (
            <>
              <div className="space-y-2 overflow-x-auto rounded-lg bg-muted px-3 py-2 text-sm" aria-live="polite">
                <div>
                  <Tex>{`X = ${XTex}`}</Tex> <span className="text-muted-foreground">(base canonique)</span>
                </div>
                <div>
                  <Tex>{`X' = P^{-1}X = ${matTex(Pinv)}${XTex} = ${XpTex}`}</Tex>{" "}
                  <span className="text-muted-foreground">(nouvelle base)</span>
                </div>
              </div>
              <Feedback tone="info" live={false}>
                <div className="space-y-1.5 overflow-x-auto">
                  <div>
                    <Tex>{`X = PX' : \\quad ${XTex} = ${matTex(FP)}${XpTex}`}</Tex>
                  </div>
                  <div>
                    <Tex>{`x = ${Xp![0].toTexParen()}\\,\\varepsilon_1 + ${Xp![1].toTexParen()}\\,\\varepsilon_2`}</Tex>
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Les colonnes de <Tex>P</Tex> sont <Tex>{`\\varepsilon_1 = (${FP[0][0].toTex()}, ${FP[1][0].toTex()})`}</Tex> et{" "}
                  <Tex>{`\\varepsilon_2 = (${FP[0][1].toTex()}, ${FP[1][1].toTex()})`}</Tex>. Tirets bleus : le chemin{" "}
                  <Tex>{"x'_1\\varepsilon_1"}</Tex> puis <Tex>{"x'_2\\varepsilon_2"}</Tex>.
                </p>
              </Feedback>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={() => setX(x)}>
            <RotateCcw aria-hidden /> Vecteur de départ
          </Button>
        </div>
      </div>
    </WidgetFrame>
  );
}

export default BasisChange;
