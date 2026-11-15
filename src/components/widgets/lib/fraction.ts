/**
 * Exact rational numbers (BigInt numerator / denominator, always reduced, denominator > 0).
 * Used by every widget that shows a rational result, so that students never see 0.30000000000000004.
 */

const ZERO_N = BigInt(0);
const ONE_N = BigInt(1);

function babs(a: bigint): bigint {
  return a < ZERO_N ? -a : a;
}

function bgcd(a: bigint, b: bigint): bigint {
  a = babs(a);
  b = babs(b);
  while (b !== ZERO_N) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

export class Frac {
  readonly n: bigint;
  readonly d: bigint;

  private constructor(n: bigint, d: bigint) {
    if (d === ZERO_N) throw new RangeError("Division par zéro");
    if (d < ZERO_N) {
      n = -n;
      d = -d;
    }
    const g = bgcd(n, d);
    if (g > ONE_N) {
      n /= g;
      d /= g;
    }
    this.n = n;
    this.d = d;
  }

  static readonly ZERO = new Frac(ZERO_N, ONE_N);
  static readonly ONE = new Frac(ONE_N, ONE_N);

  /** Fraction from integers (number or bigint). */
  static of(n: number | bigint, d: number | bigint = 1): Frac {
    const toB = (v: number | bigint) => {
      if (typeof v === "bigint") return v;
      if (!Number.isInteger(v)) throw new TypeError(`Entier attendu, reçu ${v}`);
      return BigInt(v);
    };
    return new Frac(toB(n), toB(d));
  }

  /**
   * Converts a JS number to the simplest fraction that represents it (continued fractions),
   * e.g. 0.75 → 3/4, -2.25 → -9/4, 0.1 → 1/10, 1/3 (as a float) → 1/3.
   */
  static fromNumber(x: number, maxDen = 1e9): Frac {
    if (!Number.isFinite(x)) throw new RangeError(`Nombre non fini : ${x}`);
    if (Number.isInteger(x)) return new Frac(BigInt(x), ONE_N);
    let h0 = 0,
      h1 = 1,
      k0 = 1,
      k1 = 0;
    let v = x;
    for (let iter = 0; iter < 64; iter++) {
      const a = Math.floor(v);
      const h2 = a * h1 + h0;
      const k2 = a * k1 + k0;
      if (k2 > maxDen) break;
      h0 = h1;
      h1 = h2;
      k0 = k1;
      k1 = k2;
      if (Math.abs(x - h1 / k1) <= 1e-12 * Math.max(1, Math.abs(x))) break;
      const frac = v - a;
      if (frac < 1e-15) break;
      v = 1 / frac;
    }
    return new Frac(BigInt(h1), BigInt(k1));
  }

  /** Like `fromNumber` but returns null when x has no simple fraction close enough. */
  static tryFromNumber(x: number, maxDen = 10000): Frac | null {
    if (!Number.isFinite(x)) return null;
    const f = Frac.fromNumber(x, maxDen);
    return Math.abs(f.toNumber() - x) <= 1e-9 * Math.max(1, Math.abs(x)) ? f : null;
  }

  add(o: Frac): Frac {
    return new Frac(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  sub(o: Frac): Frac {
    return new Frac(this.n * o.d - o.n * this.d, this.d * o.d);
  }
  mul(o: Frac): Frac {
    return new Frac(this.n * o.n, this.d * o.d);
  }
  div(o: Frac): Frac {
    if (o.n === ZERO_N) throw new RangeError("Division par zéro");
    return new Frac(this.n * o.d, this.d * o.n);
  }
  neg(): Frac {
    return new Frac(-this.n, this.d);
  }
  inv(): Frac {
    return new Frac(this.d, this.n);
  }
  abs(): Frac {
    return this.n < ZERO_N ? this.neg() : this;
  }
  isZero(): boolean {
    return this.n === ZERO_N;
  }
  isOne(): boolean {
    return this.n === ONE_N && this.d === ONE_N;
  }
  isInteger(): boolean {
    return this.d === ONE_N;
  }
  sign(): -1 | 0 | 1 {
    return this.n === ZERO_N ? 0 : this.n < ZERO_N ? -1 : 1;
  }
  eq(o: Frac): boolean {
    return this.n === o.n && this.d === o.d;
  }
  cmp(o: Frac): number {
    const l = this.n * o.d;
    const r = o.n * this.d;
    return l === r ? 0 : l < r ? -1 : 1;
  }
  toNumber(): number {
    return Number(this.n) / Number(this.d);
  }
  /** "3", "-3/4". */
  toString(): string {
    return this.d === ONE_N ? this.n.toString() : `${this.n}/${this.d}`;
  }
  /** "3", "-\frac{3}{4}". */
  toTex(): string {
    if (this.d === ONE_N) return this.n.toString();
    const sign = this.n < ZERO_N ? "-" : "";
    return `${sign}\\frac{${babs(this.n)}}{${this.d}}`;
  }
  /** TeX wrapped in parentheses when negative (for products like 2\times(-3)). */
  toTexParen(): string {
    return this.sign() < 0 ? `\\left(${this.toTex()}\\right)` : this.toTex();
  }
}

export function frac(x: number | Frac): Frac {
  return x instanceof Frac ? x : Frac.fromNumber(x);
}

/**
 * TeX for a coefficient in front of a symbol, with its sign handled by the caller:
 * 1 → "", 2 → "2", 1/2 → "\frac{1}{2}". Expects a positive fraction.
 */
export function coefTex(c: Frac): string {
  return c.isOne() ? "" : c.toTex();
}
