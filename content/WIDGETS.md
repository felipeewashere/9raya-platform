# Interactive widgets

Lessons can embed these widgets with an `interactive` block. Props are defined and validated in `src/content/schema.ts`. Use a widget only where it genuinely helps understanding, typically 1–2 per lesson, and only when the lesson's math matches what the widget shows.

| id | What the student does | Good for |
|---|---|---|
| `law-explorer` | Picks values for x, y, z; sees x⋆y, compares (x⋆y)⋆z with x⋆(y⋆z) and x⋆y with y⋆x; searches for a neutral element. | Laws of composition on N/Z/Q/R: commutativity, associativity, neutral element. `expr` uses mathjs syntax (`x + y - x*y`, `x^2`, `abs(x)`). |
| `cayley-table` | Clicks cells of a finite operation table; the widget highlights the neutral element, each element's symmetric, and checks commutativity (table symmetry) and associativity. | Finite groups/monoids: Z/nZ, permutations, small custom laws. `table[i][j]` is an index into `elements`. |
| `modular-clock` | Turns a clock with n positions and adds or multiplies classes. | Z/nZ, ring/field examples, invertible classes. |
| `vector-combination` | Drags sliders a, b to form a·u + b·v in the plane; sees the span. | Linear combinations, generating families, linear independence (try u, v collinear). |
| `linear-map-2d` | Edits a 2×2 matrix and sees the plane's grid transform; shows det, kernel and image. | Linear maps, kernel/image, injective/surjective, rank, determinant. |
| `matrix-product` | Steps through C = AB entry by entry (row × column highlighted). | Matrix multiplication, dimensions compatibility. |
| `gauss-rank` | Steps through row reduction of a matrix to echelon form; reads off the rank. | Rank, rank theorem, free families. |
| `basis-change` | Sees a vector's coordinates in the canonical basis and in a new basis given by P. | Change of basis, passage matrix, X = PX'. |
| `polynomial-plot` | Edits coefficients; sees the curve, real roots and their multiplicity. | Roots, multiplicity, degree, factorization. |
| `poly-division` | Steps through the Euclidean division A = BQ + R. | Euclidean division, divisibility, roots (division by X − a). |

If a passage would benefit from a widget not in this list, do not invent one: write a static `example` instead and add a line to the chapter's `reviewNotes` ("widget wish: …").
