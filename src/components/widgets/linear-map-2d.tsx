"use client";

import * as React from "react";
import { Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tex } from "@/components/math/md";
import { cn } from "@/lib/utils";
import { Frac, coefTex } from "./lib/fraction";
import { det2, kerIm, toFMat2, type Mat2 } from "./lib/linalg2";
import { Arrow, Feedback, NumberField, PlaneGrid, SvgLabel, WidgetFrame, clipLine, makePlane, useTween } from "./shared";

export type LinearMap2DProps = { matrix: Mat2; editable?: boolean };

const PRESETS: { label: string; m: Mat2 }[] = [
  {
    label: "Identité",
    m: [
      [1, 0],
      [0, 1],
    ],
  },
  {
    label: "Rotation 90°",
    m: [
      [0, -1],
      [1, 0],
    ],
  },
  {
    label: "Projection",
    m: [
      [1, 0],
      [0, 0],
    ],
  },
  {
    label: "Symétrie",
    m: [
      [1, 0],
      [0, -1],
    ],
  },
  {
    label: "Cisaillement",
    m: [
      [1, 1],
      [0, 1],
    ],
  },
];

/** TeX of the linear form p·x + q·y. */
function linTex(p: Frac, q: Frac): string {
  const parts: string[] = [];
  const add = (c: Frac, v: string) => {
    if (c.isZero()) return;
    const first = parts.length === 0;
    const sign = c.sign() < 0 ? "-" : first ? "" : "+";
    parts.push(`${first ? sign : ` ${sign} `}${coefTex(c.abs())}${v}`);
  };
  add(p, "x");
  add(q, "y");
  return parts.length ? parts.join("") : "0";
}

export function LinearMap2D({ matrix, editable = true }: LinearMap2DProps) {
  const [M, setM] = React.useState<Mat2>(matrix);
  const flat = [M[0][0], M[0][1], M[1][0], M[1][1]];
  const imgs = [
    [M[0][0], M[1][0]],
    [M[0][1], M[1][1]],
    [M[0][0] + M[0][1], M[1][0] + M[1][1]],
  ];
  const E = Math.min(8, Math.max(3, Math.ceil(Math.max(1.5, ...imgs.flat().map(Math.abs)) + 1)));
  const { value, replay } = useTween([...flat, E], 0.5);
  const [a, b, c, d, tE] = value;

  const plane = makePlane(tE);
  const { sx, sy, size } = plane;
  const map = (x: number, y: number): [number, number] => [a * x + b * y, c * x + d * y];
  const K = Math.min(16, Math.ceil(tE * 2));

  const FM = toFMat2(M);
  const det = det2(FM);
  const ki = kerIm(FM);
  const setEntry = (i: 0 | 1, j: 0 | 1, v: number) => {
    const next: Mat2 = [[...M[0]], [...M[1]]] as Mat2;
    next[i][j] = v;
    setM(next);
  };

  const lines: React.ReactNode[] = [];
  for (let k = -K; k <= K; k++) {
    const [p1, p2] = [map(k, -K), map(k, K)];
    const [q1, q2] = [map(-K, k), map(K, k)];
    const axis = k === 0;
    const cls = axis ? "stroke-primary" : "stroke-primary/30";
    const w = axis ? 2 : 1.2;
    lines.push(
      <line key={`v${k}`} x1={sx(p1[0])} y1={sy(p1[1])} x2={sx(p2[0])} y2={sy(p2[1])} className={cls} strokeWidth={w} />,
      <line key={`h${k}`} x1={sx(q1[0])} y1={sy(q1[1])} x2={sx(q2[0])} y2={sy(q2[1])} className={cls} strokeWidth={w} />,
    );
  }
  const e1 = map(1, 0);
  const e2 = map(0, 1);
  const e12 = map(1, 1);
  const kerSeg = ki.kerDir ? clipLine([0, 0], [ki.kerDir[0].toNumber(), ki.kerDir[1].toNumber()], tE) : null;
  const imSeg = ki.imDir ? clipLine([0, 0], [ki.imDir[0].toNumber(), ki.imDir[1].toNumber()], tE) : null;
  const clipId = React.useId().replace(/:/g, "");
  const tip = (p: [number, number], dx = 0): [number, number] => {
    const len = Math.hypot(p[0], p[1]) || 1;
    return [sx(p[0]) + (p[0] / len) * 16 + dx, sy(p[1]) - (p[1] / len) * 16];
  };

  const fTex = `f(x,y) = \\big(${linTex(FM[0][0], FM[0][1])},\\ ${linTex(FM[1][0], FM[1][1])}\\big)`;

  return (
    <WidgetFrame label="Application linéaire du plan">
      <div className="grid gap-3 @2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] @2xl:items-start">
        <div className="space-y-2">
          <svg
            viewBox={`0 0 ${size} ${size}`}
            role="img"
            aria-label={`Image de la grille par f de matrice ${M[0][0]}, ${M[0][1]}, ${M[1][0]}, ${M[1][1]} (par lignes). Déterminant ${det.toString()}.`}
            className="mx-auto w-full max-w-[420px] rounded-lg border border-border bg-card"
          >
            <defs>
              <clipPath id={clipId}>
                <rect x={0} y={0} width={size} height={size} />
              </clipPath>
            </defs>
            <PlaneGrid plane={plane} faint />
            <g clipPath={`url(#${clipId})`}>
              <polygon
                points={[[0, 0], e1, e12, e2].map(([x, y]) => `${sx(x)},${sy(y)}`).join(" ")}
                className="fill-reward-soft stroke-reward"
                strokeWidth={1.5}
                opacity={0.85}
              />
              {lines}
              {kerSeg && (
                <line
                  x1={sx(kerSeg[0][0])}
                  y1={sy(kerSeg[0][1])}
                  x2={sx(kerSeg[1][0])}
                  y2={sy(kerSeg[1][1])}
                  className="stroke-danger"
                  strokeWidth={2.5}
                  strokeDasharray="7 5"
                />
              )}
              {imSeg && (
                <line
                  x1={sx(imSeg[0][0])}
                  y1={sy(imSeg[0][1])}
                  x2={sx(imSeg[1][0])}
                  y2={sy(imSeg[1][1])}
                  className="stroke-primary/40"
                  strokeWidth={9}
                  strokeLinecap="round"
                />
              )}
            </g>
            <Arrow x1={sx(0)} y1={sy(0)} x2={sx(e1[0])} y2={sy(e1[1])} className="text-success" width={3} />
            <Arrow x1={sx(0)} y1={sy(0)} x2={sx(e2[0])} y2={sy(e2[1])} className="text-theorem" width={3} />
            <SvgLabel x={tip(e1)[0]} y={tip(e1)[1]} className="text-success">
              f(e₁)
            </SvgLabel>
            <SvgLabel
              x={tip(e2)[0]}
              y={tip(e2)[1] - (Math.hypot(e1[0] - e2[0], e1[1] - e2[1]) < 0.4 ? 16 : 0)}
              className="text-theorem"
            >
              f(e₂)
            </SvgLabel>
            {kerSeg && (
              <SvgLabel x={sx(kerSeg[1][0] * 0.82)} y={sy(kerSeg[1][1] * 0.82) - 12} className="text-danger" size={16}>
                Ker f
              </SvgLabel>
            )}
            {imSeg && (
              <SvgLabel x={sx(imSeg[0][0] * 0.82)} y={sy(imSeg[0][1] * 0.82) - 12} className="text-primary" size={16}>
                Im f
              </SvgLabel>
            )}
          </svg>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => replay([1, 0, 0, 1, Math.max(3, tE)], 1.4)}>
              <Play aria-hidden /> Animer depuis l&apos;identité
            </Button>
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">Matrice :</span>
            <div className="relative inline-grid grid-cols-2 gap-1.5 px-2.5 py-1.5">
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-2 rounded-l-md border-y-2 border-l-2 border-foreground/70"
              />
              <span
                aria-hidden
                className="absolute inset-y-0 right-0 w-2 rounded-r-md border-y-2 border-r-2 border-foreground/70"
              />
              {([0, 1] as const).map((i) =>
                ([0, 1] as const).map((j) => (
                  <NumberField
                    key={`${i}${j}`}
                    value={M[i][j]}
                    readOnly={!editable}
                    onChange={(v) => setEntry(i, j, v)}
                    ariaLabel={`Coefficient ${["a", "b", "c", "d"][2 * i + j]} (ligne ${i + 1}, colonne ${j + 1})`}
                  />
                )),
              )}
            </div>
            {editable && (
              <Button variant="ghost" size="sm" onClick={() => setM(matrix)}>
                <RotateCcw aria-hidden /> Réinitialiser
              </Button>
            )}
          </div>
          {editable && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Exemples de matrices">
              {PRESETS.map((p) => {
                const on = p.m.flat().every((x, i) => x === flat[i]);
                return (
                  <Button
                    key={p.label}
                    variant="outline"
                    size="sm"
                    aria-pressed={on}
                    onClick={() => setM(p.m)}
                    className={cn(on && "border-primary bg-brand-soft text-primary")}
                  >
                    {p.label}
                  </Button>
                );
              })}
            </div>
          )}
          <div className="space-y-1 overflow-x-auto rounded-lg bg-muted px-3 py-2 text-sm">
            <div>
              <Tex>{fTex}</Tex>
            </div>
            <div>
              <Tex>{`f(e_1) = (${FM[0][0].toTex()}, ${FM[1][0].toTex()}),\\quad f(e_2) = (${FM[0][1].toTex()}, ${FM[1][1].toTex()})`}</Tex>
            </div>
            <div>
              <Tex>{`\\det = ${FM[0][0].toTexParen()}\\times ${FM[1][1].toTexParen()} - ${FM[0][1].toTexParen()}\\times ${FM[1][0].toTexParen()} = ${det.toTex()}`}</Tex>
            </div>
          </div>
          <Feedback tone={ki.rank === 2 ? "success" : "info"}>
            <div className="space-y-1 overflow-x-auto">
              <div>
                <Tex>{ki.kerTex}</Tex>{" "}
                <span className="text-muted-foreground">
                  (<Tex>{`\\dim \\operatorname{Ker} f = ${2 - ki.rank}`}</Tex>)
                </span>
              </div>
              <div>
                <Tex>{ki.imTex}</Tex>{" "}
                <span className="text-muted-foreground">
                  (<Tex>{`\\operatorname{rg} f = ${ki.rank}`}</Tex>)
                </span>
              </div>
              <div className="text-muted-foreground">
                <Tex>{`\\operatorname{rg} f + \\dim\\operatorname{Ker} f = ${ki.rank} + ${2 - ki.rank} = 2`}</Tex>
              </div>
            </div>
            <p className="mt-1.5">
              {ki.rank === 2
                ? "Déterminant non nul : f est bijective (injective et surjective)."
                : ki.rank === 1
                  ? "Déterminant nul : le plan est écrasé sur la droite Im f (bleu épais) et la droite Ker f (tirets rouges) est envoyée sur l'origine. f n'est ni injective ni surjective."
                  : "f est l'application nulle : tout le plan est envoyé sur l'origine."}
            </p>
          </Feedback>
          <p className="text-xs text-muted-foreground">
            Grille fine : plan de départ. Grille bleue : son image par <Tex>f</Tex>. Jaune : image du carré unité (aire multipliée
            par <Tex>{`|\\det| = ${det.abs().toTex()}`}</Tex>).
          </p>
        </div>
      </div>
    </WidgetFrame>
  );
}

export default LinearMap2D;
