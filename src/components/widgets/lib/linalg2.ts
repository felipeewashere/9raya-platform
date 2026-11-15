import { Frac } from "./fraction";

/** 2×2 matrix, row-major: [[a, b], [c, d]] acts on column vectors: (x, y) ↦ (ax + by, cx + dy). */
export type Mat2 = [[number, number], [number, number]];
export type FMat2 = [[Frac, Frac], [Frac, Frac]];
export type FVec2 = [Frac, Frac];

export function toFMat2(m: Mat2): FMat2 {
  return [
    [Frac.fromNumber(m[0][0]), Frac.fromNumber(m[0][1])],
    [Frac.fromNumber(m[1][0]), Frac.fromNumber(m[1][1])],
  ];
}

export function det2(m: FMat2): Frac {
  return m[0][0].mul(m[1][1]).sub(m[0][1].mul(m[1][0]));
}

export function inverse2(m: FMat2): FMat2 | null {
  const d = det2(m);
  if (d.isZero()) return null;
  const k = d.inv();
  return [
    [m[1][1].mul(k), m[0][1].neg().mul(k)],
    [m[1][0].neg().mul(k), m[0][0].mul(k)],
  ];
}

export function mulVec2(m: FMat2, v: FVec2): FVec2 {
  return [m[0][0].mul(v[0]).add(m[0][1].mul(v[1])), m[1][0].mul(v[0]).add(m[1][1].mul(v[1]))];
}

/** Scales a non-zero rational vector to the primitive integer vector with the same direction. */
export function primitive(v: FVec2): FVec2 {
  const [x, y] = v;
  if (x.isZero() && y.isZero()) return v;
  // clear denominators
  const l = lcm(x.d, y.d);
  let a = (x.n * l) / x.d;
  let b = (y.n * l) / y.d;
  const g = gcdB(a, b);
  a /= g;
  b /= g;
  // avoid an all-negative direction vector
  const zero = BigInt(0);
  if (a <= zero && b <= zero) {
    a = -a;
    b = -b;
  }
  return [Frac.of(a), Frac.of(b)];
}

function gcdB(a: bigint, b: bigint): bigint {
  const zero = BigInt(0);
  a = a < zero ? -a : a;
  b = b < zero ? -b : b;
  while (b !== zero) [a, b] = [b, a % b];
  return a;
}
function lcm(a: bigint, b: bigint): bigint {
  return (a / gcdB(a, b)) * b;
}

export type KerIm = {
  rank: 0 | 1 | 2;
  /** Direction of Ker f when it is a line. */
  kerDir: FVec2 | null;
  /** Direction of Im f when it is a line. */
  imDir: FVec2 | null;
  kerTex: string;
  imTex: string;
};

const vecTex = (v: FVec2) => `(${v[0].toTex()},\\,${v[1].toTex()})`;

/** Kernel and image of the linear map with matrix m (row-major, columns = f(e1), f(e2)). */
export function kerIm(m: FMat2): KerIm {
  const [[a, b], [c, d]] = m;
  const zero = [a, b, c, d].every((x) => x.isZero());
  if (zero) {
    return {
      rank: 0,
      kerDir: null,
      imDir: null,
      kerTex: "\\operatorname{Ker} f = \\mathbb{R}^2",
      imTex: "\\operatorname{Im} f = \\{\\vec 0\\}",
    };
  }
  if (!det2(m).isZero()) {
    return {
      rank: 2,
      kerDir: null,
      imDir: null,
      kerTex: "\\operatorname{Ker} f = \\{\\vec 0\\}",
      imTex: "\\operatorname{Im} f = \\mathbb{R}^2",
    };
  }
  // rank 1: a non-zero row (p, q) gives Ker f = Vect((-q, p)); a non-zero column spans Im f
  const kerRaw: FVec2 = !a.isZero() || !b.isZero() ? [b.neg(), a] : [d.neg(), c];
  const imRaw: FVec2 = !a.isZero() || !c.isZero() ? [a, c] : [b, d];
  const kerDir = primitive(kerRaw);
  const imDir = primitive(imRaw);
  return {
    rank: 1,
    kerDir,
    imDir,
    kerTex: `\\operatorname{Ker} f = \\operatorname{Vect}\\big(${vecTex(kerDir)}\\big)`,
    imTex: `\\operatorname{Im} f = \\operatorname{Vect}\\big(${vecTex(imDir)}\\big)`,
  };
}
