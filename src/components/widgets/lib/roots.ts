import { Frac } from "./fraction";
import { degree, derivNum, evalFrac, evalNum, polyFromNumbers, squareFree, trimNum, type Poly } from "./polynomial";

export type RealRoot = {
  value: number;
  /** Exact value when the root is rational. */
  exact: Frac | null;
  multiplicity: number;
};

/**
 * Real roots of a numeric polynomial (ascending coefficients) inside [lo, hi].
 * Recursion on the derivative splits [lo, hi] into monotonic pieces; each piece holds
 * at most one root, found by bisection. Roots of even multiplicity are only found when
 * they coincide with a critical point, so callers should pass square-free polynomials.
 */
export function numericRootsIn(coeffs: number[], lo: number, hi: number): number[] {
  const p = trimNum(coeffs);
  const deg = p.length - 1;
  if (deg <= 0) return [];
  if (deg === 1) {
    const x = -p[0] / p[1];
    return x >= lo && x <= hi ? [x] : [];
  }
  const crit = numericRootsIn(derivNum(p), lo, hi);
  const pts = [lo, ...crit, hi];
  const scale = Math.max(...p.map(Math.abs));
  const out: number[] = [];
  const push = (x: number) => {
    if (!out.some((y) => Math.abs(y - x) < 1e-9 * Math.max(1, Math.abs(x)))) out.push(x);
  };
  for (let i = 0; i < pts.length - 1; i++) {
    let a = pts[i];
    let b = pts[i + 1];
    let fa = evalNum(p, a);
    const fb = evalNum(p, b);
    if (Math.abs(fa) <= 1e-13 * scale) {
      push(a);
      continue;
    }
    if (Math.abs(fb) <= 1e-13 * scale) {
      if (i === pts.length - 2) push(b);
      continue;
    }
    if (Math.sign(fa) === Math.sign(fb)) continue;
    for (let it = 0; it < 200 && b - a > 1e-15 * Math.max(1, Math.abs(a)); it++) {
      const m = (a + b) / 2;
      const fm = evalNum(p, m);
      if (fm === 0) {
        a = b = m;
        break;
      }
      if (Math.sign(fm) === Math.sign(fa)) {
        a = m;
        fa = fm;
      } else b = m;
    }
    push((a + b) / 2);
  }
  return out.sort((x, y) => x - y);
}

/** Cauchy bound: every complex root z satisfies |z| < 1 + max |a_i / a_n|. */
export function cauchyBound(coeffs: number[]): number {
  const p = trimNum(coeffs);
  const an = p[p.length - 1];
  return 1 + Math.max(0, ...p.slice(0, -1).map((c) => Math.abs(c / an)));
}

function polyToNumbers(p: Poly): number[] {
  return p.map((c) => c.toNumber());
}

/** Newton refinement on the exact square-free factor (evaluated in floating point). */
function refine(p: number[], x: number): number {
  const dp = derivNum(p);
  for (let i = 0; i < 8; i++) {
    const d = evalNum(dp, x);
    if (d === 0) break;
    const nx = x - evalNum(p, x) / d;
    if (!Number.isFinite(nx) || Math.abs(nx - x) > 1e-3 * Math.max(1, Math.abs(x))) break;
    x = nx;
  }
  return x;
}

/**
 * Real roots with multiplicities. Multiplicities come from an exact square-free factorization
 * over Q (coefficients converted to fractions), so a double root is reported as double even
 * though floating point would only see a tangency. Rational roots are given exactly.
 */
export function realRoots(coeffs: number[]): RealRoot[] {
  const P = polyFromNumbers(coeffs);
  if (degree(P) <= 0) return [];
  const factors = squareFree(P);
  const out: RealRoot[] = [];
  factors.forEach((f, idx) => {
    if (degree(f) <= 0) return;
    const fn = polyToNumbers(f);
    const B = cauchyBound(fn) + 1;
    for (const x0 of numericRootsIn(fn, -B, B)) {
      const x = refine(fn, x0);
      let exact: Frac | null = null;
      for (const den of [1000, 1e6]) {
        const cand = Frac.tryFromNumber(x, den);
        if (cand && evalFrac(f, cand).isZero()) {
          exact = cand;
          break;
        }
      }
      out.push({ value: exact ? exact.toNumber() : x, exact, multiplicity: idx + 1 });
    }
  });
  return out.sort((a, b) => a.value - b.value);
}

export function multiplicityName(m: number): string {
  return (
    ["", "racine simple", "racine double", "racine triple", "racine quadruple", "racine quintuple"][m] ??
    `racine de multiplicité ${m}`
  );
}
