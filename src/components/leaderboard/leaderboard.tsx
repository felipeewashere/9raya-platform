"use client";

import { motion } from "motion/react";
import { Crown } from "lucide-react";
import { NoteLabel, NumberSquare } from "@/components/notes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CountUp } from "@/components/rewards/rewards";
import { cn } from "@/lib/utils";

export type LeaderRow = { rank: number; user_id: string; username: string | null; avatar_url: string | null; xp: number; quizzes: number; is_me: boolean };

const name = (r: LeaderRow) => (r.username ? `@${r.username}` : "Étudiant");
const initials = (r: LeaderRow) => (r.username ?? "?").slice(0, 2).toUpperCase();

const PODIUM = [
  { place: 2, height: "h-20", tone: "border-primary/50 bg-brand-soft", order: "order-1" },
  { place: 1, height: "h-28", tone: "border-reward bg-reward-soft", order: "order-2" },
  { place: 3, height: "h-14", tone: "border-primary/30 bg-muted", order: "order-3" },
];

export function Leaderboard({ rows }: { rows: LeaderRow[] }) {
  const ranked = rows.filter((r) => r.xp > 0);
  const me = rows.find((r) => r.is_me);
  const top = ranked.slice(0, 3);
  const rest = ranked.slice(3);
  const meOutside = me && (me.xp === 0 || !ranked.slice(0, 50).some((r) => r.is_me) || me.rank > 50);

  if (!ranked.length)
    return (
      <div className="py-10 text-center">
        <NoteLabel tone="red">Remarque :</NoteLabel> personne n&apos;a encore gagné d&apos;XP sur cette période. Termine une leçon pour prendre la première place.
      </div>
    );

  return (
    <div className="space-y-6">
      {/* podium */}
      <div className="grid grid-cols-3 items-end gap-2 sm:gap-4">
        {PODIUM.map((p, i) => {
          const r = top[p.place - 1];
          return (
            <div key={p.place} className={cn("flex flex-col items-center gap-2", p.order)}>
              {r ? (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.12, type: "spring", stiffness: 260, damping: 20 }} className="flex flex-col items-center gap-1 text-center">
                  {p.place === 1 && <Crown className="size-6 text-reward-foreground" />}
                  <Avatar className={cn("border-[1.5px]", p.place === 1 ? "size-14 border-reward" : "size-11 border-primary/40", r.is_me && "ring-3 ring-primary/40")}>
                    {r.avatar_url && <AvatarImage src={r.avatar_url} alt="" />}
                    <AvatarFallback className="bg-brand-soft font-bold text-primary">{initials(r)}</AvatarFallback>
                  </Avatar>
                  <span className="max-w-full truncate text-[0.95rem] font-bold">{name(r)}</span>
                  <span className="text-[0.85rem] tabular-nums text-muted-foreground">
                    <CountUp value={r.xp} /> XP
                  </span>
                </motion.div>
              ) : (
                <div className="h-16" />
              )}
              <motion.div
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: 0.05 * i, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                style={{ originY: 1 }}
                className={cn("grid w-full place-items-center rounded-t-[3px] border-[1.5px] border-b-0 text-[1.8rem] font-bold text-primary", p.height, p.tone)}
              >
                {p.place}
              </motion.div>
            </div>
          );
        })}
      </div>

      {/* list */}
      <ol className="border-t-[1.5px] border-foreground/70">
        <li className="grid grid-cols-[3rem_1fr_5rem_4rem] items-center gap-2 border-b-[1.5px] border-foreground/70 px-2 py-1.5 font-bold text-primary smallcaps">
          <span>#</span>
          <span>Étudiant</span>
          <span className="text-right">XP</span>
          <span className="text-right">Quiz</span>
        </li>
        {[...top, ...rest].map((r, i) => (
          <motion.li
            key={r.user_id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i, 15) * 0.03 }}
            className={cn("grid grid-cols-[3rem_1fr_5rem_4rem] items-center gap-2 border-b px-2 py-2", r.is_me && "bg-brand-soft")}
          >
            <span>
              <NumberSquare tone={r.rank <= 3 ? "blue" : "muted"} className="text-[0.8rem]">{r.rank}</NumberSquare>
              <span className="sr-only">{r.rank}</span>
            </span>
            <span className="flex min-w-0 items-center gap-2">
              <Avatar className="size-7 border">
                {r.avatar_url && <AvatarImage src={r.avatar_url} alt="" />}
                <AvatarFallback className="bg-brand-soft text-[0.72rem] font-bold text-primary">{initials(r)}</AvatarFallback>
              </Avatar>
              <span className={cn("truncate", r.is_me && "font-bold text-primary")}>
                {name(r)}
                {r.is_me && " (toi)"}
              </span>
            </span>
            <span className="text-right font-bold tabular-nums">{r.xp.toLocaleString("fr-FR")}</span>
            <span className="text-right tabular-nums text-muted-foreground">{r.quizzes}</span>
          </motion.li>
        ))}
      </ol>

      {me && meOutside && (
        <div className="grid grid-cols-[3rem_1fr_5rem_4rem] items-center gap-2 rounded-md border-[1.5px] border-primary bg-brand-soft px-2 py-2.5">
          <span className="font-bold tabular-nums">{me.xp > 0 ? me.rank : "—"}</span>
          <span className="truncate font-bold text-primary">{name(me)} (toi)</span>
          <span className="text-right font-bold tabular-nums">{me.xp}</span>
          <span className="text-right tabular-nums text-muted-foreground">{me.quizzes}</span>
        </div>
      )}
      <p className="text-[0.9rem] text-muted-foreground"><NoteLabel tone="red">Remarque :</NoteLabel> Quiz = quiz de fin de leçon réussis sur la période. Les TD seront comptés quand ils seront en ligne.</p>
    </div>
  );
}
