"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, FastForward, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tex } from "@/components/math/md";
import { Frac } from "./lib/fraction";
import { isRectangular } from "./lib/gauss";
import { Feedback, MatrixView, WidgetFrame } from "./shared";

export type MatrixProductProps = { A: number[][]; B: number[][] };

export function MatrixProduct({ A, B }: MatrixProductProps) {
  const [k, setK] = React.useState(0);
  const okA = isRectangular(A);
  const okB = isRectangular(B);
  const m = A.length;
  const n = okA ? A[0].length : 0;
  const q = B.length;
  const p = okB ? B[0].length : 0;

  const FA = React.useMemo(() => (okA ? A.map((r) => r.map((x) => Frac.fromNumber(x))) : []), [A, okA]);
  const FB = React.useMemo(() => (okB ? B.map((r) => r.map((x) => Frac.fromNumber(x))) : []), [B, okB]);
  const compatible = okA && okB && n === q;
  const C = React.useMemo(
    () =>
      compatible
        ? FA.map((row) => Array.from({ length: p }, (_, j) => row.reduce((s, a, l) => s.add(a.mul(FB[l][j])), Frac.ZERO)))
        : [],
    [FA, FB, p, compatible],
  );

  if (!okA || !okB) {
    return (
      <WidgetFrame label="Produit de matrices">
        <Feedback tone="danger">Les matrices doivent être rectangulaires et non vides.</Feedback>
      </WidgetFrame>
    );
  }

  const size = `${m}\\times ${n}`;
  const sizeB = `${q}\\times ${p}`;
  if (!compatible) {
    return (
      <WidgetFrame label="Produit de matrices">
        <div className="flex flex-wrap items-center gap-3 overflow-x-auto">
          <MatrixView cells={FA.map((r) => r.map((x) => x.toTex()))} label="Matrice A" />
          <Tex>{"\\times"}</Tex>
          <MatrixView cells={FB.map((r) => r.map((x) => x.toTex()))} label="Matrice B" />
        </div>
        <Feedback tone="danger">
          Produit impossible : <Tex>A</Tex> est de taille <Tex>{size}</Tex> et <Tex>B</Tex> de taille <Tex>{sizeB}</Tex>. Il faut
          que le nombre de colonnes de <Tex>A</Tex> ({n}) soit égal au nombre de lignes de <Tex>B</Tex> ({q}).
        </Feedback>
      </WidgetFrame>
    );
  }

  const total = m * p;
  const cur = k > 0 ? { i: Math.floor((k - 1) / p), j: (k - 1) % p } : null;
  const done = (i: number, j: number) => i * p + j < k;

  const sumTex = cur
    ? `c_{${cur.i + 1}${cur.j + 1}} = ` +
      FA[cur.i].map((a, l) => `${a.toTexParen()}\\times ${FB[l][cur.j].toTexParen()}`).join(" + ") +
      ` = ${C[cur.i][cur.j].toTex()}`
    : "";
  const symTex = cur
    ? `c_{${cur.i + 1}${cur.j + 1}} = ` + FA[cur.i].map((_, l) => `a_{${cur.i + 1}${l + 1}}b_{${l + 1}${cur.j + 1}}`).join(" + ")
    : "";

  return (
    <WidgetFrame label="Produit de matrices pas à pas">
      <p className="text-sm text-muted-foreground">
        <Tex>A</Tex> est <Tex>{size}</Tex>, <Tex>B</Tex> est <Tex>{sizeB}</Tex> : <Tex>{`C = AB`}</Tex> est{" "}
        <Tex>{`${m}\\times ${p}`}</Tex>.
      </p>
      <div className="-mx-1 overflow-x-auto px-1 py-1">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          <div className="space-y-1 text-center">
            <MatrixView
              cells={FA.map((r) => r.map((x) => x.toTex()))}
              label="Matrice A"
              cellClass={(i) => (cur && i === cur.i ? "bg-brand-soft text-primary font-semibold" : undefined)}
            />
            <div className="text-xs text-muted-foreground">
              <Tex>A</Tex>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Tex>{"\\times"}</Tex>
            <div className="space-y-1 text-center">
              <MatrixView
                cells={FB.map((r) => r.map((x) => x.toTex()))}
                label="Matrice B"
                cellClass={(_, j) => (cur && j === cur.j ? "bg-brand-soft text-primary font-semibold" : undefined)}
              />
              <div className="text-xs text-muted-foreground">
                <Tex>B</Tex>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Tex>{"="}</Tex>
            <div className="space-y-1 text-center">
              <MatrixView
                cells={C.map((r, i) => r.map((x, j) => (done(i, j) ? x.toTex() : "\\cdot")))}
                label="Matrice C = AB"
                cellClass={(i, j) =>
                  cur && i === cur.i && j === cur.j
                    ? "bg-reward-soft text-reward-foreground font-semibold ring-1 ring-reward"
                    : done(i, j)
                      ? undefined
                      : "text-muted-foreground"
                }
              />
              <div className="text-xs text-muted-foreground">
                <Tex>C</Tex>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-16 overflow-x-auto rounded-lg bg-muted px-3 py-2 text-sm" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={k}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {cur ? (
              <div className="space-y-1">
                <p>
                  Ligne {cur.i + 1} de <Tex>A</Tex> × colonne {cur.j + 1} de <Tex>B</Tex> :
                </p>
                <div>
                  <Tex>{symTex}</Tex>
                </div>
                <div>
                  <Tex>{sumTex}</Tex>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">
                Chaque coefficient <Tex>{"c_{ij}"}</Tex> est la somme des produits de la ligne <Tex>i</Tex> de <Tex>A</Tex> par la
                colonne <Tex>j</Tex> de <Tex>B</Tex>. Cliquez sur « Étape suivante ».
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setK((x) => Math.min(total, x + 1))} disabled={k >= total}>
          Étape suivante <ChevronRight aria-hidden />
        </Button>
        <Button variant="outline" onClick={() => setK(total)} disabled={k >= total}>
          <FastForward aria-hidden /> Tout calculer
        </Button>
        <Button variant="ghost" onClick={() => setK(0)} disabled={k === 0}>
          <RotateCcw aria-hidden /> Recommencer
        </Button>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {k}/{total} coefficients
        </span>
      </div>
      {k >= total && (
        <Feedback tone="success">
          <div className="overflow-x-auto">
            <Tex>{`AB = \\begin{pmatrix} ${C.map((r) => r.map((x) => x.toTex()).join(" & ")).join(" \\\\ ")} \\end{pmatrix}`}</Tex>
            {m === p && C.every((r, i) => r.every((x, j) => x.eq(i === j ? Frac.ONE : Frac.ZERO))) && (
              <span>
                {" "}
                <Tex>{`= I_{${m}}`}</Tex>
              </span>
            )}
          </div>
        </Feedback>
      )}
    </WidgetFrame>
  );
}

export default MatrixProduct;
