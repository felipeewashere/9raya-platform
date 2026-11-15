"use client";

import { AppHeader, MobileNav } from "./app-header";
import { RequireSession, useSession } from "./session";
import { PageSkeleton } from "./skeletons";
import { displayName } from "@/lib/auth";
import { getHeaderStats } from "@/lib/data/stats";
import { useData } from "@/lib/use-data";

/** Layout of the app pages: guard, header with XP / streak / calendar, mobile nav. */
export function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <RequireSession
      fallback={
        <div className="flex min-h-dvh flex-col">
          <div className="h-12 border-b border-[var(--rule)]" />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-8 md:px-8 md:pt-10">
            <PageSkeleton />
          </main>
        </div>
      }
    >
      <Frame>{children}</Frame>
    </RequireSession>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  const { profile } = useSession();
  const { data: stats } = useData(`header:${profile.id}`, getHeaderStats);
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        user={{ name: profile.full_name || displayName(profile), username: profile.username, avatar: profile.avatar_url, role: profile.role }}
        stats={{
          xp: stats?.xp ?? 0,
          level: stats?.level.level ?? 1,
          streak: stats?.streak.current_streak ?? 0,
          longest: stats?.streak.longest_streak ?? 0,
          activeToday: stats?.streak.active_today ?? false,
          activeDays: stats?.activeDays ?? [],
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
