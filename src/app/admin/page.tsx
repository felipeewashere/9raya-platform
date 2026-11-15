import Link from "next/link";
import { Activity, BookOpen, HelpCircle, TrendingDown, UserPlus, Users } from "lucide-react";
import { EmptyState, formatDate, PageHeader, Panel, StatCard, StatusBadge } from "@/components/admin/parts";
import { getOverview } from "./_lib/data";

export const metadata = { title: "Vue d'ensemble" };

export default async function AdminOverviewPage() {
  const { counts, signups, weakest } = await getOverview();
  const n = (v: number) => v.toLocaleString("fr-FR");
  return (
    <>
      <PageHeader title="Vue d'ensemble" description="L'activité de la plateforme en un coup d'œil." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Étudiants" value={n(counts.students)} icon={Users} />
        <StatCard label="Leçons" value={n(counts.lessons)} icon={BookOpen} hint="publiées et brouillons" />
        <StatCard label="Questions" value={n(counts.questions)} icon={HelpCircle} hint="quiz et questions intégrées" />
        <StatCard label="Quiz terminés" value={n(counts.attempts7d)} icon={Activity} hint="7 derniers jours" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Inscriptions récentes" actions={<Link href="/admin/etudiants" className="text-sm text-primary hover:underline">Tous les étudiants</Link>}>
          {signups.length === 0 ? (
            <EmptyState icon={UserPlus} title="Aucune inscription pour l'instant" />
          ) : (
            <ul className="divide-y">
              {signups.map((s) => (
                <li key={s.id}>
                  <Link href={`/admin/etudiants/${s.id}`} className="flex items-center gap-3 rounded-md px-1 py-2.5 hover:bg-muted/60">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-primary">
                      {(s.full_name || s.username || "?").slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{s.full_name || s.username || "Sans nom"}</span>
                      {s.username && <span className="block truncate text-xs text-muted-foreground">@{s.username}</span>}
                    </span>
                    {s.role === "admin" && <StatusBadge status="admin" />}
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDate(s.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Leçons au plus faible taux de réussite" description="Quiz terminés uniquement." actions={<Link href="/admin/analytique" className="text-sm text-primary hover:underline">Analytique</Link>}>
          {weakest.length === 0 ? (
            <EmptyState icon={TrendingDown} title="Pas encore de quiz terminé" description="Les statistiques apparaîtront dès que des étudiants auront fini des quiz." />
          ) : (
            <ul className="divide-y">
              {weakest.map((l) => (
                <li key={l.lesson_id}>
                  <Link href={`/admin/analytique/${l.lesson_id}`} className="flex items-center gap-3 rounded-md px-1 py-2.5 hover:bg-muted/60">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{l.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {l.course} · chapitre {l.chapter_number} · {l.attempts} tentative{l.attempts > 1 ? "s" : ""}
                      </span>
                    </span>
                    <span className={`shrink-0 text-sm font-semibold tabular-nums ${Number(l.pass_rate) < 50 ? "text-danger" : "text-foreground"}`}>{Number(l.pass_rate).toLocaleString("fr-FR")} %</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
