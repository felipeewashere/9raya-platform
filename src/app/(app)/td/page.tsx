import { getTdModuleCards } from "@/lib/data/td";
import { CourseCard } from "@/components/course/course-card";

export const metadata = { title: "TD" };

export default async function TdPage() {
  const modules = await getTdModuleCards();
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
