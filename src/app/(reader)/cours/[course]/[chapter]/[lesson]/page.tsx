import Link from "next/link";
import { notFound } from "next/navigation";
import { NoteLabel } from "@/components/notes";
import { getLesson } from "@/lib/data/lesson";
import { getCourseOutline } from "@/lib/data/courses";
import { LessonReader } from "@/components/lesson/reader";
import { Button } from "@/components/ui/button";

type Props = PageProps<"/cours/[course]/[chapter]/[lesson]">;

export async function generateMetadata({ params }: Props) {
  const { course, chapter, lesson } = await params;
  const v = await getLesson(course, chapter, lesson);
  return { title: v ? `${v.lesson.title} — ${v.courseTitle}` : "Leçon" };
}

export default async function LessonPage({ params }: Props) {
  const { course, chapter, lesson } = await params;
  const [view, outline] = await Promise.all([getLesson(course, chapter, lesson), getCourseOutline(course)]);
  if (!view || !outline) notFound();

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

  return <LessonReader view={view} chapters={outline.chapters} />;
}
