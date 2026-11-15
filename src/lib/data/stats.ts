import "server-only";
import { cache } from "react";
import { createClient, getUser } from "@/lib/supabase/server";
import { levelFromXp } from "@/lib/gamification";

export type Streak = { current_streak: number; longest_streak: number; active_today: boolean };

export const getStreak = cache(async (): Promise<Streak> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_streak");
  const row = (Array.isArray(data) ? data[0] : data) as Streak | null;
  return row ?? { current_streak: 0, longest_streak: 0, active_today: false };
});

export const getTotalXp = cache(async (): Promise<number> => {
  const user = await getUser();
  if (!user) return 0;
  const supabase = await createClient();
  const { data } = await supabase.from("xp_events").select("amount").eq("user_id", user.id);
  return (data ?? []).reduce((n, r) => n + (r as { amount: number }).amount, 0);
});

/** Days (YYYY-MM-DD, student's local day) on which the student earned XP, last ~13 months. */
export const getActiveDays = cache(async (): Promise<string[]> => {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  const since = new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10);
  const { data } = await supabase.from("activity_days").select("day").eq("user_id", user.id).gt("xp", 0).gte("day", since);
  return (data ?? []).map((r) => String((r as { day: string }).day).slice(0, 10));
});

export const getHeaderStats = cache(async () => {
  const [xp, streak, activeDays] = await Promise.all([getTotalXp(), getStreak(), getActiveDays()]);
  return { xp, streak, level: levelFromXp(xp), activeDays };
});

/** Local calendar day string (YYYY-MM-DD) in a timezone. */
export function localDay(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export type DashboardData = {
  xp: number;
  level: ReturnType<typeof levelFromXp>;
  streak: Streak;
  todayXp: number;
  lessonsCompleted: number;
  accuracy: number | null;
  answered: number;
  week: { day: string; label: string; xp: number; isToday: boolean }[];
  activeDays: string[]; // last 35 days with activity, for the calendar
  recentAchievements: { id: string; title: string; description: string; icon: string; earned_at: string }[];
  achievementCount: number;
  achievementTotal: number;
};

export const getDashboardData = cache(async (timeZone: string): Promise<DashboardData> => {
  const user = await getUser();
  const supabase = await createClient();
  const uid = user?.id ?? "00000000-0000-0000-0000-000000000000";
  const since = new Date(Date.now() - 40 * 86400_000).toISOString().slice(0, 10);

  const [xp, streak, days, done, answers, earned, allAch] = await Promise.all([
    getTotalXp(),
    getStreak(),
    supabase.from("activity_days").select("day, xp").eq("user_id", uid).gte("day", since),
    supabase.from("lesson_progress").select("lesson_id", { count: "exact", head: true }).eq("user_id", uid).eq("status", "completed"),
    supabase.from("answer_events").select("correct").eq("user_id", uid).order("created_at", { ascending: false }).limit(500),
    supabase.from("user_achievements").select("earned_at, achievement:achievements(id, title, description, icon)").eq("user_id", uid).order("earned_at", { ascending: false }),
    supabase.from("achievements").select("id", { count: "exact", head: true }),
  ]);

  const byDay = new Map<string, number>();
  for (const d of (days.data ?? []) as { day: string; xp: number }[]) byDay.set(d.day, d.xp);

  const today = localDay(new Date(), timeZone);
  const week: DashboardData["week"] = [];
  const fmt = new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone });
  for (let i = 6; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400_000);
    const day = localDay(date, timeZone);
    week.push({ day, label: fmt.format(date).replace(".", ""), xp: byDay.get(day) ?? 0, isToday: day === today });
  }

  const ans = (answers.data ?? []) as { correct: boolean }[];
  const earnedRows = (earned.data ?? []) as unknown as { earned_at: string; achievement: { id: string; title: string; description: string; icon: string } }[];

  return {
    xp,
    level: levelFromXp(xp),
    streak,
    todayXp: byDay.get(today) ?? 0,
    lessonsCompleted: done.count ?? 0,
    accuracy: ans.length ? ans.filter((a) => a.correct).length / ans.length : null,
    answered: ans.length,
    week,
    activeDays: [...byDay.entries()].filter(([, v]) => v > 0).map(([d]) => d),
    recentAchievements: earnedRows.slice(0, 4).map((r) => ({ ...r.achievement, earned_at: r.earned_at })),
    achievementCount: earnedRows.length,
    achievementTotal: allAch.count ?? 0,
  };
});
