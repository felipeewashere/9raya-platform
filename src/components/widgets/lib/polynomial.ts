import { Frac, coefTex } from "./fraction";

/** Polynomial with exact coefficients in ASCENDING degree: [a0, a1, a2, ...]. */
export type Poly = Frac[];

export function polyFromNumbers(coeffs: number[]): Poly {
  return trim(coeffs.map((c) => Frac.fromNumber(c)));
}

/** Removes leading (high-degree) zero coefficients. The zero polynomial is []. */
export function trim(p: Poly): Poly {
  let n = p.length;
  while (n > 0 && p[n - 1].isZero()) n--;
  return p.slice(0, n);
}

/** Degree; −1 stands for the zero polynomial (deg 0 = −∞). */
export function degree(p: Poly): number {
  return trim(p).length - 1;
}

export function isZeroPoly(p: Poly): boolean {
  return degree(p) < 0;
}

export function leading(p: Poly): Frac {
  const t = trim(p);
  return t.length ? t[t.length - 1] : Frac.ZERO;
}

export function add(a: Poly, b: Poly): Poly {
  const n = Math.max(a.length, b.length);
  const out: Poly = [];
  for (let i = 0; i < n; i++) out.push((a[i] ?? Frac.ZERO).add(b[i] ?? Frac.ZERO));
  return trim(out);
}

export function sub(a: Poly, b: Poly): Poly {
  return add(a, scale(b, Frac.ONE.neg()));
}

export function scale(p: Poly, c: Frac): Poly {
  return trim(p.map((x) => x.mul(c)));
}

export function mul(a: Poly, b: Poly): Poly {
  if (!a.length || !b.length) return [];
  const out: Poly = Array.from({ length: a.length + b.length - 1 }, () => Frac.ZERO);
  a.forEach((x, i) => b.forEach((y, j) => (out[i + j] = out[i + j].add(x.mul(y)))));
  return trim(out);
}

export function monomial(c: Frac, k: number): Poly {
  const out: Poly = Array.from({ length: k + 1 }, () => Frac.ZERO);
  out[k] = c;
  return trim(out);
}

export function derivative(p: Poly): Poly {
  return trim(p.slice(1).map((c, i) => c.mul(Frac.of(i + 1))));
}

export function evalFrac(p: Poly, x: Frac): Frac {
  let acc = Frac.ZERO;
  for (let i = p.length - 1; i >= 0; i--) acc = acc.mul(x).add(p[i]);
  return acc;
}

export function polyEq(a: Poly, b: Poly): boolean {
  const x = trim(a);
  const y = trim(b);
  return x.length === y.length && x.every((c, i) => c.eq(y[i]));
}

export type DivisionStep = {
  /** Quotient term added at this step: coef · X^deg. */
  coef: Frac;
  deg: number;
  /** Remainder before the step. */
  before: Poly;
  /** B · (coef X^deg), the polynomial that is subtracted. */
  product: Poly;
  /** Remainder after the step. */
  after: Poly;
};

export type DivisionResult = { steps: DivisionStep[]; Q: Poly; R: Poly; error?: string };

/** Euclidean division A = BQ + R with deg R < deg B, one step per quotient term. */
export function divisionSteps(Ain: Poly, Bin: Poly): DivisionResult {
  const A = trim(Ain);
  const B = trim(Bin);
  if (!B.length) return { steps: [], Q: [], R: A, error: "Le diviseur B ne doit pas être le polynôme nul." };
  const dB = B.length - 1;
  const lB = B[dB];
  let R = A;
  let Q: Poly = [];
  const steps: DivisionStep[] = [];
  let guard = 0;
  while (R.length - 1 >= dB && guard++ < 64) {
    const deg = R.length - 1 - dB;
    const coef = R[R.length - 1].div(lB);
    const term = monomial(coef, deg);
    const product = mul(B, term);
    const after = sub(R, product);
    steps.push({ coef, deg, before: R, product, after });
    Q = add(Q, term);
    R = after;
  }
  return { steps, Q, R };
}

/** Monic normalization (zero polynomial stays zero). */
export function monic(p: Poly): Poly {
  const t = trim(p);
  return t.length ? scale(t, t[t.length - 1].inv()) : t;
}

export function polyGcd(a: Poly, b: Poly): Poly {
  let x = trim(a);
  let y = trim(b);
  while (y.length) {
    const { R } = divisionSteps(x, y);
    x = y;
    y = R;
  }
  return monic(x);
}

export function exactQuotient(a: Poly, b: Poly): Poly {
  return divisionSteps(a, b).Q;
}

/**
 * Yun's square-free factorization over Q: returns [f1, f2, ...] with P = c · f1 · f2² · f3³ …,
 * each fi square-free and pairwise coprime (fi may be the constant 1).
 */
export function squareFree(p: Poly): Poly[] {
  const f = trim(p);
  if (f.length <= 1) return [];
  const fp = derivative(f);
  const a0 = polyGcd(f, fp);
  let b = exactQuotient(f, a0);
  let c = exactQuotient(fp, a0);
  let d = sub(c, derivative(b));
  const out: Poly[] = [];
  let guard = 0;
  while (degree(b) > 0 && guard++ < 16) {
    const a = polyGcd(b, d);
    out.push(a);
    b = exactQuotient(b, a);
    c = exactQuotient(d, a);
    d = sub(c, derivative(b));
  }
  return out;
}

// ------------------------------------------------------------------ TeX

/** TeX of the monomial c·X^k with its sign: leading → "-3X^2" / "3X^2", otherwise "- 3X^2" / "+ 3X^2". */
export function termTex(c: Frac, k: number, leadingTerm: boolean, v = "X"): string {
  const sign = c.sign() < 0 ? "-" : leadingTerm ? "" : "+";
  const a = c.abs();
  const pow = k === 0 ? "" : k === 1 ? v : `${v}^{${k}}`;
  const body = k === 0 ? a.toTex() : `${coefTex(a)}${pow}`;
  return leadingTerm ? `${sign}${body}` : `${sign} ${body}`;
}

/** TeX of a polynomial, highest degree first: 2X^{4} - X^{3} + \frac{1}{2}. */
export function polyTex(p: Poly, v = "X"): string {
  const t = trim(p);
  if (!t.length) return "0";
  const parts: string[] = [];
  for (let k = t.length - 1; k >= 0; k--) {
    if (t[k].isZero()) continue;
    parts.push(termTex(t[k], k, parts.length === 0, v));
  }
  return parts.join(" ");
}

export function polyDegreeTex(p: Poly): string {
  const d = degree(p);
  return d < 0 ? "-\\infty" : String(d);
}

// ------------------------------------------------------------------ numeric

export function evalNum(coeffs: number[], x: number): number {
  let acc = 0;
  for (let i = coeffs.length - 1; i >= 0; i--) acc = acc * x + coeffs[i];
  return acc;
}

export function derivNum(coeffs: number[]): number[] {
  return coeffs.slice(1).map((c, i) => c * (i + 1));
}

export function trimNum(coeffs: number[]): number[] {
  let n = coeffs.length;
  while (n > 0 && coeffs[n - 1] === 0) n--;
  return coeffs.slice(0, n);
}
