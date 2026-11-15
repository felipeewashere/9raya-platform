"use client";

import { CourseCard } from "@/components/course/course-card";
import { useSession } from "@/components/shell/session";
import { PageSkeleton } from "@/components/shell/skeletons";
import { getModuleCards, type ModuleClips } from "@/lib/data/modules";
import { useData } from "@/lib/use-data";

export function CatalogView({ clips }: { clips: ModuleClips }) {
  const { profile } = useSession();
  const { data: modules, error } = useData(`modules:${profile.id}`, () => getModuleCards(clips));
  if (error && !modules) throw error;
  if (!modules) return <PageSkeleton />;
  return (
    <div className="space-y-8">
      <header className="page-in space-y-4">
        <p className="label border-y border-[var(--rule)] py-2">AP1 — Semestre 1 — {modules.length} modules</p>
        <h1 className="font-display text-[clamp(3.6rem,11vw,9rem)] leading-[0.85]">Cours</h1>
      </header>
      {modules.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((m, i) => (
            <CourseCard key={m.slug} m={m} index={i} />
          ))}
        </div>
      ) : (
        <p className="py-16 text-center text-muted-foreground">Les modules arrivent bientôt.</p>
      )}
    </div>
  );
}
