/** Small numerical helpers for the 2D maths scenes. */

/**
 * All zeros of g on [a, b]: sign changes on an n-step grid refined by bisection.
 * A sign change across a jump is rejected (|g| must really be ~0 at the end).
 */
export function zeros(g: (x: number) => number, a: number, b: number, n = 2000, tol = 1e-6): number[] {
  const out: number[] = [];
  if (!(b - a > 1e-9)) return out;
  const push = (x: number) => {
    if (!out.some((r) => Math.abs(r - x) < (b - a) / n)) out.push(x);
  };
  let x0 = a;
  let g0 = g(a);
  if (Math.abs(g0) < 1e-12) push(a);
  for (let i = 1; i <= n; i++) {
    const x1 = a + ((b - a) * i) / n;
    const g1 = g(x1);
    if (Math.abs(g1) < 1e-12) push(x1);
    else if (Number.isFinite(g0) && Number.isFinite(g1) && g0 * g1 < 0) {
      let lo = x0;
      let hi = x1;
      let glo = g0;
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2;
        const gm = g(mid);
        if (glo * gm <= 0) hi = mid;
        else {
          lo = mid;
          glo = gm;
        }
      }
      const r = (lo + hi) / 2;
      if (Math.abs(g(r)) < tol) push(r);
    }
    x0 = x1;
    g0 = g1;
  }
  return out.sort((p, q) => p - q);
}
