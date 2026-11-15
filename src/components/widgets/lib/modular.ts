/** Arithmetic in Z/nZ. */

export function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

/** Classes \bar k (0 ≤ k < n) invertible for multiplication: gcd(k, n) = 1. */
export function invertibleClasses(n: number): number[] {
  return Array.from({ length: n }, (_, k) => k).filter((k) => gcd(k, n) === 1);
}

/** Inverse of \bar a in Z/nZ, or null. */
export function inverseMod(a: number, n: number): number | null {
  a = mod(a, n);
  for (let k = 0; k < n; k++) if (mod(a * k, n) === 1 % n) return k;
  return null;
}
