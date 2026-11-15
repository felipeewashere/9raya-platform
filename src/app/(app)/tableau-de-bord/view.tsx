"use client";

import Link from "next/link";
import { CourseCard } from "@/components/course/course-card";
import { useSession } from "@/components/shell/session";
import { PageSkeleton } from "@/components/shell/skeletons";
import { displayName } from "@/lib/auth";
import { getModuleCards, type ModuleClips } from "@/lib/data/modules";
import { useData } from "@/lib/use-data";

export function DashboardView({ clips }: { clips: ModuleClips }) {
  const { profile } = useSession();
  const { data: modules, error } = useData(`modules:${profile.id}`, () => getModuleCards(clips));
  if (error && !modules) throw error;
  if (!modules) return <PageSkeleton />;

  return (
    <div className="space-y-10">
      <header className="page-in space-y-5">
        <div className="label flex flex-wrap justify-between gap-2 border-y border-[var(--rule)] py-2">
          <span>
            {profile.study_year ?? "AP1"} — Section {profile.section} — {profile.group_code}
          </span>
          <span>
            {modules.filter((m) => m.available).length} / {modules.length} modules en ligne
          </span>
        </div>
        <h1 className="font-display text-[clamp(3.6rem,11vw,9rem)] leading-[0.85]">Salut, {displayName(profile)}.</h1>
      </header>

      <section aria-labelledby="cours" className="space-y-4">
        <div className="flex items-baseline justify-between border-b border-[var(--rule)] pb-2">
          <h2 id="cours" className="font-display text-[2.4rem]">
            Cours
          </h2>
          <Link href="/cours" className="sv-link">
            Tout voir →
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((m, i) => (
            <CourseCard key={m.slug} m={m} index={i} />
          ))}
        </div>
      </section>
    </div>
  );
}
