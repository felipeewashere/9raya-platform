/** Number formatting for the 2D maths scenes (French decimal comma, true minus sign). */

/** `fmt(-1.5)` → "−1,50". Rounds away negative zero. */
export function fmt(x: number, digits = 2): string {
  if (!Number.isFinite(x)) return x > 0 ? "+∞" : x < 0 ? "−∞" : "—";
  let s = x.toFixed(digits);
  if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
  return s.replace("-", "−").replace(".", ",");
}

/** Same as `fmt`, written for KaTeX (`{,}` keeps the comma tight). */
export function tnum(x: number, digits = 2): string {
  return fmt(x, digits).replace("−", "-").replace(",", "{,}");
}

/** Reads a number from scene params, falling back when missing or out of range. */
export function numParam(v: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** Reads a string choice from scene params, falling back when it is not one of `options`. */
export function choiceParam<T extends string>(v: unknown, options: readonly T[], fallback: T): T {
  return typeof v === "string" && (options as readonly string[]).includes(v) ? (v as T) : fallback;
}

export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** Like `fmt` but without trailing zeros (1,50 → 1,5 ; 2,00 → 2). */
export function fmtShort(x: number, digits = 3): string {
  return fmt(x, digits).replace(/(,\d*?)0+$/, "$1").replace(/,$/, "");
}
