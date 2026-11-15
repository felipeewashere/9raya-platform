import Link from "next/link";
import { DocTitle, NotesPage } from "@/components/notes";
import { createClient } from "@/lib/supabase/server";
import { Leaderboard, type LeaderRow } from "@/components/leaderboard/leaderboard";
import { cn } from "@/lib/utils";

export const metadata = { title: "Classement" };

const PERIODS = [
  { id: "jour", label: "Aujourd'hui" },
  { id: "semaine", label: "Semaine" },
  { id: "tout", label: "Tout temps" },
] as const;

export default async function LeaderboardPage({ searchParams }: PageProps<"/classement">) {
  const sp = await searchParams;
  const period = PERIODS.find((p) => p.id === sp.periode)?.id ?? "semaine";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("leaderboard", { p_period: period, p_limit: 50 });
  const rows = (data ?? []) as LeaderRow[];

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
      {error ? (
        <p className="py-6 text-center italic text-muted-foreground">Classement indisponible pour le moment.</p>
      ) : (
        <Leaderboard key={period} rows={rows} />
      )}
    </NotesPage>
  );
}
