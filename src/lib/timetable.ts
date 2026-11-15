// ─────────────────────────────────────────────────────────────────────────────
// AP1 — S1 timetable ("emploi du temps"), ENSA Agadir. Pure data + helpers, no React.
//
// Source PDFs (checked line by line against the rendered pages):
//   - "EMPLOI DU TEMPS -AP1- du Semestre S1 (Semaine 26 Octobre - 31 Octobre 2026)"
//   - "Emploi du temps de TP de Mécanique du point — Semaine 26-31 octobre 2026"
// Groups: G1-G4 = Section 1, G5-G6 = Section 2. TP groups "Gr1-C".."Gr6-C" are read as G1..G6.
//
// Dates are local ISO strings "YYYY-MM-DD" (the students are in Africa/Casablanca; we simply use
// the device's local date, like the original prototype). Times are "HH:MM".
//
// HOW TO ADD A NEW WEEK
//   1. Append an object to WEEKS: { monday: "YYYY-MM-DD", holidays?: { "YYYY-MM-DD": "Name" }, rows: [...] }.
//      `monday` MUST be the Monday of that week (hasWeek() matches on it).
//   2. One row per box of the PDF, using the helpers:
//        cours(day, slot, subject, prof, room, SEC1 | SEC2)   — lecture for a whole section
//        td(day, slot, subject, prof, room, "G3")             — TD for one group
//      day: 0 = Lundi … 5 = Samedi. slot: "A" | "B" | "C" | "D" (see SLOTS; Friday afternoon slots
//      have their own hours, see FRIDAY_SLOTS — check the PDF header each week).
//      subject: a key of SUBJECTS (add a new key there if a new module appears).
//   3. TP sessions go in TP (exact date + times, they don't follow the slots).
//   4. Real exam dates: edit EXAMS and set `approx: false`.
//   5. Run `npx vitest run tests/timetable.test.ts`.
// ─────────────────────────────────────────────────────────────────────────────

export type SlotKey = "A" | "B" | "C" | "D";
export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5;
export type EventType = "cours" | "td" | "tp" | "exam" | "off";

export const SLOTS: Record<SlotKey, readonly [string, string]> = {
  A: ["08:30", "10:15"],
  B: ["10:30", "12:15"],
  C: ["12:45", "14:30"],
  D: ["14:45", "16:30"],
};

/** Friday has a longer lunch break (prayer): afternoon slots shift. */
export const FRIDAY_SLOTS: Record<SlotKey, readonly [string, string]> = {
  ...SLOTS,
  C: ["14:00", "15:45"],
  D: ["16:00", "17:45"],
};

export function slotTime(day: DayIndex, slot: SlotKey): readonly [string, string] {
  return (day === 4 ? FRIDAY_SLOTS : SLOTS)[slot];
}

export const SUBJECTS = {
  algo: { name: "Algorithmique et Résolution de Problèmes", short: "Algo" },
  ana: { name: "Analyse 1", short: "Analyse 1" },
  alg: { name: "Algèbre 1", short: "Algèbre 1" },
  meca: { name: "Mécanique du point", short: "Méca" },
  elec: { name: "Électrostatique", short: "Électro" },
  ent: { name: "Entrepreneuriat et Compétences Digitales", short: "Entrepreneuriat" },
  fr: { name: "Langue Française 1", short: "Français" },
} as const satisfies Record<string, { name: string; short: string }>;

export type SubjectKey = keyof typeof SUBJECTS;

export const SECTIONS = {
  "1": ["G1", "G2", "G3", "G4"],
  "2": ["G5", "G6"],
} as const;

export type Group = (typeof SECTIONS)[keyof typeof SECTIONS][number];
export const GROUPS: readonly Group[] = [...SECTIONS["1"], ...SECTIONS["2"]];

const SEC1: readonly string[] = SECTIONS["1"];
const SEC2: readonly string[] = SECTIONS["2"];

export function sectionOf(group: string): "1" | "2" | null {
  if (SEC1.includes(group)) return "1";
  if (SEC2.includes(group)) return "2";
  return null;
}

/** [day, slot, type, subject, prof, room, groups] */
export type WeekRow = readonly [DayIndex, SlotKey, "cours" | "td", SubjectKey, string, string, readonly string[]];

export interface WeekDef {
  /** ISO date of the Monday of that week. */
  monday: string;
  /** Public holidays inside that week: ISO date → name. */
  holidays?: Record<string, string>;
  rows: readonly WeekRow[];
}

const cours = (day: DayIndex, slot: SlotKey, subject: SubjectKey, prof: string, room: string, groups: readonly string[]): WeekRow =>
  [day, slot, "cours", subject, prof, room, groups];
const td = (day: DayIndex, slot: SlotKey, subject: SubjectKey, prof: string, room: string, group: string): WeekRow =>
  [day, slot, "td", subject, prof, room, [group]];

export const WEEKS: readonly WeekDef[] = [
  {
    monday: "2026-10-26",
    // Saturday 31/10 is crossed out "Jour férié" in the PDF (its usual Langue Française / TD boxes are cancelled).
    holidays: { "2026-10-31": "Fête de l'Unité" },
    rows: [
      // Lundi
      td(0, "A", "algo", "H. BOUTGOULA", "4 Med", "G3"),
      cours(0, "A", "ana", "Said TAARABTI", "Amphi 2", SEC2),
      cours(0, "B", "ana", "Said TAARABTI", "Amphi 1", SEC1),
      td(0, "B", "algo", "H. BOUTGOULA", "4 Med", "G5"),
      td(0, "C", "meca", "L. BENCHOUAF", "5 Med", "G4"),
      td(0, "C", "elec", "M. EL AZZAOUI", "6 Med", "G6"),
      td(0, "D", "meca", "L. BENCHOUAF", "5 Med", "G1"),
      td(0, "D", "elec", "M. EL AZZAOUI", "6 Med", "G2"),
      // Mardi
      td(1, "A", "algo", "H. BOUTGOULA", "5 Med", "G2"),
      td(1, "A", "elec", "A. NARJIS", "4 Med", "G4"),
      td(1, "B", "elec", "A. NARJIS", "4 Med", "G1"),
      td(1, "B", "alg", "S. HADIRI", "6 Med", "G3"),
      td(1, "B", "algo", "H. BOUTGOULA", "5 Med", "G4"),
      td(1, "C", "alg", "K. DLIOU", "5 Med", "G2"),
      td(1, "C", "ana", "Z. FATIMA OUGHAJJI", "6 Med", "G3"),
      td(1, "D", "alg", "K. DLIOU", "5 Med", "G1"),
      td(1, "D", "ana", "Z. FATIMA OUGHAJJI", "6 Med", "G2"),
      td(1, "D", "meca", "L. BENCHOUAF", "4 Med", "G3"),
      // Mercredi
      cours(2, "A", "alg", "Abdellah BNOUHACHEM", "Amphi 1", SEC1),
      td(2, "A", "ana", "K. DLIOU", "5 Med", "G5"),
      td(2, "A", "algo", "I. EL TAZY", "6 Med", "G6"),
      td(2, "B", "algo", "I. EL TAZY", "6 Med", "G1"),
      td(2, "B", "ana", "K. DLIOU", "5 Med", "G4"),
      cours(2, "B", "alg", "Abdellah BNOUHACHEM", "Amphi 2", SEC2),
      cours(2, "C", "algo", "Lamya OUKHOUYA", "Amphi 1", SEC1),
      td(2, "D", "meca", "L. BENCHOUAF", "6 Med", "G2"),
      cours(2, "D", "algo", "Lamya OUKHOUYA", "Amphi 1", SEC2),
      // Jeudi
      cours(3, "A", "meca", "Abdellah TIHANE", "Amphi 1", SEC1),
      td(3, "A", "alg", "A. BNOUHACHEM", "5 Med", "G5"),
      td(3, "B", "alg", "A. BNOUHACHEM", "5 Med", "G4"),
      cours(3, "B", "elec", "Marouane EL AZZAOUI", "Amphi 2", SEC2),
      td(3, "C", "meca", "L. BENCHOUAF", "5 Med", "G5"),
      td(3, "C", "alg", "B. LKAIHAL", "4 Med", "G6"),
      td(3, "D", "meca", "L. BENCHOUAF", "5 Med", "G6"),
      // Vendredi
      cours(4, "A", "ent", "Majda Radi Oubaha", "Amphi 1", SEC1),
      cours(4, "A", "meca", "Abdellah TIHANE", "Amphi 2", SEC2),
      cours(4, "B", "elec", "Marouane EL AZZAOUI", "Amphi 1", SEC1),
      cours(4, "B", "ent", "Majda Radi Oubaha", "Amphi 2", SEC2),
    ],
  },
];

/**
 * Fixed-date national holidays (civil calendar, certain). Religious holidays (Aïd…) move with the
 * lunar calendar: add them per week in WEEKS[].holidays once the official date is announced.
 */
export const HOLIDAYS: Readonly<Record<string, string>> = {
  "2026-10-31": "Fête de l'Unité",
  "2026-11-06": "Marche Verte",
  "2026-11-18": "Fête de l'Indépendance",
  "2027-01-01": "Nouvel An",
  "2027-01-11": "Manifeste de l'Indépendance",
  "2027-01-14": "Nouvel An amazigh",
  "2027-05-01": "Fête du Travail",
  "2027-07-30": "Fête du Trône",
};

export interface TpSession {
  date: string;
  start: string;
  end: string;
  group: string;
  profs: string;
  subject: SubjectKey;
}

export const TP: readonly TpSession[] = [
  { date: "2026-10-26", start: "10:30", end: "12:30", group: "G6", profs: "SADIK / ETTIR", subject: "meca" },
  { date: "2026-10-26", start: "12:30", end: "14:30", group: "G2", profs: "SADIK / ETTIR", subject: "meca" },
  { date: "2026-10-27", start: "10:30", end: "12:30", group: "G5", profs: "ABOULAIDI / OUBBAD", subject: "meca" },
  { date: "2026-10-27", start: "12:30", end: "14:30", group: "G1", profs: "ABOULAIDI / OUBBAD", subject: "meca" },
  { date: "2026-10-28", start: "10:30", end: "12:30", group: "G3", profs: "OUBBAD / SADIK", subject: "meca" },
  { date: "2026-10-29", start: "12:30", end: "14:30", group: "G4", profs: "OUBBAD / SADIK", subject: "meca" },
];

export interface ExamWindow {
  semester: "S1" | "S2";
  from: string;
  to: string;
  /** true = estimate (usual Moroccan calendar), not the official date yet. */
  approx: boolean;
}

// !!! ESTIMATES: the official ENSA Agadir exam calendar is not published yet. These windows follow the
// usual pattern (S1 exams in January, S2 in June). Replace with the real dates and set approx:false.
export const EXAMS: readonly ExamWindow[] = [
  { semester: "S1", from: "2027-01-11", to: "2027-01-22", approx: true },
  { semester: "S2", from: "2027-05-31", to: "2027-06-11", approx: true },
];

export interface TimetableEvent {
  id: string;
  type: EventType;
  /** Full title, e.g. "Analyse 1", "TP Mécanique du point", "Examens S1", "Fête de l'Unité". */
  title: string;
  /** Short title for small blocks. */
  short: string;
  subject?: SubjectKey;
  /** "HH:MM" — absent for all-day events (holiday, exam window). */
  start?: string;
  end?: string;
  prof?: string;
  room?: string;
  semester?: "S1" | "S2";
  approx?: boolean;
}

// ───────── date helpers (local dates) ─────────

const pad2 = (n: number) => String(n).padStart(2, "0");

export function isoOf(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function dateOf(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, n: number): string {
  const d = dateOf(iso);
  d.setDate(d.getDate() + n);
  return isoOf(d);
}

/** 0 = Monday … 6 = Sunday. */
export function dayIndex(iso: string): number {
  return (dateOf(iso).getDay() + 6) % 7;
}

/** Whole days from a to b (DST-safe). */
export function daysBetween(a: string, b: string): number {
  return Math.round((dateOf(b).getTime() - dateOf(a).getTime()) / 864e5);
}

/** ISO date of the Monday of the week containing `iso`. */
export function weekOf(iso: string): string {
  return addDays(iso, -dayIndex(iso));
}

/** The 7 ISO dates (Mon → Sun) of the week starting at `mondayIso`. */
export function weekDays(mondayIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(mondayIso, i));
}

/** Is there a transcribed timetable for the week starting at `mondayIso`? */
export function hasWeek(mondayIso: string): boolean {
  const monday = weekOf(mondayIso);
  return WEEKS.some((w) => w.monday === monday);
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function fromMinutes(min: number): string {
  return `${pad2(Math.floor(min / 60) % 24)}:${pad2(min % 60)}`;
}

export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

// ───────── events ─────────

/**
 * Every school event of one date for one group, timed events sorted by start, all-day events last.
 * `section` (1 or 2): lectures (cours) are matched by section, TD/TP by group name. The student says
 * each section has groups G1–G6; the timetable PDF of 26–31/10 lists G1–G4 under section 1 and G5–G6
 * under section 2, so until a per-section timetable arrives, TDs are matched by group name only.
 */
export function eventsOn(iso: string, group: string, section?: number | string | null): TimetableEvent[] {
  const sec = section == null ? null : String(section);
  const out: TimetableEvent[] = [];
  for (const w of WEEKS) {
    const day = daysBetween(w.monday, iso);
    if (day >= 0 && day <= 5) {
      for (const [d, slot, type, subject, prof, room, groups] of w.rows) {
        const isLecture = type === "cours" && groups.length > 1;
        const match = isLecture && sec ? sectionOf(groups[0]) === sec : groups.includes(group);
        if (d !== day || !match) continue;
        const [start, end] = slotTime(d, slot);
        out.push({
          id: `${iso}-${type}-${slot}-${subject}`,
          type,
          subject,
          title: SUBJECTS[subject].name,
          short: SUBJECTS[subject].short,
          start,
          end,
          prof,
          room,
        });
      }
    }
  }
  const holiday = WEEKS.find((w) => w.holidays?.[iso])?.holidays?.[iso] ?? HOLIDAYS[iso];
  if (holiday) out.push({ id: `${iso}-off`, type: "off", title: holiday, short: "Férié" });
  for (const tp of TP) {
    if (tp.date !== iso || tp.group !== group) continue;
    out.push({
      id: `${iso}-tp-${tp.start}`,
      type: "tp",
      subject: tp.subject,
      title: `TP ${SUBJECTS[tp.subject].name}`,
      short: `TP ${SUBJECTS[tp.subject].short}`,
      start: tp.start,
      end: tp.end,
      prof: tp.profs,
    });
  }
  for (const e of EXAMS) {
    if (iso >= e.from && iso <= e.to) {
      out.push({
        id: `${iso}-exam-${e.semester}`,
        type: "exam",
        title: `Examens ${e.semester}`,
        short: `Exams ${e.semester}`,
        semester: e.semester,
        approx: e.approx,
      });
    }
  }
  return out.sort((a, b) => (a.start ?? "99").localeCompare(b.start ?? "99"));
}

export const isTimed = (e: TimetableEvent): e is TimetableEvent & { start: string; end: string } =>
  e.start != null && e.end != null;

// ───────── "now" ─────────

export interface NowInfo {
  /** Event happening right now (timed), if any. */
  current: TimetableEvent | null;
  /** Next timed event, today or in the coming days. */
  next: { iso: string; event: TimetableEvent } | null;
  /** All-day events of today (holiday, exam window). */
  allDay: TimetableEvent[];
  /** 0..1 — through the current event, or through the break before the next one today. */
  progress: number | null;
  /** Minutes until the current event ends, or until the next one starts (today only). */
  minutesLeft: number | null;
}

/** What is happening at `minutes` (minutes since midnight) on `iso` for `group`, and what comes next. */
export function nowInfo(iso: string, minutes: number, group: string, lookaheadDays = 21): NowInfo {
  const today = eventsOn(iso, group);
  const timed = today.filter(isTimed);
  const allDay = today.filter((e) => !isTimed(e));

  const current = timed.find((e) => toMinutes(e.start) <= minutes && minutes < toMinutes(e.end)) ?? null;
  if (current && isTimed(current)) {
    const s = toMinutes(current.start), e = toMinutes(current.end);
    const after = timed.find((x) => toMinutes(x.start) >= e && x.id !== current.id);
    return {
      current,
      next: after ? { iso, event: after } : findNext(iso, group, lookaheadDays),
      allDay,
      progress: (minutes - s) / (e - s),
      minutesLeft: e - minutes,
    };
  }

  const nextToday = timed.find((e) => toMinutes(e.start) > minutes);
  if (nextToday && isTimed(nextToday)) {
    const start = toMinutes(nextToday.start);
    const ended = timed.filter((e) => toMinutes(e.end) <= minutes);
    const prevEnd = ended.length ? Math.max(...ended.map((e) => toMinutes(e.end))) : null;
    return {
      current: null,
      next: { iso, event: nextToday },
      allDay,
      progress: prevEnd != null ? (minutes - prevEnd) / Math.max(start - prevEnd, 1) : null,
      minutesLeft: start - minutes,
    };
  }

  return { current: null, next: findNext(iso, group, lookaheadDays), allDay, progress: null, minutesLeft: null };
}

function findNext(iso: string, group: string, lookaheadDays: number): NowInfo["next"] {
  for (let i = 1; i <= lookaheadDays; i++) {
    const day = addDays(iso, i);
    const first = eventsOn(day, group).find(isTimed);
    if (first) return { iso: day, event: first };
  }
  return null;
}

// ───────── French labels ─────────

export const DAYS_FR = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;
export const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
] as const;

export const TYPE_LABEL: Record<EventType, string> = {
  cours: "Cours",
  td: "TD",
  tp: "TP",
  exam: "Examen",
  off: "Jour férié",
};

/** "1h05", "2h", "25 min". */
export function formatDuration(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60), r = m % 60;
  return h ? `${h}h${r ? pad2(r) : ""}` : `${r} min`;
}

/** "lundi 26 octobre". */
export function formatDay(iso: string): string {
  const d = dateOf(iso);
  return `${DAYS_FR[dayIndex(iso)].toLowerCase()} ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
}
