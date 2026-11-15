"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, FastForward, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Md, Tex } from "@/components/math/md";
import { cn } from "@/lib/utils";
import { gaussSteps } from "./lib/gauss";
import { Feedback, MatrixView, WidgetFrame } from "./shared";

export type GaussRankProps = { matrix: number[][] };

export function GaussRank({ matrix }: GaussRankProps) {
  const result = React.useMemo(() => gaussSteps(matrix), [matrix]);
  const [s, setS] = React.useState(0);

  if (result.error) {
    return (
      <WidgetFrame label="Rang par échelonnement">
        <Feedback tone="danger">{result.error}</Feedback>
      </WidgetFrame>
    );
  }

  const { steps } = result;
  const last = steps.length - 1;
  const step = steps[s];
  const pivotSet = new Set(step.pivots.map(([r, c]) => `${r}-${c}`));
  const rows = step.matrix.length;
  const ops = steps.slice(1, s + 1).filter((x) => x.tex && x.kind !== "done");

  return (
    <WidgetFrame label="Rang par échelonnement pas à pas">
      <div className="-mx-1 overflow-x-auto px-1 py-1">
        <div className="flex w-max items-center gap-1.5">
          <div className="flex flex-col gap-0.5 py-1" aria-hidden>
            {Array.from({ length: rows }, (_, i) => (
              <div
                key={i}
                className={cn(
                  "flex h-9 items-center pr-1 text-xs transition-colors",
                  step.rows.includes(i) ? "font-semibold text-primary" : "text-muted-foreground",
                )}
              >
                <Tex>{`L_{${i + 1}}`}</Tex>
              </div>
            ))}
          </div>
          <MatrixView
            label={`Matrice à l'étape ${s}`}
            cells={step.matrix.map((r) => r.map((x) => x.toTex()))}
            cellClass={(i, j) =>
              cn(
                "h-9",
                pivotSet.has(`${i}-${j}`)
                  ? "bg-reward-soft text-reward-foreground font-semibold ring-1 ring-reward"
                  : step.rows.includes(i)
                    ? "bg-brand-soft"
                    : undefined,
                step.kind === "done" && step.matrix[i].every((x) => x.isZero()) && "text-muted-foreground",
              )
            }
          />
        </div>
      </div>

      <div className="min-h-16 rounded-lg bg-muted px-3 py-2 text-sm" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={s}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div className="mb-1 text-xs text-muted-foreground">
              Étape {s}/{last}
            </div>
            {step.tex && step.kind !== "done" && (
              <div className="overflow-x-auto text-base">
                <Tex>{step.tex}</Tex>
              </div>
            )}
            <Md inline>{step.text}</Md>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setS((x) => Math.max(0, x - 1))}
          disabled={s === 0}
          aria-label="Étape précédente"
        >
          <ChevronLeft aria-hidden />
        </Button>
        <Button onClick={() => setS((x) => Math.min(last, x + 1))} disabled={s >= last}>
          Étape suivante <ChevronRight aria-hidden />
        </Button>
        <Button variant="outline" onClick={() => setS(last)} disabled={s >= last}>
          <FastForward aria-hidden /> Tout afficher
        </Button>
        <Button variant="ghost" onClick={() => setS(0)} disabled={s === 0}>
          <RotateCcw aria-hidden /> Recommencer
        </Button>
      </div>

      {ops.length > 0 && (
        <details className="text-sm" open={s >= last}>
          <summary className="cursor-pointer text-muted-foreground">Opérations effectuées ({ops.length})</summary>
          <ol className="mt-1 flex flex-wrap gap-1.5">
            {ops.map((o, idx) => (
              <li key={idx} className="rounded-md border border-border px-2 py-0.5">
                <Tex>{o.tex}</Tex>
              </li>
            ))}
          </ol>
        </details>
      )}

      {s >= last && (
        <Feedback tone="success">
          <Tex>{`\\operatorname{rg} = ${result.rank}`}</Tex> : {result.rank} pivot{result.rank > 1 ? "s" : ""} (en jaune) dans la
          forme échelonnée.
        </Feedback>
      )}
    </WidgetFrame>
  );
}

export default GaussRank;
