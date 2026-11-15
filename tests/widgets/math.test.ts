import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Frac } from "@/components/widgets/lib/fraction";
import { clean, fmtNum, texExact, texNum } from "@/components/widgets/lib/format";
import { eliminationTex, gaussSteps } from "@/components/widgets/lib/gauss";
import {
  add,
  divisionSteps,
  mul,
  polyEq,
  polyFromNumbers,
  polyTex,
  squareFree,
  degree,
} from "@/components/widgets/lib/polynomial";
import { realRoots } from "@/components/widgets/lib/roots";
import {
  associativityCounterexample,
  commutativityMismatches,
  findNeutral,
  symmetrics,
  validateTable,
} from "@/components/widgets/lib/cayley";
import { det2, inverse2, kerIm, mulVec2, toFMat2 } from "@/components/widgets/lib/linalg2";
import { inverseMod, invertibleClasses, mod } from "@/components/widgets/lib/modular";
import { compileLaw, inDomain, nearlyEqual } from "@/components/widgets/lib/law";

const F = (n: number, d = 1) => Frac.of(n, d);

describe("Frac", () => {
  it("reduces and normalizes signs", () => {
    expect(F(6, -8).toString()).toBe("-3/4");
    expect(F(0, -5).toString()).toBe("0");
    expect(F(-3, 4).toTex()).toBe("-\\frac{3}{4}");
  });
  it("does exact arithmetic", () => {
    expect(F(1, 10).add(F(2, 10)).eq(F(3, 10))).toBe(true);
    expect(F(2, 3).mul(F(9, 4)).toString()).toBe("3/2");
    expect(F(1, 2).div(F(-1, 4)).toString()).toBe("-2");
    expect(() => F(1).div(F(0))).toThrow();
  });
  it("converts floats to the simplest fraction", () => {
    expect(Frac.fromNumber(0.75).toString()).toBe("3/4");
    expect(Frac.fromNumber(-2.25).toString()).toBe("-9/4");
    expect(Frac.fromNumber(0.1).toString()).toBe("1/10");
    expect(Frac.fromNumber(1 / 3).toString()).toBe("1/3");
    expect(Frac.fromNumber(0.1 + 0.2).toString()).toBe("3/10");
    expect(Frac.tryFromNumber(Math.SQRT2, 1000)).toBeNull();
  });
});

describe("format", () => {
  it("prints French numbers without float noise", () => {
    expect(clean(0.1 + 0.2)).toBe(0.3);
    expect(fmtNum(1.5)).toBe("1,5");
    expect(fmtNum(-3)).toBe("−3");
    expect(texNum(2.5)).toBe("2{,}5");
    expect(texExact(0.75)).toBe("\\frac{3}{4}");
    expect(texExact(Math.SQRT2, true)).toBe("\\approx 1{,}414");
  });
});

describe("gauss", () => {
  it("finds the rank of every matrix used in the course", () => {
    expect(
      gaussSteps([
        [1, 0, 1],
        [0, 1, 1],
        [1, 1, 2],
      ]).rank,
    ).toBe(2);
    expect(
      gaussSteps([
        [1, 1, 0, 1],
        [1, -1, 1, 0],
        [2, 0, 1, 1],
        [0, 2, -1, 1],
      ]).rank,
    ).toBe(2);
    expect(
      gaussSteps([
        [0, -1, 1],
        [1, 0, -1],
        [-1, 1, 0],
      ]).rank,
    ).toBe(2);
    expect(
      gaussSteps([
        [1, 2, 3],
        [2, 4, 6],
        [1, 0, 1],
      ]).rank,
    ).toBe(2);
    expect(
      gaussSteps([
        [1, 2, 1],
        [2, 4, 0],
        [3, 6, 1],
      ]).rank,
    ).toBe(2);
    expect(
      gaussSteps([
        [2, 1],
        [1, 1],
      ]).rank,
    ).toBe(2);
    expect(
      gaussSteps([
        [0, 0],
        [0, 0],
      ]).rank,
    ).toBe(0);
  });
  it("swaps when the pivot is zero and describes operations in TeX", () => {
    const r = gaussSteps([
      [0, -1, 1],
      [1, 0, -1],
      [-1, 1, 0],
    ]);
    expect(r.steps[1].kind).toBe("swap");
    expect(r.steps[1].tex).toBe("L_{1} \\leftrightarrow L_{2}");
    expect(eliminationTex(1, 0, F(2))).toBe("L_{2} \\leftarrow L_{2} - 2L_{1}");
    expect(eliminationTex(2, 0, F(-1))).toBe("L_{3} \\leftarrow L_{3} + L_{1}");
    expect(eliminationTex(2, 1, F(1, 2))).toBe("L_{3} \\leftarrow L_{3} - \\frac{1}{2}L_{2}");
  });
  it("stays exact with fractions", () => {
    const r = gaussSteps([
      [3, 1],
      [1, 1],
    ]);
    const last = r.steps[r.steps.length - 1].matrix;
    expect(last[1][1].toString()).toBe("2/3");
    expect(r.steps.every((s) => s.matrix.every((row) => row.every((x) => x instanceof Frac)))).toBe(true);
  });
  it("rejects ragged matrices", () => {
    expect(gaussSteps([[1, 2], [3]]).error).toBeTruthy();
  });
});

describe("polynomials", () => {
  const P = polyFromNumbers;
  it("prints TeX with descending degree", () => {
    expect(polyTex(P([-1, 3, -2, -1, 2]))).toBe("2X^{4} - X^{3} - 2X^{2} + 3X - 1");
    expect(polyTex(P([-0.75, 3]))).toBe("3X - \\frac{3}{4}");
    expect(polyTex(P([0, 0]))).toBe("0");
  });

  const cases: [number[], number[], number[], number[]][] = [
    // A, B, Q, R (ascending)
    [
      [11, -8, 4, -2, 0, 1],
      [2, -3, 0, 1],
      [1, 0, 1],
      [9, -5, 2],
    ],
    [
      [-7, 9, -8, 0, 1],
      [12, -8, -1, 1],
      [1, 1],
      [-19, 5, 1],
    ],
    [[2, -1, -2, 1], [-2, 1], [-1, 0, 1], []],
    [
      [-1, 0, 0, 0, 1],
      [-1, 0, 0, 1],
      [0, 1],
      [-1, 1],
    ],
    [[1, 2], [0, 0, 1], [], [1, 2]],
  ];
  it.each(cases)("divides %j by %j", (A, B, Q, R) => {
    const r = divisionSteps(P(A), P(B));
    expect(polyEq(r.Q, P(Q))).toBe(true);
    expect(polyEq(r.R, P(R))).toBe(true);
    expect(polyEq(add(mul(P(B), r.Q), r.R), P(A))).toBe(true);
    expect(degree(r.R)).toBeLessThan(degree(P(B)));
  });

  it("divides every pair from the course with A = BQ + R and deg R < deg B", () => {
    for (const [A, B] of [
      [
        [-1, 3, -2, -1, 2],
        [1, -1, 1],
      ],
      [
        [1, 1, 0, -3, 1],
        [2, 0, 1],
      ],
      [
        [-5, -1, 2, 4],
        [0, 1, 1],
      ],
    ]) {
      const r = divisionSteps(P(A), P(B));
      expect(polyEq(add(mul(P(B), r.Q), r.R), P(A))).toBe(true);
      expect(degree(r.R)).toBeLessThan(degree(P(B)));
    }
  });

  it("refuses division by zero", () => {
    expect(divisionSteps(P([1, 1]), P([0])).error).toBeTruthy();
  });

  it("computes a square-free factorization", () => {
    // X^3 - 3X + 2 = (X - 1)^2 (X + 2)
    const sf = squareFree(P([2, -3, 0, 1]));
    expect(sf.length).toBe(2);
    expect(polyEq(sf[0], P([2, 1]))).toBe(true);
    expect(polyEq(sf[1], P([-1, 1]))).toBe(true);
  });
});

describe("real roots", () => {
  const simplify = (c: number[]) =>
    realRoots(c).map((r) => [r.exact ? r.exact.toString() : Number(r.value.toFixed(6)), r.multiplicity]);
  it("detects multiplicities exactly", () => {
    expect(simplify([2, -3, 0, 1])).toEqual([
      ["-2", 1],
      ["1", 2],
    ]);
    expect(simplify([-1, 3, -3, 1])).toEqual([["1", 3]]);
    expect(simplify([-0.75, 3, -2.25, -3, 3])).toEqual([
      ["-1", 1],
      ["1/2", 2],
      ["1", 1],
    ]);
    expect(simplify([-4, 6, -2, 3])).toEqual([["2/3", 1]]);
    expect(simplify([0, 0, 0, 1])).toEqual([["0", 3]]);
  });
  it("finds irrational roots numerically", () => {
    expect(simplify([-2, 0, 1])).toEqual([
      [-1.414214, 1],
      [1.414214, 1],
    ]);
    // (X^2 - 2)^2: double irrational roots
    expect(simplify([4, 0, -4, 0, 1])).toEqual([
      [-1.414214, 2],
      [1.414214, 2],
    ]);
    // x^4 - 4x^3 + 1
    const r = realRoots([1, 0, 0, -4, 1]);
    expect(r.length).toBe(2);
    for (const x of r) expect(Math.abs(x.value ** 4 - 4 * x.value ** 3 + 1)).toBeLessThan(1e-9);
  });
  it("handles constants and no real roots", () => {
    expect(realRoots([5])).toEqual([]);
    expect(realRoots([0])).toEqual([]);
    expect(realRoots([1, 0, 1])).toEqual([]);
  });
});

describe("cayley tables", () => {
  const S3 = [
    [0, 1, 2, 3, 4, 5],
    [1, 2, 0, 4, 5, 3],
    [2, 0, 1, 5, 3, 4],
    [3, 5, 4, 0, 2, 1],
    [4, 3, 5, 1, 0, 2],
    [5, 4, 3, 2, 1, 0],
  ];
  const inter = [
    [0, 0, 0, 0],
    [0, 1, 0, 1],
    [0, 0, 2, 2],
    [0, 1, 2, 3],
  ];
  it("checks the S3 table of the course against real compositions", () => {
    // Id, (1 2 3), (1 3 2), (1 2), (1 3), (2 3) as maps on {0,1,2}; (σ∘τ)(k) = σ(τ(k))
    const perms = [
      [0, 1, 2],
      [1, 2, 0],
      [2, 0, 1],
      [1, 0, 2],
      [2, 1, 0],
      [0, 2, 1],
    ];
    const key = (p: number[]) => p.join();
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 6; j++) {
        const comp = [0, 1, 2].map((k) => perms[i][perms[j][k]]);
        expect(perms.findIndex((p) => key(p) === key(comp))).toBe(S3[i][j]);
      }
  });
  it("finds neutral, symmetrics, commutativity, associativity", () => {
    expect(validateTable(6, S3)).toBeNull();
    expect(findNeutral(S3)).toBe(0);
    expect(symmetrics(S3, 0)).toEqual([0, 2, 1, 3, 4, 5]);
    expect(commutativityMismatches(S3).length).toBeGreaterThan(0);
    expect(associativityCounterexample(S3)).toBeNull();

    expect(findNeutral(inter)).toBe(3);
    expect(symmetrics(inter, 3)).toEqual([null, null, null, 3]);
    expect(commutativityMismatches(inter)).toEqual([]);
    expect(associativityCounterexample(inter)).toBeNull();
  });
  it("finds a counterexample for a non-associative law", () => {
    // x ⋆ y = x - y mod 3
    const t = [0, 1, 2].map((x) => [0, 1, 2].map((y) => (((x - y) % 3) + 3) % 3));
    expect(findNeutral(t)).toBeNull();
    const c = associativityCounterexample(t);
    expect(c).not.toBeNull();
    const [a, b, d] = c!;
    expect(t[t[a][b]][d]).not.toBe(t[a][t[b][d]]);
  });
  it("validates shapes", () => {
    expect(validateTable(2, [[0, 1]])).toBeTruthy();
    expect(
      validateTable(2, [
        [0, 1],
        [1, 2],
      ]),
    ).toBeTruthy();
  });
});

describe("2×2 linear algebra", () => {
  it("computes det, inverse and kernel/image with the row-major convention", () => {
    const M = toFMat2([
      [1, 2],
      [2, 4],
    ]);
    expect(det2(M).isZero()).toBe(true);
    const k = kerIm(M);
    expect(k.rank).toBe(1);
    expect(k.kerDir!.map(String)).toEqual(["-2", "1"]);
    expect(k.imDir!.map(String)).toEqual(["1", "2"]);
    // image of the kernel direction is 0
    expect(mulVec2(M, k.kerDir!).every((x) => x.isZero())).toBe(true);

    const proj = kerIm(
      toFMat2([
        [1, -1],
        [0, 0],
      ]),
    );
    expect(proj.kerDir!.map(String)).toEqual(["1", "1"]);
    expect(proj.imDir!.map(String)).toEqual(["1", "0"]);

    expect(
      kerIm(
        toFMat2([
          [2, 1],
          [1, 1],
        ]),
      ).rank,
    ).toBe(2);
    expect(
      kerIm(
        toFMat2([
          [0, 0],
          [0, 0],
        ]),
      ).rank,
    ).toBe(0);
    expect(
      kerIm(
        toFMat2([
          [0, 1],
          [0, 0],
        ]),
      ).kerDir!.map(String),
    ).toEqual(["1", "0"]);
  });
  it("changes basis: X' = P^{-1} X", () => {
    const P = toFMat2([
      [1, 1],
      [0, 1],
    ]);
    const X = mulVec2(inverse2(P)!, [F(3), F(2)]);
    expect(X.map(String)).toEqual(["1", "2"]);
    const P2 = toFMat2([
      [1, 1],
      [1, -1],
    ]);
    expect(mulVec2(inverse2(P2)!, [F(3), F(1)]).map(String)).toEqual(["2", "1"]);
    expect(
      inverse2(
        toFMat2([
          [1, 2],
          [2, 4],
        ]),
      ),
    ).toBeNull();
  });
});

describe("Z/nZ", () => {
  it("knows invertible classes", () => {
    expect(mod(-1, 5)).toBe(4);
    expect(invertibleClasses(12)).toEqual([1, 5, 7, 11]);
    expect(inverseMod(3, 7)).toBe(5);
    expect(inverseMod(2, 6)).toBeNull();
  });
});

describe("law-explorer evaluation", () => {
  it("compiles the course laws", () => {
    expect(compileLaw("x - y")(5, 3)).toBe(2);
    expect(compileLaw("(x + y) / 2")(1, 2)).toBe(1.5);
    expect(compileLaw("x + y + x*y")(2, 3)).toBe(11);
    expect(compileLaw("x + y - 3")(3, 7)).toBe(7);
    expect(Number.isNaN(compileLaw("sqrt(x)")(-1, 0))).toBe(true);
  });
  it("checks domains and float equality", () => {
    expect(inDomain(-1, "N")).toBe(false);
    expect(inDomain(1.5, "Z")).toBe(false);
    expect(inDomain(1.5, "Q")).toBe(true);
    expect(nearlyEqual(0.1 + 0.2, 0.3)).toBe(true);
  });
});

describe("content props", () => {
  it("every widget law in the content compiles and every cayley table is valid", () => {
    const dir = join(process.cwd(), "content", "algebre-1");
    const specs: { widget: string; props: Record<string, unknown> }[] = [];
    const walk = (o: unknown) => {
      if (Array.isArray(o)) o.forEach(walk);
      else if (o && typeof o === "object") {
        const r = o as Record<string, unknown>;
        if (r.type === "interactive" && r.spec) specs.push(r.spec as (typeof specs)[number]);
        Object.values(r).forEach(walk);
      }
    };
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) walk(JSON.parse(readFileSync(join(dir, f), "utf8")));
    expect(specs.length).toBeGreaterThan(0);
    for (const s of specs) {
      if (s.widget === "law-explorer") {
        const law = compileLaw(s.props.expr as string);
        expect(Number.isFinite(law(1, 2))).toBe(true);
        const e = s.props.neutral as number | null | undefined;
        if (typeof e === "number")
          for (const x of [-2, 0, 1, 5]) expect(nearlyEqual(law(e, x), x) && nearlyEqual(law(x, e), x)).toBe(true);
      }
      if (s.widget === "cayley-table") {
        const els = s.props.elements as string[];
        expect(validateTable(els.length, s.props.table as number[][])).toBeNull();
      }
      if (s.widget === "poly-division") {
        const r = divisionSteps(polyFromNumbers(s.props.A as number[]), polyFromNumbers(s.props.B as number[]));
        expect(r.error).toBeUndefined();
      }
    }
  });
});
