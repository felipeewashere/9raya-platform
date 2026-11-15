import { notFound, redirect } from "next/navigation";
import { getLesson, getQuizQuestions, lessonHref } from "@/lib/data/lesson";
import { QuizRunner } from "@/components/quiz/quiz-runner";

type Props = PageProps<"/cours/[course]/[chapter]/[lesson]/quiz">;

export async function generateMetadata({ params }: Props) {
  const { course, chapter, lesson } = await params;
  const v = await getLesson(course, chapter, lesson);
  return { title: v ? `Quiz — ${v.lesson.title}` : "Quiz" };
}

export default async function QuizPage({ params }: Props) {
  const { course, chapter, lesson } = await params;
  const view = await getLesson(course, chapter, lesson);
  if (!view) notFound();
  if (view.locked) redirect(`/cours/${course}`);
  const questions = await getQuizQuestions(view.lesson.id);
  return (
    <QuizRunner
      lessonId={view.lesson.id}
      lessonTitle={view.lesson.title}
      questions={questions}
      backHref={lessonHref(course, chapter, lesson)}
      nextHref={view.next && !view.next.locked ? view.next.href : null}
      courseHref={`/cours/${course}`}
      alreadyCompleted={view.lesson.status === "completed" && !view.lesson.skipped}
    />
  );
}
