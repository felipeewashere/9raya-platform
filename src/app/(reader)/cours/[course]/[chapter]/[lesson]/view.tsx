"use client";

import Link from "next/link";
import { NoteLabel } from "@/components/notes";
import { LessonReader } from "@/components/lesson/reader";
import { useSession } from "@/components/shell/session";
import { LessonSkeleton } from "@/components/shell/skeletons";
import { Button } from "@/components/ui/button";
import NotFound from "@/app/not-found";
import type { StaticLesson } from "@/lib/content/static";
import { getLesson } from "@/lib/data/lesson";
import { useData } from "@/lib/use-data";

export function LessonPageView({ course, chapter, lesson, content }: { course: string; chapter: string; lesson: string; content: StaticLesson }) {
  const { profile } = useSession();
  const { data, error, loading } = useData(`lesson:${profile.id}:${course}/${chapter}/${lesson}`, () => getLesson(course, chapter, lesson, content));
  if (error && !data) throw error;
  if (loading && !data) return <LessonSkeleton />;
  if (!data) return <NotFound />;
  const { view, chapters } = data;

  if (view.locked)
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-[1.8rem] font-bold text-primary smallcaps">Chapitre {view.chapter.number} verrouillé</h1>
          <p>
            <NoteLabel tone="red">Remarque :</NoteLabel> termine au moins la moitié des leçons du chapitre précédent pour débloquer « {view.chapter.title} ».</p>
          <Button asChild>
            <Link href={`/cours/${course}`}>Retour au parcours</Link>
          </Button>
        </div>
      </div>
    );

  return <LessonReader key={view.lesson.id} view={view} chapters={chapters} />;
}
