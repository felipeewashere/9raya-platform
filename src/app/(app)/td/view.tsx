"use client";

import { CourseCard } from "@/components/course/course-card";
import { useSession } from "@/components/shell/session";
import { PageSkeleton } from "@/components/shell/skeletons";
import { getTdModuleCards, type TdIndex } from "@/lib/data/td";
import { useData } from "@/lib/use-data";

export function TdView({ index }: { index: TdIndex }) {
  const { profile } = useSession();
  const { data: modules, error } = useData(`td:${profile.id}`, () => getTdModuleCards(index));
  if (error && !modules) throw error;
  if (!modules) return <PageSkeleton />;
  return (
    <div className="space-y-8">
      <header className="page-in space-y-4">
        <p className="label border-y border-[var(--rule)] py-2">AP1 — Travaux dirigés — par chapitre</p>
        <h1 className="font-display text-[clamp(3.6rem,11vw,9rem)] leading-[0.85]">TD</h1>
      </header>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {modules.map((m, i) => (
          <CourseCard key={m.slug} m={m} index={i} unit="exercices" progress={false} />
        ))}
      </div>
    </div>
  );
}
