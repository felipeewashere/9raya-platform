"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Check, Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Node = { slug: string; number: number; title: string; state: "completed" | "in_progress" | "available" | "locked"; completed: number; total: number };

const STATE_LABEL = { completed: "Terminé", in_progress: "En cours", available: "Disponible", locked: "Verrouillé" } as const;

/**
 * The course journey: one numbered square per chapter on a thin winding line. The line
 * is drawn in blue up to the furthest reached chapter; the current chapter is filled.
 */
export function LearningPath({ nodes }: { nodes: Node[] }) {
  const n = nodes.length;
  const width = Math.max(1, n - 1) * 150 + 80;
  const pts = nodes.map((_, i) => ({ x: 40 + i * 150, y: i % 2 === 0 ? 62 : 34 }));
  const d = pts.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `C ${pts[i - 1].x + 75} ${pts[i - 1].y}, ${p.x - 75} ${p.y}, ${p.x} ${p.y}`)).join(" ");
  const reached = nodes.reduce((last, c, i) => (c.state !== "locked" ? i : last), 0);
  const current = nodes.findIndex((c) => c.state === "in_progress" || c.state === "available");
  const fill = n > 1 ? reached / (n - 1) : 1;

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:thin]">
      <div className="relative" style={{ width, minWidth: "100%", height: 124 }}>
        <svg width={width} height={100} className="absolute left-0 top-0" aria-hidden>
          <path d={d} fill="none" className="stroke-border" strokeWidth={2} strokeDasharray="4 5" />
          <motion.path
            d={d}
            fill="none"
            className="stroke-brand"
            strokeWidth={2.5}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: fill }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          />
        </svg>
        <ol className="absolute inset-0" aria-label="Parcours du cours">
          {nodes.map((c, i) => {
            const isCurrent = i === current;
            const locked = c.state === "locked";
            return (
              <li key={c.slug} className="absolute -translate-x-1/2" style={{ left: pts[i].x, top: pts[i].y - 20 }}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }} className="flex flex-col items-center gap-1">
                      <Link
                        href={locked ? "#" : `#chapitre-${c.slug}`}
                        aria-disabled={locked}
                        aria-label={`Chapitre ${c.number} : ${c.title} — ${STATE_LABEL[c.state]}`}
                        className={cn(
                          "relative grid size-10 place-items-center rounded-[4px] border-[1.5px] text-[1.05rem] font-bold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                          c.state === "completed" && "border-success bg-success text-white dark:text-[#06180f]",
                          isCurrent && "border-primary bg-primary text-primary-foreground",
                          !isCurrent && (c.state === "in_progress" || c.state === "available") && "border-primary bg-background text-primary hover:bg-brand-soft",
                          locked && "cursor-not-allowed border-dashed border-border bg-background text-muted-foreground",
                        )}
                      >
                        {isCurrent && <span className="absolute -right-1 -top-1 size-2 bg-reward" aria-hidden />}
                        {c.state === "completed" ? <Check className="size-5" strokeWidth={2.6} /> : locked ? <Lock className="size-4" /> : c.number}
                      </Link>
                      <span className={cn("w-28 text-center text-[0.8rem] leading-tight smallcaps", locked ? "text-muted-foreground" : "text-foreground")}>ch. {c.number}</span>
                    </motion.div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-60">
                    <p className="font-bold">{c.title}</p>
                    <p className="text-xs opacity-80">
                      {STATE_LABEL[c.state]} · {c.completed}/{c.total} leçons
                      
                    </p>
                  </TooltipContent>
                </Tooltip>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
