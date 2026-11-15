import { compile } from "mathjs";

export type Domain = "N" | "Z" | "Q" | "R";

export type CompiledLaw = (x: number, y: number) => number;

/**
 * Compiles an author-written mathjs expression in x and y ONCE. Only {x, y} are put in the
 * evaluation scope, and nothing typed by students is ever evaluated. Non-numeric results
 * (complex, matrices, …) become NaN.
 */
export function compileLaw(expr: string): CompiledLaw {
  const code = compile(expr);
  return (x: number, y: number) => {
    try {
      const r: unknown = code.evaluate({ x, y });
      if (typeof r === "number") return r;
      if (r && typeof r === "object" && "valueOf" in r) {
        const v = (r as { valueOf(): unknown }).valueOf();
        if (typeof v === "number") return v;
      }
      return NaN;
    } catch {
      return NaN;
    }
  };
}

/** Floating-point equality tolerant to rounding noise. */
export function nearlyEqual(a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

export function inDomain(v: number, domain: Domain): boolean {
  if (!Number.isFinite(v)) return false;
  const near = Math.round(v);
  const isInt = Math.abs(v - near) <= 1e-9 * Math.max(1, Math.abs(v));
  if (domain === "N") return isInt && near >= 0;
  if (domain === "Z") return isInt;
  return true;
}

export const domainTex: Record<Domain, string> = {
  N: "\\mathbb{N}",
  Z: "\\mathbb{Z}",
  Q: "\\mathbb{Q}",
  R: "\\mathbb{R}",
};

/** Sample values used to test a candidate neutral element. */
export function sampleValues(domain: Domain): number[] {
  if (domain === "N") return [0, 1, 2, 5, 10];
  if (domain === "Z") return [-4, -1, 0, 1, 3, 7];
  return [-3, -0.5, 0, 1, 2.5, 6];
}
