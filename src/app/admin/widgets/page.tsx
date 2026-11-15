import type { Metadata } from "next";
import type { Widget } from "@/content/schema";
import { WidgetRenderer } from "@/components/widgets";

export const metadata: Metadata = { title: "Widgets interactifs" };

type Demo = { title: string; note?: string; spec: Widget };

/** Realistic prop sets, taken from content/algebre-1/ch0*.json (modular-clock is not used there yet). */
const GROUPS: { id: Widget["widget"]; demos: Demo[] }[] = [
  {
    id: "law-explorer",
    demos: [
      {
        title: "Soustraction sur ℤ (ch. 1)",
        spec: { widget: "law-explorer", props: { expr: "x - y", latex: "x \\star y = x - y", domain: "Z", neutral: null } },
      },
      {
        title: "Moyenne sur ℚ (ch. 1)",
        spec: {
          widget: "law-explorer",
          props: { expr: "(x + y) / 2", latex: "x \\star y = \\frac{x+y}{2}", domain: "Q", neutral: null },
        },
      },
      {
        title: "x + y + xy sur ℝ (ch. 1)",
        spec: {
          widget: "law-explorer",
          props: { expr: "x + y + x*y", latex: "x \\star y = x + y + xy", domain: "R", neutral: 0 },
        },
      },
      {
        title: "Groupe décalé x + y − 3 (ch. 1)",
        spec: { widget: "law-explorer", props: { expr: "x + y - 3", latex: "x \\star y = x + y - 3", domain: "Z", neutral: 3 } },
      },
    ],
  },
  {
    id: "cayley-table",
    demos: [
      {
        title: "(P(E), ∩) avec E = {a, b} (ch. 1)",
        spec: {
          widget: "cayley-table",
          props: {
            elements: ["\\varnothing", "\\{a\\}", "\\{b\\}", "E"],
            table: [
              [0, 0, 0, 0],
              [0, 1, 0, 1],
              [0, 0, 2, 2],
              [0, 1, 2, 3],
            ],
            opLatex: "\\cap",
            caption: "Table de l'intersection sur les parties de E = {a, b}",
          },
        },
      },
      {
        title: "(𝔊₃, ∘) (ch. 1)",
        spec: {
          widget: "cayley-table",
          props: {
            elements: ["\\mathrm{Id}", "(1\\,2\\,3)", "(1\\,3\\,2)", "(1\\,2)", "(1\\,3)", "(2\\,3)"],
            table: [
              [0, 1, 2, 3, 4, 5],
              [1, 2, 0, 4, 5, 3],
              [2, 0, 1, 5, 3, 4],
              [3, 5, 4, 0, 2, 1],
              [4, 3, 5, 1, 0, 2],
              [5, 4, 3, 2, 1, 0],
            ],
            opLatex: "\\circ",
            caption: "Groupe symétrique sur {1, 2, 3}",
          },
        },
      },
      {
        title: "ℤ/8ℤ additif (test 8 × 8, défilement mobile)",
        spec: {
          widget: "cayley-table",
          props: {
            elements: Array.from({ length: 8 }, (_, k) => `\\bar{${k}}`),
            table: Array.from({ length: 8 }, (_, i) => Array.from({ length: 8 }, (_, j) => (i + j) % 8)),
            opLatex: "+",
          },
        },
      },
      {
        title: "Soustraction dans ℤ/3ℤ (test : ni neutre ni associativité)",
        spec: {
          widget: "cayley-table",
          props: {
            elements: ["\\bar 0", "\\bar 1", "\\bar 2"],
            table: [
              [0, 2, 1],
              [1, 0, 2],
              [2, 1, 0],
            ],
            opLatex: "-",
          },
        },
      },
    ],
  },
  {
    id: "modular-clock",
    demos: [
      { title: "Addition dans ℤ/5ℤ", spec: { widget: "modular-clock", props: { n: 5, op: "+" } } },
      { title: "Multiplication dans ℤ/12ℤ", spec: { widget: "modular-clock", props: { n: 12, op: "*" } } },
    ],
  },
  {
    id: "vector-combination",
    demos: [
      { title: "u = (2, 1), v = (1, 2) (ch. 2)", spec: { widget: "vector-combination", props: { u: [2, 1], v: [1, 2] } } },
      {
        title: "u = (1, 2), v = (−2, −4) : liés (ch. 3)",
        spec: { widget: "vector-combination", props: { u: [1, 2], v: [-2, -4] } },
      },
    ],
  },
  {
    id: "linear-map-2d",
    demos: [
      {
        title: "f(x, y) = (x + 2y, 2x + 4y), modifiable (ch. 2-3)",
        spec: {
          widget: "linear-map-2d",
          props: {
            matrix: [
              [1, 2],
              [2, 4],
            ],
            editable: true,
          },
        },
      },
      {
        title: "Symétrie s(a, b) = (a − 2b, −b), lecture seule (ch. 2)",
        spec: {
          widget: "linear-map-2d",
          props: {
            matrix: [
              [1, -2],
              [0, -1],
            ],
            editable: false,
          },
        },
      },
    ],
  },
  {
    id: "matrix-product",
    demos: [
      {
        title: "Produit 2×3 par 3×2 (ch. 4)",
        spec: {
          widget: "matrix-product",
          props: {
            A: [
              [1, 2, 0],
              [-1, 1, 3],
            ],
            B: [
              [2, 1],
              [0, -1],
              [1, 4],
            ],
          },
        },
      },
      {
        title: "A × A⁻¹ = I₃ (ch. 4)",
        spec: {
          widget: "matrix-product",
          props: {
            A: [
              [1, 0, 1],
              [2, -1, 1],
              [-1, 1, -1],
            ],
            B: [
              [0, 1, 1],
              [1, 0, 1],
              [1, -1, -1],
            ],
          },
        },
      },
      {
        title: "Tailles incompatibles (test)",
        spec: {
          widget: "matrix-product",
          props: {
            A: [
              [1, 2],
              [3, 4],
            ],
            B: [[1, 2, 3]],
          },
        },
      },
    ],
  },
  {
    id: "gauss-rank",
    demos: [
      {
        title: "Rang de f, échange de lignes (ch. 3)",
        spec: {
          widget: "gauss-rank",
          props: {
            matrix: [
              [0, -1, 1],
              [1, 0, -1],
              [-1, 1, 0],
            ],
          },
        },
      },
      {
        title: "Matrice 4×4 de rang 2 (ch. 3)",
        spec: {
          widget: "gauss-rank",
          props: {
            matrix: [
              [1, 1, 0, 1],
              [1, -1, 1, 0],
              [2, 0, 1, 1],
              [0, 2, -1, 1],
            ],
          },
        },
      },
    ],
  },
  {
    id: "basis-change",
    demos: [
      {
        title: "B = ((1, 0), (1, 1)), x = (3, 2) (ch. 3)",
        spec: {
          widget: "basis-change",
          props: {
            P: [
              [1, 1],
              [0, 1],
            ],
            x: [3, 2],
          },
        },
      },
      {
        title: "B′ = ((1, 1), (1, −1)), x = (3, 1) (ch. 4)",
        spec: {
          widget: "basis-change",
          props: {
            P: [
              [1, 1],
              [1, -1],
            ],
            x: [3, 1],
          },
        },
      },
      {
        title: "P non inversible (test)",
        spec: {
          widget: "basis-change",
          props: {
            P: [
              [1, 2],
              [2, 4],
            ],
            x: [1, 1],
          },
        },
      },
    ],
  },
  {
    id: "polynomial-plot",
    demos: [
      {
        title: "X³ − 3X + 2 : racine double (ch. 5)",
        spec: { widget: "polynomial-plot", props: { coeffs: [2, -3, 0, 1], editable: true } },
      },
      {
        title: "Q = 3X⁴ − 3X³ − 9/4 X² + 3X − 3/4 (ch. 5)",
        spec: { widget: "polynomial-plot", props: { coeffs: [-0.75, 3, -2.25, -3, 3], editable: true } },
      },
      {
        title: "X⁴ − 4X³ + 1 (ch. 5)",
        spec: { widget: "polynomial-plot", props: { coeffs: [1, 0, 0, -4, 1], editable: false } },
      },
    ],
  },
  {
    id: "poly-division",
    demos: [
      { title: "Exemple 1 (ch. 5)", spec: { widget: "poly-division", props: { A: [-1, 3, -2, -1, 2], B: [1, -1, 1] } } },
      {
        title: "X⁵ − 2X³ + 4X² − 8X + 11 par X³ − 3X + 2 (ch. 5)",
        spec: { widget: "poly-division", props: { A: [11, -8, 4, -2, 0, 1], B: [2, -3, 0, 1] } },
      },
      {
        title: "Racine : division par X − 2, reste nul (ch. 5)",
        spec: { widget: "poly-division", props: { A: [2, -1, -2, 1], B: [-2, 1] } },
      },
    ],
  },
];

export default function WidgetsPreviewPage() {
  return (
    <main className="mx-auto w-full max-w-4xl min-w-0 space-y-10 px-4 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Widgets interactifs</h1>
        <p className="text-sm text-muted-foreground">
          Aperçu de chaque widget avec des propriétés tirées des chapitres. Vérifiez l&apos;affichage en mode clair et sombre, et
          à 360 px de large.
        </p>
        <nav aria-label="Widgets" className="flex flex-wrap gap-1.5 pt-1">
          {GROUPS.map((g) => (
            <a
              key={g.id}
              href={`#${g.id}`}
              className="rounded-md border border-border px-2 py-0.5 font-mono text-xs hover:bg-muted"
            >
              {g.id}
            </a>
          ))}
        </nav>
      </header>
      {GROUPS.map((g) => (
        <section key={g.id} id={g.id} className="min-w-0 scroll-mt-20 space-y-6">
          <h2 className="border-b border-border pb-1 font-mono text-lg font-semibold">{g.id}</h2>
          {g.demos.map((d) => (
            <div key={d.title} className="min-w-0 space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">{d.title}</h3>
              <WidgetRenderer spec={d.spec} />
            </div>
          ))}
        </section>
      ))}
    </main>
  );
}
