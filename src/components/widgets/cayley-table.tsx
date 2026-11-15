"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Md, Tex } from "@/components/math/md";
import { cn } from "@/lib/utils";
import { associativityCounterexample, commutativityMismatches, findNeutral, symmetrics, validateTable } from "./lib/cayley";
import { Feedback, ToggleChip, Toolbar, WidgetFrame } from "./shared";

export type CayleyTableProps = {
  elements: string[];
  table: number[][];
  opLatex: string;
  caption?: string;
};

type Mode = "neutral" | "sym" | "comm" | "assoc" | null;

export function CayleyTable({ elements, table, opLatex, caption }: CayleyTableProps) {
  const n = elements.length;
  const error = validateTable(n, table);
  const [active, setActive] = React.useState<[number, number] | null>(null);
  const [mode, setMode] = React.useState<Mode>(null);
  const tableRef = React.useRef<HTMLTableElement>(null);

  const analysis = React.useMemo(() => {
    if (error) return null;
    const e = findNeutral(table);
    return {
      e,
      sym: e === null ? null : symmetrics(table, e),
      mismatches: commutativityMismatches(table),
      counter: associativityCounterexample(table),
    };
  }, [table, error]);

  if (error || !analysis) {
    return (
      <WidgetFrame label="Table de Cayley">
        <Feedback tone="danger">Table invalide : {error}</Feedback>
      </WidgetFrame>
    );
  }
  const { e, sym, mismatches, counter } = analysis;
  const el = (i: number) => elements[i];
  const opTex = (a: number, b: number) => `${el(a)} ${opLatex} ${el(b)}`;

  const mismatchSet = new Set(mismatches.flatMap(([i, j]) => [`${i}-${j}`, `${j}-${i}`]));
  const counterCells = new Set<string>();
  if (counter) {
    const [a, b, c] = counter;
    counterCells.add(`${a}-${b}`).add(`${table[a][b]}-${c}`).add(`${b}-${c}`).add(`${a}-${table[b][c]}`);
  }

  const cellClass = (i: number, j: number) => {
    const key = `${i}-${j}`;
    if (mode === "neutral" && e !== null && (i === e || j === e)) return "bg-brand-soft text-primary font-semibold";
    if (mode === "sym" && e !== null && table[i][j] === e && table[j][i] === e)
      return "bg-reward-soft text-reward-foreground font-semibold";
    if (mode === "comm") {
      if (i === j) return "bg-muted";
      return mismatchSet.has(key) ? "bg-danger-soft text-danger font-semibold" : "bg-success-soft";
    }
    if (mode === "assoc" && counterCells.has(key)) return "bg-danger-soft ring-2 ring-inset ring-danger/60";
    if (active && (active[0] === i || active[1] === j)) return "bg-muted";
    return "";
  };

  const headerActive = (axis: 0 | 1, k: number) => (active && active[axis] === k) || (mode === "neutral" && e === k);

  const onKey = (ev: React.KeyboardEvent, i: number, j: number) => {
    const moves: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const m = moves[ev.key];
    if (!m) return;
    ev.preventDefault();
    const ni = Math.min(n - 1, Math.max(0, i + m[0]));
    const nj = Math.min(n - 1, Math.max(0, j + m[1]));
    tableRef.current?.querySelector<HTMLButtonElement>(`[data-cell="${ni}-${nj}"]`)?.focus();
  };

  const toggle = (m: Exclude<Mode, null>) => (on: boolean) => setMode(on ? m : null);

  return (
    <WidgetFrame label="Table de Cayley">
      <Toolbar label="Analyses de la table">
        <ToggleChip pressed={mode === "neutral"} onPressedChange={toggle("neutral")}>
          Neutre
        </ToggleChip>
        <ToggleChip pressed={mode === "sym"} onPressedChange={toggle("sym")}>
          Symétriques
        </ToggleChip>
        <ToggleChip pressed={mode === "comm"} onPressedChange={toggle("comm")}>
          Commutativité
        </ToggleChip>
        <ToggleChip pressed={mode === "assoc"} onPressedChange={toggle("assoc")}>
          Associativité
        </ToggleChip>
      </Toolbar>

      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <table ref={tableRef} className="mx-auto border-separate border-spacing-0.5 text-sm" onMouseLeave={() => setActive(null)}>
          <caption className="sr-only">{caption ?? "Table de la loi"}</caption>
          <thead>
            <tr>
              <th scope="col" className="h-10 min-w-11 rounded-md bg-muted px-1.5 text-base">
                <Tex>{opLatex}</Tex>
              </th>
              {elements.map((lab, j) => (
                <th
                  key={j}
                  scope="col"
                  className={cn(
                    "h-10 min-w-11 rounded-md border-b-2 px-1.5 font-normal whitespace-nowrap transition-colors duration-200",
                    headerActive(1, j) ? "border-reward bg-reward-soft text-reward-foreground" : "border-border",
                  )}
                >
                  <Tex>{lab}</Tex>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.map((row, i) => (
              <tr key={i}>
                <th
                  scope="row"
                  className={cn(
                    "h-10 min-w-11 rounded-md border-r-2 px-1.5 font-normal whitespace-nowrap transition-colors duration-200",
                    headerActive(0, i) ? "border-reward bg-reward-soft text-reward-foreground" : "border-border",
                  )}
                >
                  <Tex>{elements[i]}</Tex>
                </th>
                {row.map((v, j) => (
                  <td key={j} className="p-0">
                    <button
                      type="button"
                      data-cell={`${i}-${j}`}
                      onMouseEnter={() => setActive([i, j])}
                      onFocus={() => setActive([i, j])}
                      onClick={() => setActive([i, j])}
                      onKeyDown={(ev) => onKey(ev, i, j)}
                      className={cn(
                        "flex h-10 w-full min-w-11 items-center justify-center rounded-md px-1.5 whitespace-nowrap transition-colors duration-200 outline-none hover:ring-1 hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-primary",
                        cellClass(i, j),
                      )}
                    >
                      <span className="sr-only">
                        Ligne {i + 1}, colonne {j + 1} :{" "}
                      </span>
                      <Tex>{elements[v]}</Tex>
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {caption && (
        <p className="text-center text-xs text-muted-foreground">
          <Md inline>{caption}</Md>
        </p>
      )}

      <div className="min-h-10 overflow-x-auto rounded-lg bg-muted px-3 py-2 text-center text-sm" aria-live="polite">
        {active ? (
          <Tex>{`${opTex(active[0], active[1])} = ${el(table[active[0]][active[1]])}`}</Tex>
        ) : (
          <span className="text-muted-foreground">
            Survolez ou sélectionnez une case : ligne <Tex>a</Tex>, colonne <Tex>b</Tex>, elle contient{" "}
            <Tex>{`a ${opLatex} b`}</Tex>.
          </span>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {mode && (
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            {mode === "neutral" &&
              (e !== null ? (
                <Feedback tone="info">
                  Le neutre est <Tex>{el(e)}</Tex> : sa ligne et sa colonne recopient les en-têtes (
                  <Tex>{`${el(e)} ${opLatex} x = x ${opLatex} ${el(e)} = x`}</Tex>).
                </Feedback>
              ) : (
                <Feedback tone="danger">
                  Pas d&apos;élément neutre : aucune ligne dont la colonne correspondante recopie les en-têtes.
                </Feedback>
              ))}

            {mode === "sym" &&
              (e === null || !sym ? (
                <Feedback tone="danger">Sans élément neutre, la notion de symétrique n&apos;a pas de sens ici.</Feedback>
              ) : (
                <Feedback tone="highlight">
                  <p className="mb-1.5">
                    En jaune : les cases égales au neutre <Tex>{el(e)}</Tex> (avec la case symétrique aussi égale à{" "}
                    <Tex>{el(e)}</Tex>).
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {sym.map((s, i) => (
                      <li key={i} className="rounded-md border border-border bg-card px-2 py-0.5">
                        {s === null ? (
                          <>
                            <Tex>{el(i)}</Tex> : pas de symétrique
                          </>
                        ) : (
                          <Tex>{`${el(i)} \\;\\leftrightarrow\\; ${el(s)}`}</Tex>
                        )}
                      </li>
                    ))}
                  </ul>
                  {sym.every((s) => s !== null) && <p className="mt-1.5">Tout élément a un symétrique.</p>}
                </Feedback>
              ))}

            {mode === "comm" &&
              (mismatches.length === 0 ? (
                <Feedback tone="success">La table est symétrique par rapport à la diagonale : la loi est commutative.</Feedback>
              ) : (
                <Feedback tone="danger">
                  La table n&apos;est pas symétrique par rapport à la diagonale ({mismatches.length} paire
                  {mismatches.length > 1 ? "s" : ""} en rouge). Par exemple{" "}
                  <Tex>{`${opTex(mismatches[0][0], mismatches[0][1])} = ${el(table[mismatches[0][0]][mismatches[0][1]])}`}</Tex>{" "}
                  mais{" "}
                  <Tex>{`${opTex(mismatches[0][1], mismatches[0][0])} = ${el(table[mismatches[0][1]][mismatches[0][0]])}`}</Tex>:
                  la loi n&apos;est pas commutative.
                </Feedback>
              ))}

            {mode === "assoc" &&
              (counter === null ? (
                <Feedback tone="success">
                  Les {n}³ = {n ** 3} triplets <Tex>{"(a,b,c)"}</Tex> vérifient{" "}
                  <Tex>{`(a ${opLatex} b) ${opLatex} c = a ${opLatex} (b ${opLatex} c)`}</Tex> : la loi est associative.
                </Feedback>
              ) : (
                <Feedback tone="danger">
                  <p>Contre-exemple (cases encadrées) :</p>
                  <div className="overflow-x-auto py-1">
                    <Tex>{`(${opTex(counter[0], counter[1])}) ${opLatex} ${el(counter[2])} = ${el(table[counter[0]][counter[1]])} ${opLatex} ${el(counter[2])} = ${el(table[table[counter[0]][counter[1]]][counter[2]])}`}</Tex>
                  </div>
                  <div className="overflow-x-auto py-1">
                    <Tex>{`${el(counter[0])} ${opLatex} (${opTex(counter[1], counter[2])}) = ${el(counter[0])} ${opLatex} ${el(table[counter[1]][counter[2]])} = ${el(table[counter[0]][table[counter[1]][counter[2]]])}`}</Tex>
                  </div>
                  <p>Les deux résultats diffèrent : la loi n&apos;est pas associative.</p>
                </Feedback>
              ))}
          </motion.div>
        )}
      </AnimatePresence>
    </WidgetFrame>
  );
}

export default CayleyTable;
