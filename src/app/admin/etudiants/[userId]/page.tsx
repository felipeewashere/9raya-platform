import { Flame, GraduationCap, History, Star, Trophy } from "lucide-react";
import { EmptyState, formatDate, PageHeader, Panel, StatCard, StatusBadge } from "@/components/admin/parts";
import { RoleToggle } from "@/components/admin/students";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth";
import { getStudent } from "../../_lib/data";

export const metadata = { title: "Étudiant" };

export default async function StudentPage({ params }: PageProps<"/admin/etudiants/[userId]">) {
  const { userId } = await params;
  const me = await requireAdmin();
  const s = await getStudent(userId);
  const p = s.profile;
  return (
    <>
      <PageHeader
        back={{ href: "/admin/etudiants", label: "Étudiants" }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {p.full_name || p.username || "Sans nom"} <StatusBadge status={p.role} />
          </span>
        }
        description={[p.username && `@${p.username}`, s.email, `inscrit le ${formatDate(p.created_at)}`, p.timezone].filter(Boolean).join(" · ")}
        actions={<RoleToggle userId={p.id} role={p.role} isSelf={p.id === me.id} />}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="XP total" value={s.xp.toLocaleString("fr-FR")} icon={Star} hint={`objectif ${p.daily_goal_xp} XP / jour`} />
        <StatCard label="Série actuelle" value={`${s.streak.current_streak} j`} icon={Flame} hint={s.streak.active_today ? "actif aujourd'hui" : "pas encore actif aujourd'hui"} />
        <StatCard label="Meilleure série" value={`${s.streak.longest_streak} j`} icon={Trophy} />
        <StatCard label="Leçons terminées" value={s.completedLessons} icon={GraduationCap} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Progression par chapitre">
          {s.perChapter.length === 0 ? (
            <EmptyState icon={GraduationCap} title="Aucune leçon commencée" />
          ) : (
            <ul className="space-y-3">
              {s.perChapter.map((c) => {
                const pct = c.total ? Math.round((100 * c.completed) / c.total) : 0;
                return (
                  <li key={c.id}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate">
                        <span className="text-muted-foreground">{c.course} · </span>
                        {c.number}. {c.title}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {c.completed}/{c.total}
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Chapitre ${c.number}`}>
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Derniers quiz terminés">
          {s.attempts.length === 0 ? (
            <EmptyState icon={History} title="Aucun quiz terminé" />
          ) : (
            <div className="-mx-4 overflow-x-auto sm:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Leçon</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {s.attempts.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="max-w-[14rem]">
                        <span className="block truncate">{a.lesson?.title ?? "Leçon supprimée"}</span>
                        {a.lesson && <span className="block truncate text-xs text-muted-foreground">{a.lesson.chapter.course.title} · chap. {a.lesson.chapter.number}</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={a.passed ? "font-semibold text-success" : "font-semibold text-danger"}>
                          {a.score}/{a.total}
                        </span>
                        {a.xp_awarded > 0 && <span className="block text-xs text-muted-foreground">+{a.xp_awarded} XP</span>}
                      </TableCell>
                      <TableCell className="hidden text-right text-muted-foreground sm:table-cell">{formatDate(a.finished_at, true)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
