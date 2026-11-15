"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/** Seven bars of XP per day (blue), with the daily goal as a golden dashed rule. */
export function WeeklyChart({ week, goal }: { week: { day: string; label: string; xp: number; isToday: boolean }[]; goal: number }) {
  const max = Math.max(goal, ...week.map((d) => d.xp), 1);
  const total = week.reduce((n, d) => n + d.xp, 0);
  return (
    <figure>
      <div
        className="relative flex h-36 items-end gap-2 border-b-[1.5px] border-foreground/70 sm:gap-3"
        role="img"
        aria-label={`XP gagnés cette semaine : ${total}. ${week.map((d) => `${d.label} ${d.xp}`).join(", ")}`}
      >
        <div className="pointer-events-none absolute inset-x-0 border-t-[1.5px] border-dashed border-reward" style={{ bottom: `${(goal / max) * 100}%` }}>
          <span className="absolute -top-5 right-0 text-[0.75rem] italic text-reward-foreground">objectif {goal}</span>
        </div>
        {week.map((d, i) => (
          <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className={cn("text-[0.72rem] tabular-nums text-muted-foreground", d.xp === 0 && "opacity-0")}>{d.xp}</span>
            <motion.div
              className={cn("w-full max-w-9", d.xp >= goal ? "bg-brand" : d.xp > 0 ? "bg-brand/45" : "bg-muted")}
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(d.xp > 0 ? 6 : 2, (d.xp / max) * 100)}%` }}
              transition={{ duration: 0.7, delay: 0.05 * i, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2 sm:gap-3">
        {week.map((d) => (
          <span key={d.day} className={cn("flex-1 text-center text-[0.8rem] capitalize", d.isToday ? "font-bold text-primary" : "text-muted-foreground")}>
            {d.label}
          </span>
        ))}
      </div>
    </figure>
  );
}
