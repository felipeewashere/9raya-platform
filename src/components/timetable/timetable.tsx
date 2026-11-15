"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Rows3 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DAYS_FR,
  MONTHS_FR,
  TYPE_LABEL,
  addDays,
  dateOf,
  dayIndex,
  daysBetween,
  eventsOn,
  formatDay,
  formatDuration,
  fromMinutes,
  hasWeek,
  isTimed,
  isoOf,
  minutesOfDay,
  nowInfo,
  toMinutes,
  weekDays,
  weekOf,
  type EventType,
  type TimetableEvent,
} from "@/lib/timetable";

// ───────── colors (CSS custom property --c per event type) ─────────

const TYPE_COLOR: Record<EventType, string> = {
  cours: "var(--primary)",
  td: "var(--accent-2, #2b5fd9)",
  tp: "#e8912d",
  exam: "#e5484d",
  off: "var(--muted-foreground, #8a8a8a)",
};

const cvar = (type: EventType) => ({ "--c": TYPE_COLOR[type] }) as CSSProperties;
const tint = (pct: number, base = "transparent") => `color-mix(in srgb, var(--c) ${pct}%, ${base})`;

// ───────── live clock: null on the server and during hydration, then ticks every 30s ─────────

const TICK = 30_000;
function subscribeClock(cb: () => void) {
  const id = window.setInterval(cb, TICK);
  const onVisible = () => {
    if (!document.hidden) cb();
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    window.clearInterval(id);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
const clockSnapshot = () => Math.floor(Date.now() / TICK) * TICK;
const serverClockSnapshot = () => null;

/** Current time (ms, rounded to 30s), or null before mount — keeps SSR and hydration identical. */
function useNow(): number | null {
  return useSyncExternalStore<number | null>(subscribeClock, clockSnapshot, serverClockSnapshot);
}

// ───────── shared bits ─────────

type Tab = "semaine" | "mois";

/** Visible range of the week timeline. */
const T0 = 8 * 60;
const T1 = 18 * 60;
const pos = (min: number) => ((min - T0) / (T1 - T0)) * 100;
const HOURS = Array.from({ length: (T1 - T0) / 60 + 1 }, (_, i) => T0 / 60 + i);

const DAY_SHORT = DAYS_FR.map((d) => d.slice(0, 3));
const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
/** Week shown by default: the current one, or the coming one on Sundays. */
const homeMonday = (today: string) => (dayIndex(today) === 6 ? addDays(weekOf(today), 7) : weekOf(today));
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function relativeDay(iso: string, today: string): string {
  const n = daysBetween(today, iso);
  if (n === 0) return "aujourd'hui";
  if (n === 1) return "demain";
  return formatDay(iso);
}

function eventMeta(e: TimetableEvent, withProf = true): string {
  const parts: string[] = [];
  if (e.type === "cours" || e.type === "td" || e.type === "tp") parts.push(TYPE_LABEL[e.type]);
  if (e.room) parts.push(e.room);
  if (withProf && e.prof) parts.push(e.prof);
  return parts.join(" · ");
}

function NavButton({ dir, label, onClick }: { dir: -1 | 1; label: string; onClick: () => void }) {
  const Icon = dir < 0 ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <Icon className="size-5" aria-hidden />
    </button>
  );
}

function ResetButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {label}
    </button>
  );
}

function Skeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div aria-hidden className="space-y-3">
      <div className="h-28 animate-pulse rounded-xl bg-muted" />
      {!compact && (
        <div className="space-y-1.5">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/60" />
          ))}
        </div>
      )}
      {compact && <div className="h-12 animate-pulse rounded-lg bg-muted/60" />}
    </div>
  );
}

// ───────── now / next card ─────────

function NowCard({ group, now }: { group: string; now: number }) {
  const d = new Date(now);
  const today = isoOf(d);
  const t = minutesOfDay(d);
  const info = nowInfo(today, t, group);
  const holiday = info.allDay.find((e) => e.type === "off");
  const exam = info.allDay.find((e) => e.type === "exam");

  const main = info.current ?? (info.next?.iso === today ? info.next.event : null);
  const colorType: EventType = info.current?.type ?? holiday?.type ?? exam?.type ?? info.next?.event.type ?? "off";

  let label: string;
  let title: string;
  let detail = "";
  let left = "";
  if (info.current) {
    label = "En ce moment";
    title = info.current.title;
    detail = eventMeta(info.current);
    left = `encore ${formatDuration(info.minutesLeft ?? 0)}`;
  } else if (main && isTimed(main)) {
    label = info.progress != null ? "Pause" : "Avant les cours";
    title = `Prochain : ${main.short}`;
    detail = [main.start, eventMeta(main)].filter(Boolean).join(" · ");
    left = `dans ${formatDuration(info.minutesLeft ?? 0)}`;
  } else if (holiday) {
    label = "Jour férié";
    title = holiday.title;
  } else {
    label = "Aujourd'hui";
    title = "Plus de cours aujourd'hui";
  }

  // what comes after: for the current event → next one; when idle → the next school day
  const after = info.current ? info.next : main ? null : info.next;

  return (
    <div
      style={{ ...cvar(colorType), background: tint(10), borderColor: tint(38) }}
      className="flex flex-col gap-1 rounded-xl border px-4 py-3 sm:px-5 sm:py-4"
      aria-live="polite"
    >
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        <Clock3 className="size-3.5" aria-hidden />
        {label} · <span className="tabular-nums">{fromMinutes(t)}</span>
      </p>
      <p className="font-display text-lg leading-tight font-semibold sm:text-xl">{title}</p>
      {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
      {left && <p className="text-sm">{left}</p>}
      {info.progress != null && (
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" role="presentation">
          <div
            className="h-full rounded-full transition-[width] duration-1000 ease-linear"
            style={{ width: `${Math.round(Math.min(Math.max(info.progress, 0), 1) * 100)}%`, background: "var(--c)" }}
          />
        </div>
      )}
      {exam && (
        <p className="text-xs font-medium" style={{ color: TYPE_COLOR.exam }}>
          {exam.title}
          {exam.approx ? " · dates estimées, à confirmer" : ""}
        </p>
      )}
      {after && (
        <p className="text-xs text-muted-foreground">
          {info.current ? "Ensuite" : "Prochain cours"} : {after.event.short}
          {after.iso !== today ? `, ${relativeDay(after.iso, today)}` : ""}
          {after.event.start ? ` à ${after.event.start}` : ""}
        </p>
      )}
      {!info.current && !main && !after && (
        <p className="text-xs text-muted-foreground">Aucun cours connu pour les prochains jours (emploi du temps pas encore publié).</p>
      )}
    </div>
  );
}

function EventChip({ e, compact = false }: { e: TimetableEvent; compact?: boolean }) {
  return (
    <li
      style={{ ...cvar(e.type), background: tint(9), borderColor: tint(24) }}
      className="relative flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg border py-2 pr-3 pl-4 text-sm"
    >
      <span aria-hidden className="absolute inset-y-2 left-1.5 w-[3px] rounded-full" style={{ background: "var(--c)" }} />
      {e.start && (
        <time className="text-xs tabular-nums text-muted-foreground">
          {e.start}–{e.end}
        </time>
      )}
      <b className="font-semibold">{e.type === "off" ? `Jour férié · ${e.title}` : compact ? e.short : e.title}</b>
      {eventMeta(e, !compact) && <span className="text-xs text-muted-foreground">{eventMeta(e, !compact)}</span>}
      {e.type === "exam" && e.approx && (
        <span className="text-xs text-muted-foreground">Dates estimées, à confirmer</span>
      )}
    </li>
  );
}

// ───────── week view ─────────

interface Laid {
  e: TimetableEvent & { start: string; end: string };
  lane: number;
}

/** Put overlapping events on separate lanes. */
function layout(events: TimetableEvent[]): { items: Laid[]; lanes: number } {
  const ends: number[] = [];
  const items: Laid[] = [];
  for (const e of events.filter(isTimed)) {
    const s = toMinutes(e.start);
    let lane = ends.findIndex((end) => end <= s);
    if (lane === -1) lane = ends.length;
    ends[lane] = toMinutes(e.end);
    items.push({ e, lane });
  }
  return { items, lanes: Math.max(ends.length, 1) };
}

function weekTitle(monday: string): string {
  const a = dateOf(monday);
  const b = dateOf(addDays(monday, 5));
  const sameMonth = a.getMonth() === b.getMonth();
  return `${a.getDate()}${sameMonth ? "" : ` ${MONTHS_FR[a.getMonth()]}`} – ${b.getDate()} ${MONTHS_FR[b.getMonth()]} ${b.getFullYear()}`;
}

function WeekView({
  group,
  now,
  monday,
  onShift,
  onReset,
  reduce,
}: {
  group: string;
  now: number;
  monday: string;
  onShift: (n: -1 | 1) => void;
  onReset: (() => void) | null;
  reduce: boolean;
}) {
  const d = new Date(now);
  const today = isoOf(d);
  const t = minutesOfDay(d);
  const days = weekDays(monday).slice(0, 6); // Lundi → Samedi
  const showNow = days.includes(today) && t >= T0 && t <= T1;
  const scroller = useRef<HTMLDivElement>(null);

  // on phones, bring the "now" line (or the morning) into view when the week changes
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const line = el.querySelector<HTMLElement>("[data-nowline]");
    if (!line) {
      el.scrollTo({ left: 0 });
      return;
    }
    const x = line.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft;
    el.scrollTo({ left: Math.max(0, x - el.clientWidth * 0.35), behavior: reduce ? "auto" : "smooth" });
  }, [monday, reduce]);

  return (
    <div className="space-y-4">
      <NowCard group={group} now={now} />

      <div className="flex items-center justify-center gap-2">
        <NavButton dir={-1} label="Semaine précédente" onClick={() => onShift(-1)} />
        <h3 className="min-w-0 text-center font-display text-base font-semibold sm:min-w-[16ch] sm:text-lg">{weekTitle(monday)}</h3>
        <NavButton dir={1} label="Semaine suivante" onClick={() => onShift(1)} />
        {onReset && <ResetButton label="Cette semaine" onClick={onReset} />}
      </div>

      {!hasWeek(monday) && (
        <p className="text-center text-sm text-muted-foreground">Pas encore d&apos;emploi du temps pour cette semaine.</p>
      )}

      <div
        ref={scroller}
        role="region"
        aria-label={`Emploi du temps, semaine du ${weekTitle(monday)}`}
        tabIndex={0}
        className="overflow-x-auto overscroll-x-contain pb-2 [scrollbar-width:thin] focus-visible:outline-2"
      >
        <div className="relative min-w-[680px] [--lw:3.5rem] sm:[--lw:5.5rem]">
          {/* hours axis */}
          <div className="flex">
            <div className="sticky left-0 z-20 w-(--lw) shrink-0" />
            <div className="relative h-5 flex-1">
              {HOURS.map((h, i) => (
                <span
                  key={h}
                  style={{ left: `${pos(h * 60)}%` }}
                  className={cn(
                    "absolute top-0 text-[10px] tabular-nums text-muted-foreground",
                    i === 0 ? "" : i === HOURS.length - 1 ? "-translate-x-full" : "-translate-x-1/2",
                  )}
                >
                  {h}h
                </span>
              ))}
            </div>
          </div>

          {days.map((iso, i) => {
            const events = eventsOn(iso, group);
            const { items, lanes } = layout(events);
            const allDay = events.filter((e) => !isTimed(e));
            const isToday = iso === today;
            const date = dateOf(iso);
            return (
              <motion.div
                key={iso}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: reduce ? 0 : i * 0.045, ease: [0.2, 0.8, 0.2, 1] }}
                className="mb-1.5 flex items-stretch"
              >
                <div
                  className={cn(
                    "sticky left-0 z-20 flex w-(--lw) shrink-0 flex-col justify-center bg-background/90 pr-2 backdrop-blur-sm",
                    isToday && "pl-2 shadow-[inset_3px_0_0_var(--primary)]",
                  )}
                >
                  <span className={cn("text-sm leading-tight font-semibold", isToday && "text-primary")}>
                    <span className="sm:hidden">{DAY_SHORT[i]}</span>
                    <span className="hidden sm:inline">{DAYS_FR[i]}</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {date.getDate()}
                    <span className="hidden sm:inline"> {MONTHS_SHORT[date.getMonth()]}</span>
                  </span>
                </div>

                <div
                  className={cn("relative h-16 flex-1 overflow-hidden rounded-lg bg-muted/50 sm:h-[4.5rem]", isToday && "ring-1 ring-primary/30")}
                  style={{
                    backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent calc(${100 / ((T1 - T0) / 60)}% - 1px), color-mix(in srgb, var(--muted-foreground) 14%, transparent) calc(${100 / ((T1 - T0) / 60)}% - 1px), color-mix(in srgb, var(--muted-foreground) 14%, transparent) ${100 / ((T1 - T0) / 60)}%)`,
                  }}
                >
                  {allDay.map((e) => (
                    <div
                      key={e.id}
                      style={{
                        ...cvar(e.type),
                        backgroundImage: `repeating-linear-gradient(135deg, ${tint(14)} 0 8px, ${tint(5)} 8px 16px)`,
                      }}
                      className="absolute inset-0 flex items-center justify-center px-3 text-center text-xs font-medium"
                    >
                      <span className="truncate">
                        {e.type === "off" ? `Jour férié · ${e.title}` : e.title}
                        {e.approx ? " · dates estimées" : ""}
                      </span>
                    </div>
                  ))}

                  {items.map(({ e, lane }) => {
                    const s = toMinutes(e.start);
                    const en = toMinutes(e.end);
                    const past = iso < today || (isToday && en <= t);
                    const live = isToday && s <= t && t < en;
                    return (
                      <div
                        key={e.id}
                        className="absolute p-[3px]"
                        style={{
                          left: `${pos(s)}%`,
                          width: `${pos(en) - pos(s)}%`,
                          top: `${(lane / lanes) * 100}%`,
                          height: `${100 / lanes}%`,
                        }}
                        title={[`${e.start}–${e.end}`, e.title, eventMeta(e)].filter(Boolean).join(" · ")}
                      >
                        <div
                          style={{
                            ...cvar(e.type),
                            background: tint(18, "var(--background)"),
                            borderColor: tint(45),
                            borderLeftColor: "var(--c)",
                            boxShadow: live ? "0 0 0 2px var(--c)" : undefined,
                          }}
                          className={cn(
                            "@container flex h-full flex-col justify-center overflow-hidden rounded-md border border-l-[3px] px-1.5 leading-tight transition-opacity",
                            past && "opacity-45 saturate-50",
                          )}
                        >
                          <span className="truncate text-[11px] font-semibold sm:text-xs">{e.short}</span>
                          <span className="truncate text-[10px] text-muted-foreground">
                            <span className="font-bold tracking-wide uppercase" style={{ color: "var(--c)" }}>
                              {TYPE_LABEL[e.type]}
                            </span>
                            {e.room ? ` · ${e.room}` : ""}
                          </span>
                          {lanes === 1 && (
                            <span className="hidden truncate text-[10px] text-muted-foreground @[7.5rem]:block">{e.prof}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}

          {showNow && (
            <div aria-hidden className="pointer-events-none absolute top-5 right-0 bottom-1.5 left-(--lw) z-10">
              <div
                data-nowline
                className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-[#e5484d] shadow-[0_0_6px_#e5484d] transition-[left] duration-1000 ease-linear"
                style={{ left: `${pos(t)}%` }}
              >
                <span className="absolute -top-1 -left-[3px] size-2 rounded-full bg-[#e5484d]" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ───────── month view ─────────

const LEGEND: EventType[] = ["cours", "td", "tp", "exam", "off"];

function MonthView({
  group,
  now,
  monthShift,
  onShift,
  onReset,
  selected,
  onSelect,
  onSeeWeek,
  reduce,
}: {
  group: string;
  now: number;
  monthShift: number;
  onShift: (n: -1 | 1) => void;
  onReset: (() => void) | null;
  selected: string | null;
  onSelect: (iso: string) => void;
  onSeeWeek: (iso: string) => void;
  reduce: boolean;
}) {
  const today = isoOf(new Date(now));
  const base = dateOf(today);
  const first = new Date(base.getFullYear(), base.getMonth() + monthShift, 1);
  const y = first.getFullYear();
  const m = first.getMonth();
  const lead = (first.getDay() + 6) % 7;
  const count = new Date(y, m + 1, 0).getDate();
  const sel = selected ?? today;
  const selEvents = eventsOn(sel, group);
  const selIdx = dayIndex(sel);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-center gap-2">
        <NavButton dir={-1} label="Mois précédent" onClick={() => onShift(-1)} />
        <h3 className="min-w-[11ch] text-center font-display text-base font-semibold sm:text-lg">
          {capitalize(MONTHS_FR[m])} {y}
        </h3>
        <NavButton dir={1} label="Mois suivant" onClick={() => onShift(1)} />
        {onReset && <ResetButton label="Ce mois" onClick={onReset} />}
      </div>

      <motion.div
        key={`${y}-${m}`}
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="grid grid-cols-7 gap-1"
      >
        {DAY_SHORT.map((n) => (
          <span key={n} className="pb-1 text-center text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
            {n}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`lead-${i}`} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const day = i + 1;
          const iso = isoOf(new Date(y, m, day));
          const types = [...new Set(eventsOn(iso, group).map((e) => e.type))];
          const isSel = iso === sel;
          const isToday = iso === today;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelect(iso)}
              aria-pressed={isSel}
              aria-label={`${formatDay(iso)}${types.length ? `, ${types.map((x) => TYPE_LABEL[x]).join(", ")}` : ""}`}
              style={types.includes("exam") ? { ...cvar("exam"), background: tint(14) } : undefined}
              className={cn(
                "flex aspect-[1/0.9] flex-col items-center justify-center gap-1 rounded-lg border border-transparent text-sm tabular-nums transition-colors hover:bg-muted",
                isToday && "border-primary font-semibold text-primary",
                isSel && "bg-muted ring-1 ring-foreground/20",
              )}
            >
              <span>{day}</span>
              <span className="flex min-h-1.5 gap-[3px]">
                {types.map((tp) => (
                  <i key={tp} className="size-1.5 rounded-full" style={{ background: TYPE_COLOR[tp] }} />
                ))}
              </span>
            </button>
          );
        })}
      </motion.div>

      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {LEGEND.map((tp) => (
          <span key={tp} className="flex items-center gap-1.5">
            <i className="size-2 rounded-full" style={{ background: TYPE_COLOR[tp] }} />
            {TYPE_LABEL[tp]}
          </span>
        ))}
      </div>

      <section aria-live="polite" className="space-y-2">
        <h4 className="font-display text-base font-semibold">{capitalize(formatDay(sel))}</h4>
        {selEvents.length ? (
          <ul className="space-y-1.5">
            {selEvents.map((e) => (
              <EventChip key={e.id} e={e} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {selIdx < 6 && !hasWeek(weekOf(sel)) ? "Pas encore d'emploi du temps pour ce jour." : "Rien de prévu ce jour-là."}
          </p>
        )}
        <button
          type="button"
          onClick={() => onSeeWeek(sel)}
          className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          Voir la semaine →
        </button>
      </section>
    </div>
  );
}

// ───────── public components ─────────

export interface TimetableProps {
  /** Student group, "G1" … "G6". */
  group: string;
  defaultTab?: Tab;
  className?: string;
}

/** Full timetable: "Semaine" (horizontal week grid with live now line) and "Mois" (month calendar). */
export function Timetable({ group, defaultTab = "semaine", className }: TimetableProps) {
  const now = useNow();
  const reduce = useReducedMotion() ?? false;
  const tabsId = useId();
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [weekShift, setWeekShift] = useState(0);
  const [monthShift, setMonthShift] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const tabs: { key: Tab; label: string; Icon: typeof Rows3 }[] = [
    { key: "semaine", label: "Semaine", Icon: Rows3 },
    { key: "mois", label: "Mois", Icon: CalendarDays },
  ];

  let body: ReactNode = <Skeleton />;
  if (now != null) {
    const today = isoOf(new Date(now));
    const monday = addDays(homeMonday(today), 7 * weekShift);
    body =
      tab === "semaine" ? (
        <WeekView
          group={group}
          now={now}
          monday={monday}
          onShift={(n) => setWeekShift((w) => w + n)}
          onReset={weekShift !== 0 ? () => setWeekShift(0) : null}
          reduce={reduce}
        />
      ) : (
        <MonthView
          group={group}
          now={now}
          monthShift={monthShift}
          onShift={(n) => setMonthShift((s) => s + n)}
          onReset={monthShift !== 0 ? () => setMonthShift(0) : null}
          selected={selected}
          onSelect={setSelected}
          onSeeWeek={(iso) => {
            setWeekShift(daysBetween(homeMonday(today), weekOf(iso)) / 7);
            setTab("semaine");
          }}
          reduce={reduce}
        />
      );
  }

  return (
    <div className={cn("w-full text-foreground", className)}>
      <div role="tablist" aria-label="Affichage" className="mb-4 flex justify-center gap-6">
        {tabs.map(({ key, label, Icon }) => {
          const on = tab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              id={`${tabsId}-${key}`}
              aria-selected={on}
              aria-controls={`${tabsId}-panel`}
              onClick={() => setTab(key)}
              className={cn(
                "relative flex items-center gap-1.5 px-1 py-1.5 text-xs font-medium tracking-[0.16em] uppercase transition-colors",
                on ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              {label}
              {on && (
                <motion.span
                  layoutId={`${tabsId}-underline`}
                  className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary"
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${tab}`}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={now == null ? "skeleton" : tab}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: tab === "mois" ? 24 : -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: tab === "mois" ? -24 : 24 }}
            transition={{ duration: reduce ? 0.1 : 0.25, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {body}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export interface TodayCardProps {
  group: string;
  className?: string;
}

/** Compact: the now/next card plus what is left today. */
export function TodayCard({ group, className }: TodayCardProps) {
  const now = useNow();
  if (now == null) {
    return (
      <div className={className}>
        <Skeleton compact />
      </div>
    );
  }
  const d = new Date(now);
  const today = isoOf(d);
  const t = minutesOfDay(d);
  const rest = eventsOn(today, group).filter((e) => isTimed(e) && toMinutes(e.start) > t);

  return (
    <div className={cn("space-y-3 text-foreground", className)}>
      <NowCard group={group} now={now} />
      {rest.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">Encore aujourd&apos;hui</p>
          <ul className="space-y-1.5">
            {rest.map((e) => (
              <EventChip key={e.id} e={e} compact />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
