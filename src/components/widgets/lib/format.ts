import { Frac } from "./fraction";

/** Rounds away floating noise: 0.30000000000000004 → 0.3. */
export function clean(x: number, digits = 10): number {
  if (!Number.isFinite(x)) return x;
  const r = Number(x.toPrecision(digits));
  return Object.is(r, -0) ? 0 : r;
}

/** French plain-text number: 1,5 ; −3 ; 0,333 (at most `decimals` decimals). */
export function fmtNum(x: number, decimals = 3): string {
  if (Number.isNaN(x)) return "indéfini";
  if (!Number.isFinite(x)) return x > 0 ? "+∞" : "−∞";
  const r = clean(Number(x.toFixed(decimals)));
  return r.toString().replace(".", ",").replace("-", "−");
}

/** TeX number with a French decimal comma: 1{,}5. */
export function texNum(x: number, decimals = 3): string {
  if (Number.isNaN(x)) return "\\text{indéfini}";
  if (!Number.isFinite(x)) return x > 0 ? "+\\infty" : "-\\infty";
  const r = clean(Number(x.toFixed(decimals)));
  return r.toString().replace(".", "{,}");
}

/**
 * TeX for a number given as a float: exact fraction when it is a simple rational
 * (0.75 → \frac{3}{4}), otherwise a rounded decimal with "\approx" when `approx` is set.
 */
export function texExact(x: number, approx = false): string {
  const f = Frac.tryFromNumber(x, 1000);
  if (f) return f.toTex();
  return (approx ? "\\approx " : "") + texNum(x);
}
