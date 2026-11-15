import { AppHeader, MobileNav } from "@/components/shell/app-header";
import { displayName, requireProfile } from "@/lib/auth";
import { getHeaderStats } from "@/lib/data/stats";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await requireProfile();
  const stats = await getHeaderStats();
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        user={{ name: profile.full_name || displayName(profile), username: profile.username, avatar: profile.avatar_url, role: profile.role }}
        stats={{
          xp: stats.xp,
          level: stats.level.level,
          streak: stats.streak.current_streak,
          longest: stats.streak.longest_streak,
          activeToday: stats.streak.active_today,
          activeDays: stats.activeDays,
          group: profile.group_code,
          section: profile.section,
        }}
      />
      <main id="contenu" className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-8 md:px-8 md:pb-16 md:pt-10">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
