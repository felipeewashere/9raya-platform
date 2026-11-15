"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StreakFlame } from "@/components/rewards/rewards";
import { DAYS_FR, MONTHS_FR, addDays, dateOf, eventsOn, isoOf, type TimetableEvent } from "@/lib/timetable";
import { cn } from "@/lib/utils";

const TYPE_COLOR: Record<TimetableEvent["type"], string> = {
  cours: "var(--primary)",
  td: "var(--accent-2)",
  tp: "#19b07a",
  exam: "#e5242b",
  off: "var(--muted-foreground)",
};
const TYPE_LABEL: Record<TimetableEvent["type"], string> = { cours: "Cours", td: "TD", tp: "TP", exam: "Examen", off: "Férié" };

// today's date, only known after mount (stable server render)
const subscribe = (cb: () => void) => {
  const t = window.setInterval(cb, 60_000);
  return () => window.clearInterval(t);
};
const todayIso = () => isoOf(new Date());

/**
 * The streak in the header. Hover (or tap) opens a small month calendar:
 * a fire on every day the student earned XP, coloured marks for classes / TD / TP / exams
 * of their group, and the selected day's list underneath.
 */
export function StreakCalendar({
  streak,
  activeToday,
  activeDays,
  group,
  section,
}: {
  streak: number;
  activeToday: boolean;
  longest?: number;
  activeDays: string[];
  group: string | null;
  section: number | null;
}) {
  const today = useSyncExternalStore(subscribe, todayIso, () => null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<{ y: number; m: number } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const closeTimer = useRef<number | null>(null);
  const active = useMemo(() => new Set(activeDays), [activeDays]);

  const base = today ? dateOf(today) : null;
  const ym = month ?? (base ? { y: base.getFullYear(), m: base.getMonth() } : null);
  const selected = picked ?? today;

  const hoverOpen = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hoverClose = () => {
    closeTimer.current = window.setTimeout(() => setOpen(false), 180);
  };

  const ymKey = ym ? ym.y * 12 + ym.m : null;
  const cells = useMemo(() => {
    if (ymKey === null) return [];
    const y = Math.floor(ymKey / 12);
    const m = ymKey % 12;
    const first = new Date(y, m, 1);
    const offset = (first.getDay() + 6) % 7; // Monday first
    const start = addDays(isoOf(first), -offset);
    return Array.from({ length: 42 }, (_, i) => {
      const iso = addDays(start, i);
      const d = dateOf(iso);
      return { iso, day: d.getDate(), inMonth: d.getMonth() === m, events: group ? eventsOn(iso, group, section) : [] };
    });
  }, [ymKey, group, section]);

  const dayEvents = selected && group ? eventsOn(selected, group, section) : [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        onPointerEnter={(e) => e.pointerType === "mouse" && hoverOpen()}
        onPointerLeave={(e) => e.pointerType === "mouse" && hoverClose()}
        className="flex h-full items-center gap-1.5 px-3 font-mono text-[0.8rem] tabular-nums hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 data-[state=open]:bg-foreground data-[state=open]:text-background"
        aria-label={`Série de ${streak} jour(s) — calendrier`}
      >
        <StreakFlame streak={streak} active={activeToday} size="sm" />
        <span>{streak}</span>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={0}
        onPointerEnter={hoverOpen}
        onPointerLeave={(e) => e.pointerType === "mouse" && hoverClose()}
        className="w-[320px] rounded-none border border-[var(--rule)] bg-background p-0 shadow-[6px_6px_0_0_var(--rule)]"
      >
        <div className="flex items-center justify-center border-b border-[var(--rule)] px-3 py-2">
          <div className="flex items-center">
            <button
              type="button"
              aria-label="Mois précédent"
              className="grid size-7 place-items-center hover:bg-foreground hover:text-background"
              onClick={() => ym && setMonth(ym.m === 0 ? { y: ym.y - 1, m: 11 } : { y: ym.y, m: ym.m - 1 })}
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="label w-[7.5rem] text-center">{ym ? `${MONTHS_FR[ym.m]} ${ym.y}` : "…"}</span>
            <button
              type="button"
              aria-label="Mois suivant"
              className="grid size-7 place-items-center hover:bg-foreground hover:text-background"
              onClick={() => ym && setMonth(ym.m === 11 ? { y: ym.y + 1, m: 0 } : { y: ym.y, m: ym.m + 1 })}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-[var(--rule)]">
          {DAYS_FR.slice(0, 7).map((d) => (
            <span key={d} className="label py-1 text-center !text-[0.6rem] text-muted-foreground">
              {d.slice(0, 2)}
            </span>
          ))}
          {cells.map((c) => {
            const fire = active.has(c.iso);
            const types = [...new Set(c.events.map((e) => e.type))];
            const isToday = c.iso === today;
            const isPicked = c.iso === selected;
            return (
              <button
                key={c.iso}
                type="button"
                onClick={() => setPicked(c.iso)}
                aria-label={`${c.day} ${ym ? MONTHS_FR[ym.m] : ""}${fire ? ", série" : ""}${types.length ? `, ${types.map((t) => TYPE_LABEL[t]).join(", ")}` : ""}`}
                aria-pressed={isPicked}
                className={cn(
                  "relative flex h-10 flex-col items-center justify-center gap-0.5 border-t border-[var(--rule)]/15 text-[0.8rem] tabular-nums transition-colors hover:bg-muted",
                  !c.inMonth && "text-muted-foreground/50",
                  isPicked && "bg-foreground text-background hover:bg-foreground",
                  isToday && !isPicked && "font-bold text-primary",
                )}
              >
                {fire ? <Flame className={cn("size-4 fill-[#ff5b22] text-[#e5242b]", !c.inMonth && "opacity-50")} strokeWidth={1.8} /> : <span>{c.day}</span>}
                <span className="flex h-1 gap-0.5">
                  {types.map((t) => (
                    <i key={t} className="block h-1 w-1" style={{ background: TYPE_COLOR[t] }} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        <div className="max-h-48 overflow-y-auto px-3 py-2">
          {!group ? (
            <p className="text-[0.8rem] text-muted-foreground">Choisis ton groupe.</p>
          ) : dayEvents.length === 0 ? (
            <p className="text-[0.8rem] text-muted-foreground">Rien de prévu.</p>
          ) : (
            <ul className="space-y-1.5">
              {dayEvents.map((e) => (
                <li key={e.id} className="flex gap-2 text-[0.8rem] leading-tight">
                  <i className="mt-1 block size-2 shrink-0" style={{ background: TYPE_COLOR[e.type] }} />
                  <span className="min-w-0">
                    <span className="font-mono text-[0.7rem] text-muted-foreground">{e.start ? `${e.start}–${e.end} · ` : ""}</span>
                    <b className="font-semibold">{e.type === "off" || e.type === "exam" ? e.title : `${TYPE_LABEL[e.type]} ${e.short ?? e.title}`}</b>
                    {e.room && <span className="text-muted-foreground"> · {e.room}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
