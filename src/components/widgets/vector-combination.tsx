"use client";

import * as React from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tex } from "@/components/math/md";
import { Frac } from "./lib/fraction";
import { Arrow, Feedback, NumberSlider, PlaneGrid, SvgLabel, WidgetFrame, clipLine, colTex, makePlane, useTween } from "./shared";

export type VectorCombinationProps = { u: [number, number]; v: [number, number] };

const RANGE = 5;

export function VectorCombination({ u, v }: VectorCombinationProps) {
  const uid = React.useId();
  const [a, setA] = React.useState(1);
  const [b, setB] = React.useState(1);

  const w: [number, number] = [a * u[0] + b * v[0], a * u[1] + b * v[1]];
  const need = Math.max(...[u, v, w, [a * u[0], a * u[1]], [b * v[0], b * v[1]]].flatMap((p) => p.map(Math.abs)));
  const E = Math.max(4, Math.ceil(need + 1));
  const {
    value: [ta, tb, tE],
  } = useTween([a, b, E], 0.35);

  const plane = makePlane(tE);
  const { sx, sy, size } = plane;
  const det = Frac.fromNumber(u[0])
    .mul(Frac.fromNumber(v[1]))
    .sub(Frac.fromNumber(u[1]).mul(Frac.fromNumber(v[0])));
  const free = !det.isZero();
  const uZero = u[0] === 0 && u[1] === 0;
  const vZero = v[0] === 0 && v[1] === 0;
  const dir: [number, number] | null = free ? null : !uZero ? u : !vZero ? v : null;
  const spanSeg = dir ? clipLine([0, 0], dir, tE) : null;

  const au: [number, number] = [ta * u[0], ta * u[1]];
  const bv: [number, number] = [tb * v[0], tb * v[1]];
  const tw: [number, number] = [au[0] + bv[0], au[1] + bv[1]];

  const F = (x: number) => Frac.fromNumber(x);
  const coef = (x: number) => F(x).toTexParen();
  const wTex = colTex(F(w[0]).toTex(), F(w[1]).toTex());
  const combTex = `${coef(a)}\\,${colTex(String(u[0]), String(u[1]))} + ${coef(b)}\\,${colTex(String(v[0]), String(v[1]))} = ${wTex}`;

  const labelOffset = (p: [number, number]): [number, number] => {
    const len = Math.hypot(p[0], p[1]) || 1;
    return [sx(p[0]) + (p[0] / len) * 14, sy(p[1]) - (p[1] / len) * 14];
  };

  return (
    <WidgetFrame label="Combinaison linéaire de deux vecteurs">
      <div className="grid gap-3 @2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] @2xl:items-start">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`Plan : u = (${u.join(", ")}), v = (${v.join(", ")}), a = ${a}, b = ${b}, a·u + b·v = (${w.map((x) => Number(x.toFixed(3))).join(", ")}).`}
          className="mx-auto w-full max-w-[420px] touch-manipulation rounded-lg border border-border bg-card"
        >
          {free && <rect x={0} y={0} width={size} height={size} className="fill-brand-soft" opacity={0.6} />}
          <PlaneGrid plane={plane} />
          {spanSeg && (
            <line
              x1={sx(spanSeg[0][0])}
              y1={sy(spanSeg[0][1])}
              x2={sx(spanSeg[1][0])}
              y2={sy(spanSeg[1][1])}
              strokeWidth={10}
              strokeLinecap="round"
              className="stroke-primary/20"
            />
          )}
          {/* parallelogram construction */}
          <g className="stroke-muted-foreground" strokeWidth={1.5} strokeDasharray="5 4" fill="none">
            <line x1={sx(au[0])} y1={sy(au[1])} x2={sx(tw[0])} y2={sy(tw[1])} />
            <line x1={sx(bv[0])} y1={sy(bv[1])} x2={sx(tw[0])} y2={sy(tw[1])} />
          </g>
          <Arrow x1={sx(0)} y1={sy(0)} x2={sx(au[0])} y2={sy(au[1])} className="text-success/70" width={2} />
          <Arrow x1={sx(0)} y1={sy(0)} x2={sx(bv[0])} y2={sy(bv[1])} className="text-theorem/70" width={2} />
          <Arrow x1={sx(0)} y1={sy(0)} x2={sx(u[0])} y2={sy(u[1])} className="text-success" width={3} />
          <Arrow x1={sx(0)} y1={sy(0)} x2={sx(v[0])} y2={sy(v[1])} className="text-theorem" width={3} />
          <Arrow x1={sx(0)} y1={sy(0)} x2={sx(tw[0])} y2={sy(tw[1])} className="text-primary" width={3.5} head={13} />
          <SvgLabel x={labelOffset(u)[0]} y={labelOffset(u)[1]} className="text-success">
            u
          </SvgLabel>
          <SvgLabel x={labelOffset(v)[0]} y={labelOffset(v)[1]} className="text-theorem">
            v
          </SvgLabel>
          {Math.hypot(tw[0], tw[1]) > 0.3 && (
            <SvgLabel x={labelOffset(tw)[0]} y={labelOffset(tw)[1]} className="text-primary">
              au+bv
            </SvgLabel>
          )}
          <circle cx={sx(tw[0])} cy={sy(tw[1])} r={4} className="fill-primary" />
        </svg>

        <div className="min-w-0 space-y-3">
          <div className="space-y-1.5 rounded-lg border border-border p-2.5">
            <NumberSlider
              id={`${uid}-a`}
              texLabel="a"
              ariaLabel="Coefficient a"
              value={a}
              onChange={setA}
              min={-RANGE}
              max={RANGE}
              step={0.5}
            />
            <NumberSlider
              id={`${uid}-b`}
              texLabel="b"
              ariaLabel="Coefficient b"
              value={b}
              onChange={setB}
              min={-RANGE}
              max={RANGE}
              step={0.5}
            />
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setA(1);
                  setB(1);
                }}
              >
                <RotateCcw aria-hidden /> a = b = 1
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg bg-muted px-2 py-2 text-center" aria-live="polite">
            <Tex>{`a\\vec u + b\\vec v = ${combTex}`}</Tex>
          </div>
          <Feedback tone={free ? "success" : "info"}>
            {free ? (
              <>
                <strong>
                  <Tex>{"\\vec u"}</Tex> et <Tex>{"\\vec v"}</Tex> sont libres
                </strong>{" "}
                (non colinéaires) : <Tex>{"\\operatorname{Vect}(\\vec u, \\vec v) = \\mathbb{R}^2"}</Tex>, tout le plan (zone
                bleutée) est atteint.
              </>
            ) : dir ? (
              <>
                <strong>
                  <Tex>{"\\vec u"}</Tex> et <Tex>{"\\vec v"}</Tex> sont liés
                </strong>{" "}
                (colinéaires) : toutes les combinaisons restent sur la droite{" "}
                <Tex>{`\\operatorname{Vect}\\big((${dir[0]},${dir[1]})\\big)`}</Tex>.
              </>
            ) : (
              <>
                <strong>
                  <Tex>{"\\vec u"}</Tex> et <Tex>{"\\vec v"}</Tex> sont liés
                </strong>{" "}
                : ce sont des vecteurs nuls, <Tex>{"\\operatorname{Vect}(\\vec u,\\vec v) = \\{\\vec 0\\}"}</Tex>.
              </>
            )}
          </Feedback>
        </div>
      </div>
    </WidgetFrame>
  );
}

export default VectorCombination;
