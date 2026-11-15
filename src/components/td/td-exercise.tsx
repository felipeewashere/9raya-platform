"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Md } from "@/components/math/md";
import { Simulation } from "@/components/sim/simulation";
import type { PublicTdExercise } from "@/lib/data/td";

/** One TD exercise: "Exercice 3" with "Voir la correction" on the right, the statement, the correction on demand. */
export function TdExercise({ ex }: { ex: PublicTdExercise }) {
  const [open, setOpen] = useState(false);

  return (
    <article id={`exercice-${ex.number}`} className="scroll-mt-20 overflow-hidden border-2 border-[var(--rule)] bg-card">
      <header className="flex items-center justify-between gap-3 bg-foreground py-2 pl-5 pr-2 text-background">
        <h3 className="font-display text-[1.9rem] leading-none">Exercice {ex.number}</h3>
        {ex.solution_md && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="label flex items-center gap-2 bg-background px-4 py-2.5 text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            {open ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            {open ? "Cacher" : "Voir la correction"}
          </button>
        )}
      </header>

      <div className="prose-lesson bg-primary/[0.06] px-5 py-5">
        <Md>{ex.statement_md}</Md>
        {ex.simulations?.map((sim, i) => (
          <Simulation key={i} scene={sim.scene} params={sim.params} caption={sim.caption} />
        ))}
      </div>

      {open && ex.solution_md && (
        <div className="border-t-2 border-[var(--rule)] bg-success/[0.08] px-5 py-5">
          {ex.solution_source === "ia" && <p className="label mb-3 text-muted-foreground">Correction proposée (IA)</p>}
          <div className="prose-lesson">
            <Md>{ex.solution_md}</Md>
          </div>
        </div>
      )}
    </article>
  );
}
