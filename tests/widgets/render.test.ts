import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ComponentType } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { widgetSchema, type Widget } from "@/content/schema";
import { LawExplorer } from "@/components/widgets/law-explorer";
import { CayleyTable } from "@/components/widgets/cayley-table";
import { ModularClock } from "@/components/widgets/modular-clock";
import { VectorCombination } from "@/components/widgets/vector-combination";
import { LinearMap2D } from "@/components/widgets/linear-map-2d";
import { MatrixProduct } from "@/components/widgets/matrix-product";
import { GaussRank } from "@/components/widgets/gauss-rank";
import { BasisChange } from "@/components/widgets/basis-change";
import { PolynomialPlot } from "@/components/widgets/polynomial-plot";
import { PolyDivision } from "@/components/widgets/poly-division";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const COMPONENTS: Record<Widget["widget"], ComponentType<any>> = {
  "law-explorer": LawExplorer,
  "cayley-table": CayleyTable,
  "modular-clock": ModularClock,
  "vector-combination": VectorCombination,
  "linear-map-2d": LinearMap2D,
  "matrix-product": MatrixProduct,
  "gauss-rank": GaussRank,
  "basis-change": BasisChange,
  "polynomial-plot": PolynomialPlot,
  "poly-division": PolyDivision,
};

function contentSpecs(): Widget[] {
  const dir = join(process.cwd(), "content", "algebre-1");
  const out: Widget[] = [];
  const walk = (o: unknown) => {
    if (Array.isArray(o)) o.forEach(walk);
    else if (o && typeof o === "object") {
      const r = o as Record<string, unknown>;
      if (r.type === "interactive" && r.spec) out.push(widgetSchema.parse(r.spec));
      Object.values(r).forEach(walk);
    }
  };
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) walk(JSON.parse(readFileSync(join(dir, f), "utf8")));
  return out;
}

const extra: Widget[] = [
  { widget: "modular-clock", props: { n: 5, op: "+" } },
  { widget: "modular-clock", props: { n: 12, op: "*" } },
  { widget: "modular-clock", props: { n: 2, op: "*" } },
  { widget: "matrix-product", props: { A: [[1, 2]], B: [[1, 2]] } },
  {
    widget: "basis-change",
    props: {
      P: [
        [1, 2],
        [2, 4],
      ],
      x: [1, 1],
    },
  },
  { widget: "polynomial-plot", props: { coeffs: [0], editable: true } },
  { widget: "polynomial-plot", props: { coeffs: [3], editable: false } },
  { widget: "poly-division", props: { A: [1, 2], B: [0, 0, 1] } },
  { widget: "poly-division", props: { A: [1, 2], B: [0] } },
  {
    widget: "linear-map-2d",
    props: {
      matrix: [
        [0, 0],
        [0, 0],
      ],
      editable: true,
    },
  },
  { widget: "cayley-table", props: { elements: ["a", "b"], table: [[0, 1]], opLatex: "\\star" } },
  { widget: "vector-combination", props: { u: [0, 0], v: [0, 0] } },
];

describe("widgets render", () => {
  const specs = [...contentSpecs(), ...extra];
  it.each(specs.map((s, i) => [`${i} ${s.widget}`, s] as const))("%s", (_, spec) => {
    const html = renderToString(createElement(COMPONENTS[spec.widget], spec.props));
    expect(html.length).toBeGreaterThan(100);
    expect(html).not.toMatch(/NaN/);
  });

  it("shows the key results in the initial render", () => {
    const k = renderToString(
      createElement(LinearMap2D, {
        matrix: [
          [1, 2],
          [2, 4],
        ],
        editable: true,
      }),
    );
    expect(k).toContain("Ker");
    const err = renderToString(createElement(MatrixProduct, { A: [[1, 2]], B: [[1, 2]] }));
    expect(err).toContain("Produit impossible");
    const bc = renderToString(
      createElement(BasisChange, {
        P: [
          [1, 2],
          [2, 4],
        ],
        x: [1, 1],
      }),
    );
    expect(bc).toContain("pas inversible");
  });
});
