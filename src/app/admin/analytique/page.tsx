import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { CourseStats } from "@/components/admin/analytics";
import { EmptyState, PageHeader } from "@/components/admin/parts";
import { cn } from "@/lib/utils";
import { getCourseStats } from "../_lib/data";

export const metadata = { title: "Analytique" };

export default async function AnalyticsPage({ searchParams }: PageProps<"/admin/analytique">) {
  const sp = await searchParams;
  const requested = typeof sp.cours === "string" ? sp.cours : undefined;
  const { courses, course, stats } = await getCourseStats(requested);
  return (
    <>
      <PageHeader title="Analytique" description="Seules les tentatives de quiz terminées sont comptées. Clique une leçon pour le détail par question." />
      {courses.length > 0 && (
        <nav aria-label="Cours" className="mb-6 flex flex-wrap gap-1.5">
          {courses.map((c) => (
            <Link
              key={c.id}
              href={`/admin/analytique?cours=${c.id}`}
              aria-current={c.id === course?.id ? "page" : undefined}
              className={cn("rounded-full border px-3 py-1 text-sm font-medium", c.id === course?.id ? "border-primary bg-brand-soft text-primary" : "hover:bg-muted")}
            >
              {c.title}
            </Link>
          ))}
        </nav>
      )}
      {!course ? (
        <EmptyState icon={BarChart3} title="Aucun cours" />
      ) : stats.length === 0 ? (
        <EmptyState icon={BarChart3} title="Pas encore de leçons dans ce cours" />
      ) : (
        <CourseStats stats={stats} />
      )}
    </>
  );
}
