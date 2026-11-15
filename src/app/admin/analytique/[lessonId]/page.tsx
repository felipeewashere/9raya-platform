import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { Bar } from "@/components/admin/analytics";
import { EmptyState, PageHeader } from "@/components/admin/parts";
import { Md } from "@/components/math/md";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getLessonQuestionStats } from "../../_lib/data";

export const metadata = { title: "Détail d'une leçon" };

// (kept here: constants exported from "use client" modules are client references on the server)
const KIND_LABEL: Record<string, string> = {
  mcq: "QCM",
  true_false: "Vrai / Faux",
  fill_blank: "Réponse à compléter",
  matching: "Association",
  ordering: "Remise en ordre",
  steps: "Problème en étapes",
};

export default async function LessonStatsPage({ params }: PageProps<"/admin/analytique/[lessonId]">) {
  const { lessonId } = await params;
  const { lesson, rows } = await getLessonQuestionStats(lessonId);
  const groups = [
    { title: "Quiz de fin de leçon", rows: rows.filter((r) => r.placement === "quiz") },
    { title: "Questions intégrées à la leçon", rows: rows.filter((r) => r.placement === "checkpoint") },
  ].filter((g) => g.rows.length);
  return (
    <>
      <PageHeader
        back={{ href: `/admin/analytique?cours=${lesson.chapter.course.id}`, label: lesson.chapter.course.title }}
        eyebrow={`Chapitre ${lesson.chapter.number} · ${lesson.chapter.title}`}
        title={lesson.title}
        description="Taux de bonnes réponses par question (première réponse de chaque tentative terminée, et réponses aux questions intégrées). En rouge : moins de 50 %."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/lecons/${lesson.id}`}>Éditer la leçon</Link>
          </Button>
        }
      />
      {groups.length === 0 ? (
        <EmptyState icon={HelpCircle} title="Cette leçon n'a pas de questions" />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.title} className="rounded-xl border bg-card p-4 sm:p-5">
              <h2 className="mb-3 font-semibold">{g.title}</h2>
              <ol className="divide-y">
                {g.rows.map((r) => {
                  const weak = r.correct_rate !== null && r.correct_rate < 50;
                  return (
                    <li key={r.id} className={cn("grid gap-3 py-3 md:grid-cols-[minmax(0,1fr)_16rem] md:items-center", weak && "-mx-2 rounded-lg bg-danger-soft/60 px-2")}>
                      <div className="min-w-0 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          {r.key} · {KIND_LABEL[r.kind] ?? r.kind}
                          {weak && <span className="ml-2 font-semibold text-danger">À revoir</span>}
                        </p>
                        <Md className="text-[0.95rem]">{r.data.prompt}</Md>
                      </div>
                      <div className="space-y-1">
                        <Bar value={r.correct_rate} tone={weak ? "danger" : "success"} label={`Bonnes réponses à ${r.key}`} />
                        <p className="text-right text-xs text-muted-foreground">
                          {r.answered} réponse{r.answered > 1 ? "s" : ""}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
