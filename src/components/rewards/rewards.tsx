"use client";

import { useEffect, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import { Award, BookOpenCheck, Crown, Flame, FlameKindling, GraduationCap, Library, Star, Target, Trophy, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Small, tasteful confetti burst (skipped when the user prefers reduced motion). */
export function fireConfetti(intensity: "small" | "big" = "small") {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#3B8EEA", "#F2B705", "#2272D6", "#C40000"];
  if (intensity === "small") {
    confetti({ particleCount: 70, spread: 70, startVelocity: 38, origin: { y: 0.7 }, colors, scalar: 0.9, disableForReducedMotion: true });
    return;
  }
  const end = Date.now() + 700;
  (function frame() {
    confetti({ particleCount: 5, angle: 60, spread: 60, origin: { x: 0, y: 0.75 }, colors, disableForReducedMotion: true });
    confetti({ particleCount: 5, angle: 120, spread: 60, origin: { x: 1, y: 0.75 }, colors, disableForReducedMotion: true });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

/** A number that counts up when it appears or changes. */
export function CountUp({ value, duration = 0.9, className, suffix = "" }: { value: number; duration?: number; className?: string; suffix?: string }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : 0);
  const rounded = useTransform(mv, (v) => Math.round(v).toLocaleString("fr-FR") + suffix);
  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const c = animate(mv, value, { duration, ease: [0.16, 1, 0.3, 1] });
    return () => c.stop();
  }, [value, duration, mv, reduce]);
  return <motion.span className={cn("tabular-nums", className)}>{rounded}</motion.span>;
}

/** "+N XP" that pops and floats up. */
export function XpPop({ amount, className }: { amount: number; className?: string }) {
  if (amount <= 0) return null;
  return (
    <motion.span
      initial={{ opacity: 0, y: 8, scale: 0.6 }}
      animate={{ opacity: [0, 1, 1, 0], y: [8, 0, -6, -22], scale: [0.6, 1.15, 1, 1] }}
      transition={{ duration: 1.6, times: [0, 0.2, 0.7, 1] }}
      className={cn("pointer-events-none inline-flex items-center gap-1 rounded-[3px] bg-reward px-2 py-0.5 text-sm font-bold text-[#2b2000]", className)}
    >
      +{amount} XP
    </motion.span>
  );
}

export function StreakFlame({ streak, active, size = "md" }: { streak: number; active: boolean; size?: "sm" | "md" | "lg" }) {
  const s = size === "lg" ? "size-10" : size === "sm" ? "size-4" : "size-6";
  return (
    <span className="relative inline-flex items-center">
      <motion.span
        animate={active ? { scale: [1, 1.12, 1], rotate: [0, -4, 3, 0] } : undefined}
        transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 1.2 }}
        className="inline-flex"
      >
        <Flame className={cn(s, active ? "fill-reward text-danger" : "text-muted-foreground")} strokeWidth={1.8} />
      </motion.span>
      <span className="sr-only">{streak} jours de série</span>
    </span>
  );
}

export type EarnedAchievement = { id: string; title: string; description: string; icon: string };

const ACHIEVEMENT_ICONS: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  "book-open-check": BookOpenCheck,
  zap: Zap,
  flame: Flame,
  "flame-kindling": FlameKindling,
  trophy: Trophy,
  target: Target,
  library: Library,
  star: Star,
  crown: Crown,
  "graduation-cap": GraduationCap,
};

export function AchievementBadge({ icon, earned = true, className }: { icon: string; earned?: boolean; className?: string }) {
  const Icon = ACHIEVEMENT_ICONS[icon] ?? Award;
  return (
    <span
      className={cn(
        "grid size-12 place-items-center rounded-md border-[1.5px]",
        earned ? "border-reward bg-reward-soft text-reward-foreground" : "border-dashed border-border text-muted-foreground/60",
        className,
      )}
    >
      <Icon className="size-6" strokeWidth={1.7} />
    </span>
  );
}

/** Shows newly earned achievements one after another. */
export function AchievementQueue({ items, onDone }: { items: EarnedAchievement[]; onDone?: () => void }) {
  const [i, setI] = useState(0);
  const current = items[i];
  useEffect(() => {
    if (current) fireConfetti("small");
  }, [current]);
  if (!current) return null;
  const close = () => {
    if (i + 1 >= items.length) onDone?.();
    setI(i + 1);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-sm text-center">
        <AnimatePresence mode="wait">
          <motion.div key={current.id} initial={{ scale: 0.5, rotate: -12, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 14 }} className="mx-auto">
            <AchievementBadge icon={current.icon} className="size-24 rounded-lg [&_svg]:size-12" />
          </motion.div>
        </AnimatePresence>
        <p className="font-bold text-reward-foreground smallcaps">Succès débloqué</p>
        <DialogTitle className="text-xl">{current.title}</DialogTitle>
        <DialogDescription>{current.description}</DialogDescription>
        <Button onClick={close} className="mt-2 w-full">
          {i + 1 < items.length ? "Suivant" : "Super !"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/** Circular progress ring (level, daily goal). */
export function Ring({ value, size = 56, stroke = 6, className, children }: { value: number; size?: number; stroke?: number; className?: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <span className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-muted" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeLinecap="butt"
          className="fill-none stroke-brand"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center">{children}</span>
    </span>
  );
}

/** Animated linear progress bar. */
export function ProgressBar({ value, className, tone = "primary", label }: { value: number; className?: string; tone?: "primary" | "success" | "reward"; label?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      aria-label={label}
      className={cn("h-1.5 w-full overflow-hidden bg-muted", className)}
    >
      <motion.div
        className={cn("h-full", tone === "primary" && "bg-brand", tone === "success" && "bg-success", tone === "reward" && "bg-reward")}
        initial={{ width: 0 }}
        animate={{ width: `${v * 100}%` }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}
