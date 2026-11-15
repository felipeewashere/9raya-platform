export type V3 = [number, number, number];

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const unit = (a: V3): V3 => {
  const n = norm(a);
  return n < 1e-12 ? [0, 0, 0] : mul(a, 1 / n);
};
export const deg = (rad: number) => (rad * 180) / Math.PI;
export const rad = (d: number) => (d * Math.PI) / 180;

/** Points of an arc: center + r (cos t · u + sin t · v), t from a0 to a1. */
export function arc(center: V3, u: V3, v: V3, r: number, a0: number, a1: number, n = 48): V3[] {
  const pts: V3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = a0 + ((a1 - a0) * i) / n;
    pts.push(add(center, add(mul(u, r * Math.cos(t)), mul(v, r * Math.sin(t)))));
  }
  return pts;
}

/** French number formatting: 1,25 (for plain text). */
export function fmt(x: number, digits = 2) {
  const s = (Math.abs(x) < 0.5 * 10 ** -digits ? 0 : x).toFixed(digits);
  return s.replace(".", ",").replace("-", "−");
}

/** French number formatting for KaTeX: 1{,}25. */
export function tex(x: number, digits = 2) {
  return (Math.abs(x) < 0.5 * 10 ** -digits ? 0 : x).toFixed(digits).replace(".", "{,}");
}

/** Read a numeric param with a fallback (content may pass initial values). */
export function numParam(params: Record<string, unknown> | undefined, key: string, fallback: number) {
  const v = params?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function strParam<T extends string>(params: Record<string, unknown> | undefined, key: string, allowed: readonly T[], fallback: T): T {
  const v = params?.[key];
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/** Electric field value for KaTeX, in V/m or kV/m: 2{,}4\ \text{kV/m}. */
export function texField(e: number) {
  const a = Math.abs(e);
  return a >= 1000 ? `${tex(e / 1000, 1)}\\ \\text{kV/m}` : `${tex(e, 0)}\\ \\text{V/m}`;
}
