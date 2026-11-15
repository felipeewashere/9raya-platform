"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DocTitle, NotesPage } from "@/components/notes";
import { Leaderboard, type LeaderRow } from "@/components/leaderboard/leaderboard";
import { useSession } from "@/components/shell/session";
import { PageSkeleton } from "@/components/shell/skeletons";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/lib/use-data";
import { cn } from "@/lib/utils";

const PERIODS = [
  { id: "jour", label: "Aujourd'hui" },
  { id: "semaine", label: "Semaine" },
  { id: "tout", label: "Tout temps" },
] as const;

async function loadLeaderboard(period: string) {
  const { data, error } = await createClient().rpc("leaderboard", { p_period: period, p_limit: 50 });
  return { rows: (data ?? []) as LeaderRow[], failed: Boolean(error) };
}

export function LeaderboardView() {
  const sp = useSearchParams();
  const { profile } = useSession();
  const period = PERIODS.find((p) => p.id === sp.get("periode"))?.id ?? "semaine";
  const { data } = useData(`leaderboard:${profile.id}:${period}`, () => loadLeaderboard(period));

  return (
    <NotesPage className="mx-auto max-w-3xl space-y-6" footer={{ label: "Classement", page: PERIODS.find((p) => p.id === period)?.label }}>
      <DocTitle title="Classement" subtitleLabel="Période :" subtitle={PERIODS.find((p) => p.id === period)?.label.toLowerCase()} />
      <div className="flex justify-center">
        <nav className="flex rounded-md border border-primary/40 p-0.5" aria-label="Période">
          {PERIODS.map((p) => (
            <Link
              key={p.id}
              href={`/classement?periode=${p.id}`}
              aria-current={p.id === period ? "page" : undefined}
              className={cn(
                "rounded-sm px-3 py-1 text-[0.95rem] transition-colors",
                p.id === period ? "bg-primary font-bold text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </Link>
          ))}
        </nav>
      </div>
      {!data ? (
        <PageSkeleton />
      ) : data.failed ? (
        <p className="py-6 text-center italic text-muted-foreground">Classement indisponible pour le moment.</p>
      ) : (
        <Leaderboard key={period} rows={data.rows} />
      )}
    </NotesPage>
  );
}
