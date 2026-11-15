import { Frac, coefTex } from "./fraction";

export type FracMatrix = Frac[][];

export type GaussStep = {
  kind: "start" | "swap" | "eliminate" | "pivot" | "done";
  /** TeX of the row operation (empty for start/done). */
  tex: string;
  /** Short French explanation (may contain $…$ math). */
  text: string;
  /** Matrix after this step. */
  matrix: FracMatrix;
  /** Pivots found so far, as [row, col]. */
  pivots: [number, number][];
  /** Rows changed by this step. */
  rows: number[];
};

export type GaussResult = { steps: GaussStep[]; rank: number; pivots: [number, number][]; error?: string };

export function toFracMatrix(m: number[][]): FracMatrix {
  return m.map((row) => row.map((x) => Frac.fromNumber(x)));
}

export function isRectangular(m: unknown[][]): boolean {
  return m.length > 0 && m[0].length > 0 && m.every((r) => r.length === m[0].length);
}

const L = (i: number) => `L_{${i + 1}}`;

/** TeX of L_i ← L_i − f·L_r, written with the natural sign. */
export function eliminationTex(i: number, r: number, f: Frac): string {
  const op = f.sign() > 0 ? "-" : "+";
  return `${L(i)} \\leftarrow ${L(i)} ${op} ${coefTex(f.abs())}${L(r)}`;
}

/**
 * Row reduction to (non-reduced) echelon form with exact fractions.
 * Pivot choice: keep the current row when its entry is non-zero, otherwise swap with the
 * first row below that has a non-zero entry in the column. One step per elementary operation.
 */
export function gaussSteps(input: number[][]): GaussResult {
  if (!isRectangular(input)) {
    return { steps: [], rank: 0, pivots: [], error: "La matrice doit être rectangulaire et non vide." };
  }
  let M = toFracMatrix(input);
  const rows = M.length;
  const cols = M[0].length;
  const pivots: [number, number][] = [];
  const snapshot = () => M.map((r) => r.slice());
  const steps: GaussStep[] = [{ kind: "start", tex: "", text: "Matrice de départ.", matrix: snapshot(), pivots: [], rows: [] }];

  let r = 0;
  for (let c = 0; c < cols && r < rows; c++) {
    let p = -1;
    for (let i = r; i < rows; i++) {
      if (!M[i][c].isZero()) {
        p = i;
        break;
      }
    }
    if (p < 0) continue;
    let opsForPivot = 0;
    if (p !== r) {
      M = M.map((row, i) => (i === r ? M[p] : i === p ? M[r] : row));
      steps.push({
        kind: "swap",
        tex: `${L(r)} \\leftrightarrow ${L(p)}`,
        text: `Le coefficient en ligne ${r + 1}, colonne ${c + 1} est nul : on échange deux lignes pour obtenir un pivot non nul.`,
        matrix: snapshot(),
        pivots: [...pivots, [r, c]],
        rows: [r, p],
      });
      opsForPivot++;
    }
    pivots.push([r, c]);
    const piv = M[r][c];
    for (let i = r + 1; i < rows; i++) {
      if (M[i][c].isZero()) continue;
      const f = M[i][c].div(piv);
      M = M.map((row, k) => (k === i ? row.map((x, j) => x.sub(f.mul(M[r][j]))) : row));
      steps.push({
        kind: "eliminate",
        tex: eliminationTex(i, r, f),
        text: `On annule le coefficient sous le pivot $${piv.toTex()}$ (colonne ${c + 1}).`,
        matrix: snapshot(),
        pivots: pivots.slice(),
        rows: [i],
      });
      opsForPivot++;
    }
    if (opsForPivot === 0) {
      steps.push({
        kind: "pivot",
        tex: "",
        text: `Pivot $${piv.toTex()}$ en ligne ${r + 1}, colonne ${c + 1} : rien à annuler en dessous.`,
        matrix: snapshot(),
        pivots: pivots.slice(),
        rows: [r],
      });
    }
    r++;
  }
  const rank = pivots.length;
  const zeroRows = rows - rank;
  steps.push({
    kind: "done",
    tex: `\\operatorname{rg} = ${rank}`,
    text:
      `Forme échelonnée : ${rank} pivot${rank > 1 ? "s" : ""}` +
      (zeroRows > 0 ? ` et ${zeroRows} ligne${zeroRows > 1 ? "s" : ""} nulle${zeroRows > 1 ? "s" : ""}` : "") +
      `, donc le rang vaut ${rank}.`,
    matrix: snapshot(),
    pivots: pivots.slice(),
    rows: [],
  });
  return { steps, rank, pivots };
}
