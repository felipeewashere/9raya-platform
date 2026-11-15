"use client";

import { useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import type { Widget } from "@/content/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { CayleyTable } from "./cayley-table";
import { ModularClock } from "./modular-clock";
import { VectorCombination } from "./vector-combination";
import { LinearMap2D } from "./linear-map-2d";
import { MatrixProduct } from "./matrix-product";
import { GaussRank } from "./gauss-rank";
import { BasisChange } from "./basis-change";
import { PolynomialPlot } from "./polynomial-plot";
import { PolyDivision } from "./poly-division";

// mathjs is large: only load it when a lesson actually contains a law explorer.
const LawExplorer = dynamic(() => import("./law-explorer").then((m) => m.LawExplorer), {
  loading: () => <Skeleton className="h-96 w-full rounded-md" />,
});

const noop = () => () => {};

/**
 * Renders the interactive widget described by a validated `spec` (see src/content/schema.ts).
 * Widgets render in the browser only: their SVG geometry uses floating-point trig whose last
 * digits can differ between Node and the browser, which would break hydration. The server sends
 * a same-size placeholder instead.
 */
export function WidgetRenderer({ spec }: { spec: Widget }) {
  const isClient = useSyncExternalStore(noop, () => true, () => false);
  if (!isClient) return <Skeleton className="h-80 w-full rounded-md" aria-label="Chargement du widget" />;
  return <WidgetSwitch spec={spec} />;
}

function WidgetSwitch({ spec }: { spec: Widget }) {
  switch (spec.widget) {
    case "law-explorer":
      return <LawExplorer {...spec.props} />;
    case "cayley-table":
      return <CayleyTable {...spec.props} />;
    case "modular-clock":
      return <ModularClock {...spec.props} />;
    case "vector-combination":
      return <VectorCombination {...spec.props} />;
    case "linear-map-2d":
      return <LinearMap2D {...spec.props} />;
    case "matrix-product":
      return <MatrixProduct {...spec.props} />;
    case "gauss-rank":
      return <GaussRank {...spec.props} />;
    case "basis-change":
      return <BasisChange {...spec.props} />;
    case "polynomial-plot":
      return <PolynomialPlot {...spec.props} />;
    case "poly-division":
      return <PolyDivision {...spec.props} />;
    default: {
      const unknown = (spec as { widget?: unknown }).widget;
      return (
        <div
          role="note"
          className="rounded-md border border-dashed border-border bg-muted px-4 py-3 text-sm text-muted-foreground"
        >
          Widget inconnu : « {String(unknown)} ».
        </div>
      );
    }
  }
}

export {
  CayleyTable,
  ModularClock,
  VectorCombination,
  LinearMap2D,
  MatrixProduct,
  GaussRank,
  BasisChange,
  PolynomialPlot,
  PolyDivision,
};
