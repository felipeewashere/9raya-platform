import Link from "next/link";
import { Settings } from "lucide-react";
import { requireProfile, displayName } from "@/lib/auth";
import { getDashboardData, localDay } from "@/lib/data/stats";
import { createClient } from "@/lib/supabase/server";
import { STREAK_MILESTONES } from "@/lib/gamification";
import { markAchievementsSeen } from "@/app/actions/profile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AchievementBadge, CountUp, ProgressBar, StreakFlame } from "@/components/rewards/rewards";
import { LeaderRow, NoteLabel, NotesPage, SectionTitle } from "@/components/notes";
import { initials } from "@/components/shell/app-header";
import { cn } from "@/lib/utils";

export const metadata = { title: "Profil" };

export default async function ProfilePage() {
  const profile = await requireProfile();
  const data = await getDashboardData(profile.timezone);
  const supabase = await createClient();
  const [{ data: all }, { data: mine }] = await Promise.all([
    supabase.from("achievements").select("id, title, description, icon, position").order("position"),
    supabase.from("user_achievements").select("achievement_id, earned_at").eq("user_id", profile.id),
  ]);
  const earned = new Map(((mine ?? []) as { achievement_id: string; earned_at: string }[]).map((m) => [m.achievement_id, m.earned_at]));
  await markAchievementsSeen();

  // 5-week calendar ending today (Monday-first columns)
  const active = new Set(data.activeDays);
  const today = new Date();
  // Monday = 0 … Sunday = 6, in the student's time zone
  const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dow = Math.max(0, WEEKDAYS.indexOf(new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: profile.timezone }).format(today)));
  const days: { day: string; label: number; future: boolean }[] = [];
  const startOffset = 28 + dow; // first cell = Monday four weeks ago
  for (let i = startOffset; i > startOffset - 35; i--) {
    const d = new Date(today.getTime() - i * 86400_000);
    const day = localDay(d, profile.timezone);
    days.push({ day, label: Number(day.slice(8)), future: i < 0 });
  }
  const todayStr = localDay(today, profile.timezone);
  const name = profile.full_name || displayName(profile);

  return (
    <NotesPage className="mx-auto max-w-4xl" footer={{ label: name, page: `Niveau ${data.level.level}` }}>
      <header className="flex flex-col items-center gap-3 text-center">
        <Avatar className="size-20 border-[1.5px] border-primary/40">
          {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt="" />}
          <AvatarFallback className="bg-brand-soft text-2xl font-bold text-primary">{initials(name)}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-[1.9rem] font-bold leading-tight text-primary smallcaps sm:text-[2.3rem]">{name}</h1>
          {profile.username && <p className="text-muted-foreground">@{profile.username}</p>}
          <p className="mt-1 text-[0.95rem]">
            <NoteLabel tone="gold">Membre depuis :</NoteLabel> {new Date(profile.created_at).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/parametres">
            <Settings /> Modifier
          </Link>
        </Button>
      </header>

      <div className="mt-10 space-y-10">
        <section aria-labelledby="niveau" className="space-y-3">
          <SectionTitle number={1} id="niveau">
            Niveau et chiffres
          </SectionTitle>
          <div className="grid gap-x-10 sm:ml-10 sm:grid-cols-2">
            <div>
              <LeaderRow
                label={`Niveau ${data.level.level}`}
                value={
                  <>
                    <CountUp value={data.xp} /> XP
                  </>
                }
                hint={`${data.level.needed - data.level.current} XP avant le niveau ${data.level.level + 1}`}
              />
              <ProgressBar value={data.level.progress} className="mb-2 mt-1 h-1" label="Progression du niveau" />
              <LeaderRow label="XP aujourd'hui" value={<CountUp value={data.todayXp} />} />
            </div>
            <div>
              <LeaderRow label="Leçons terminées" value={<CountUp value={data.lessonsCompleted} />} />
              <LeaderRow label="Questions répondues" value={<CountUp value={data.answered} />} />
              <LeaderRow label="Précision" value={data.accuracy === null ? "—" : <CountUp value={Math.round(data.accuracy * 100)} suffix=" %" />} />
            </div>
          </div>
        </section>

        <section id="serie" aria-labelledby="serie-titre" className="scroll-mt-20 space-y-3">
          <SectionTitle number={2} id="serie-titre">
            Série
          </SectionTitle>
          <div className="grid gap-8 sm:ml-10 lg:grid-cols-[auto_1fr]">
            <div className="flex items-center gap-4 lg:flex-col lg:items-start">
              <StreakFlame streak={data.streak.current_streak} active={data.streak.active_today} size="lg" />
              <div>
                <p className="text-[2.5rem] font-bold leading-none text-primary">
                  <CountUp value={data.streak.current_streak} />
                </p>
                <p>jour{data.streak.current_streak > 1 ? "s" : ""} de série</p>
                <p className="mt-1 text-[0.92rem] text-muted-foreground">Record : {data.streak.longest_streak} jours</p>
                {!data.streak.active_today && data.streak.current_streak > 0 && (
                  <p className="mt-2 text-[0.95rem]">
                    <NoteLabel tone="red">Attention :</NoteLabel> gagne de l&apos;XP aujourd&apos;hui pour garder ta série !
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="mb-2">
                  <NoteLabel>5 dernières semaines :</NoteLabel>
                </p>
                <div className="grid max-w-md grid-cols-7 gap-1" role="grid" aria-label="Calendrier d'activité">
                  {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                    <span key={i} className="text-center text-[0.8rem] font-bold text-muted-foreground">
                      {d}
                    </span>
                  ))}
                  {days.map((d) => (
                    <span
                      key={d.day}
                      role="gridcell"
                      aria-label={`${d.day}${active.has(d.day) ? " : actif" : ""}`}
                      className={cn(
                        "grid aspect-square place-items-center rounded-[3px] text-[0.8rem] tabular-nums",
                        d.future ? "opacity-0" : active.has(d.day) ? "bg-primary font-bold text-primary-foreground" : "bg-muted text-muted-foreground",
                        d.day === todayStr && "outline-2 outline-offset-1 outline-reward",
                      )}
                    >
                      {d.label}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2">
                  <NoteLabel>Paliers :</NoteLabel>
                </p>
                <div className="flex flex-wrap gap-2">
                  {STREAK_MILESTONES.map((m) => (
                    <span
                      key={m}
                      className={cn(
                        "rounded-[3px] border px-2.5 py-0.5 text-[0.92rem]",
                        data.streak.longest_streak >= m ? "border-reward bg-reward-soft font-bold text-reward-foreground" : "text-muted-foreground",
                      )}
                    >
                      {m} jours
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="succes" aria-labelledby="succes-titre" className="scroll-mt-20 space-y-3">
          <SectionTitle
            number={3}
            id="succes-titre"
            aside={
              <span className="font-bold tabular-nums text-muted-foreground">
                {earned.size} / {all?.length ?? 0}
              </span>
            }
          >
            Succès
          </SectionTitle>
          <ProgressBar value={all?.length ? earned.size / all.length : 0} tone="reward" label="Succès débloqués" className="h-1 sm:ml-10 sm:w-[calc(100%-2.5rem)]" />
          <ul className="grid gap-x-8 gap-y-4 pt-2 sm:ml-10 sm:grid-cols-2">
            {((all ?? []) as { id: string; title: string; description: string; icon: string }[]).map((a) => {
              const at = earned.get(a.id);
              return (
                <li key={a.id} className="flex items-center gap-3">
                  <AchievementBadge icon={a.icon} earned={!!at} className="size-10 [&_svg]:size-5" />
                  <div className="min-w-0">
                    <p className={cn("font-bold", !at && "text-muted-foreground")}>{a.title}</p>
                    <p className="text-[0.9rem] text-muted-foreground">{a.description}</p>
                    {at && <p className="text-[0.85rem] italic text-reward-foreground">Obtenu le {new Date(at).toLocaleDateString("fr-FR")}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </NotesPage>
  );
}
