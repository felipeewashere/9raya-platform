"use client";

import * as React from "react";
import { motion } from "motion/react";
import { ChevronRight, FastForward, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tex } from "@/components/math/md";
import { cn } from "@/lib/utils";
import {
  add,
  degree,
  divisionSteps,
  monomial,
  polyDegreeTex,
  polyFromNumbers,
  polyTex,
  termTex,
  trim,
  type Poly,
} from "./lib/polynomial";
import { Feedback, WidgetFrame } from "./shared";

export type PolyDivisionProps = { A: number[]; B: number[] };

type Row = { key: string; poly: Poly; sign?: "-"; underline?: boolean; tone?: "product" | "rest" | "current" };

export function PolyDivision({ A: Ain, B: Bin }: PolyDivisionProps) {
  const A = React.useMemo(() => polyFromNumbers(Ain), [Ain]);
  const B = React.useMemo(() => polyFromNumbers(Bin), [Bin]);
  const res = React.useMemo(() => divisionSteps(A, B), [A, B]);
  const [s, setS] = React.useState(0);

  if (res.error) {
    return (
      <WidgetFrame label="Division euclidienne de polynômes">
        <Feedback tone="danger">{res.error}</Feedback>
      </WidgetFrame>
    );
  }

  const { steps, Q, R } = res;
  const total = steps.length;
  const dA = Math.max(degree(A), 0);
  const cols = Array.from({ length: dA + 1 }, (_, i) => dA - i); // degrees, high → low

  const rows: Row[] = [{ key: "A", poly: A, tone: s === 0 ? "current" : undefined }];
  steps.slice(0, s).forEach((st, i) => {
    rows.push({ key: `p${i}`, poly: st.product, sign: "-", underline: true, tone: i === s - 1 ? "product" : undefined });
    rows.push({ key: `r${i}`, poly: st.after, tone: i === s - 1 ? "rest" : undefined });
  });
  const partialQ = steps.slice(0, s).reduce<Poly>((q, st) => add(q, monomial(st.coef, st.deg)), []);

  const cur = s > 0 ? steps[s - 1] : null;
  const done = s >= total;

  const termCells = (row: Row) => {
    const t = trim(row.poly);
    const lead = t.length - 1;
    return cols.map((k) => {
      const c = t[k];
      if (!c || c.isZero()) {
        // show "0" for a zero remainder in the constant column
        if (k === 0 && t.length === 0 && row.tone !== "product" && row.key !== "A") return "0";
        return "";
      }
      return termTex(c, k, k === lead);
    });
  };

  return (
    <WidgetFrame label="Division euclidienne de polynômes pas à pas">
      <div className="-mx-1 overflow-x-auto px-1 py-1">
        <div className="flex w-max items-start text-sm" role="group" aria-label="Disposition de la division (potence)">
          {/* left: dividend and successive remainders */}
          <div
            className="grid items-center gap-y-0.5 border-r-2 border-foreground/70 pr-2"
            style={{ gridTemplateColumns: `0.9rem repeat(${cols.length}, auto)` }}
          >
            {rows.map((row) => {
              const cells = termCells(row);
              const lead = degree(row.poly);
              return (
                <React.Fragment key={row.key}>
                  <div className="h-8 text-center leading-8">{row.sign && <Tex>-</Tex>}</div>
                  {cells.map((c, idx) => (
                    <motion.div
                      key={`${row.key}-${idx}`}
                      initial={row.key === "A" ? false : { opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, delay: row.sign ? 0 : 0.12 }}
                      className={cn(
                        "flex h-8 items-center justify-end px-1 whitespace-nowrap",
                        row.underline && cols[idx] <= lead && "border-b border-foreground/60",
                        row.tone === "product" && c && "bg-brand-soft",
                        row.tone === "rest" && c && "bg-reward-soft",
                      )}
                    >
                      {c && <Tex>{c}</Tex>}
                    </motion.div>
                  ))}
                </React.Fragment>
              );
            })}
          </div>
          {/* right: divisor and quotient */}
          <div className="min-w-20 pl-2">
            <div className="flex h-8 items-center border-b-2 border-foreground/70 pr-2 whitespace-nowrap">
              <Tex>{polyTex(B)}</Tex>
            </div>
            <motion.div
              key={s}
              initial={{ opacity: 0.4 }}
              animate={{ opacity: 1 }}
              className="flex h-8 items-center pr-2 whitespace-nowrap"
            >
              {s > 0 ? <Tex>{polyTex(partialQ)}</Tex> : <span className="text-muted-foreground">?</span>}
            </motion.div>
          </div>
        </div>
      </div>

      <div className="min-h-14 overflow-x-auto rounded-lg bg-muted px-3 py-2 text-sm" aria-live="polite">
        {total === 0 ? (
          <p>
            <Tex>{`\\deg A = ${polyDegreeTex(A)} < \\deg B = ${polyDegreeTex(B)}`}</Tex> : rien à diviser, <Tex>Q = 0</Tex> et{" "}
            <Tex>R = A</Tex>.
          </p>
        ) : cur ? (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              Étape {s}/{total}
            </p>
            <div>
              Terme du quotient :{" "}
              <Tex>{`\\dfrac{${termTex(trim(cur.before)[degree(cur.before)], degree(cur.before), true)}}{${termTex(trim(B)[degree(B)], degree(B), true)}} = ${termTex(cur.coef, cur.deg, true)}`}</Tex>
            </div>
            <div>
              On retranche{" "}
              <Tex>{`(${polyTex(B)})\\times ${cur.deg === 0 || !cur.coef.isOne() ? `\\left(${termTex(cur.coef, cur.deg, true)}\\right)` : termTex(cur.coef, cur.deg, true)} = ${polyTex(cur.product)}`}</Tex>
            </div>
            <div>
              Nouveau reste : <Tex>{polyTex(cur.after)}</Tex>{" "}
              <span className="text-muted-foreground">
                (degré <Tex>{polyDegreeTex(cur.after)}</Tex>
                {degree(cur.after) < degree(B) ? ", inférieur à celui de B : on s'arrête" : ", on continue"})
              </span>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">
            À chaque étape, on divise le terme de plus haut degré du reste par celui de <Tex>B</Tex>. Cliquez sur « Étape suivante
            ».
          </p>
        )}
      </div>

      {total > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setS((x) => Math.min(total, x + 1))} disabled={done}>
            Étape suivante <ChevronRight aria-hidden />
          </Button>
          <Button variant="outline" onClick={() => setS(total)} disabled={done}>
            <FastForward aria-hidden /> Tout afficher
          </Button>
          <Button variant="ghost" onClick={() => setS(0)} disabled={s === 0}>
            <RotateCcw aria-hidden /> Recommencer
          </Button>
        </div>
      )}

      {done && (
        <Feedback tone="success">
          <div className="space-y-1 overflow-x-auto">
            <div>
              <Tex>{`\\underbrace{${polyTex(A)}}_{A} = \\underbrace{(${polyTex(B)})}_{B}\\,\\underbrace{(${polyTex(Q)})}_{Q} ${
                R.length ? `+ \\underbrace{${R[R.length - 1].sign() > 0 ? polyTex(R) : `(${polyTex(R)})`}}_{R}` : ""
              }`}</Tex>
            </div>
            <div className="text-sm">
              <Tex>{`Q = ${polyTex(Q)},\\quad R = ${polyTex(R)}`}</Tex>
            </div>
            <div className="text-sm">
              <Tex>{`\\deg R = ${polyDegreeTex(R)} < \\deg B = ${polyDegreeTex(B)}`}</Tex> <span className="text-success">✓</span>
              {R.length === 0 && (
                <span>
                  {" "}
                  — le reste est nul : <Tex>B</Tex> divise <Tex>A</Tex>.
                </span>
              )}
            </div>
          </div>
        </Feedback>
      )}
    </WidgetFrame>
  );
}

export default PolyDivision;
