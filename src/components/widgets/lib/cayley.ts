/** Checks on a finite operation table: table[i][j] = index of elements[i] ⋆ elements[j]. */

export type Table = number[][];

/** Null when the table is a valid n×n table with entries in [0, n). */
export function validateTable(n: number, table: Table): string | null {
  if (table.length !== n) return `La table a ${table.length} lignes au lieu de ${n}.`;
  for (let i = 0; i < n; i++) {
    if (table[i].length !== n) return `La ligne ${i + 1} a ${table[i].length} cases au lieu de ${n}.`;
    for (const v of table[i]) {
      if (!Number.isInteger(v) || v < 0 || v >= n) return `Case invalide en ligne ${i + 1} : ${v}.`;
    }
  }
  return null;
}

/** Index of the two-sided neutral element, or null. */
export function findNeutral(table: Table): number | null {
  const n = table.length;
  for (let e = 0; e < n; e++) {
    let ok = true;
    for (let x = 0; x < n && ok; x++) ok = table[e][x] === x && table[x][e] === x;
    if (ok) return e;
  }
  return null;
}

/** For each element, the index of a two-sided symmetric (x⋆y = y⋆x = e), or null. */
export function symmetrics(table: Table, e: number): (number | null)[] {
  const n = table.length;
  return Array.from({ length: n }, (_, x) => {
    for (let y = 0; y < n; y++) if (table[x][y] === e && table[y][x] === e) return y;
    return null;
  });
}

/** Pairs (i, j), i < j, with table[i][j] ≠ table[j][i]. */
export function commutativityMismatches(table: Table): [number, number][] {
  const out: [number, number][] = [];
  const n = table.length;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (table[i][j] !== table[j][i]) out.push([i, j]);
  return out;
}

/** First triple (a, b, c) with (a⋆b)⋆c ≠ a⋆(b⋆c), or null if the law is associative. */
export function associativityCounterexample(table: Table): [number, number, number] | null {
  const n = table.length;
  for (let a = 0; a < n; a++)
    for (let b = 0; b < n; b++) for (let c = 0; c < n; c++) if (table[table[a][b]][c] !== table[a][table[b][c]]) return [a, b, c];
  return null;
}
