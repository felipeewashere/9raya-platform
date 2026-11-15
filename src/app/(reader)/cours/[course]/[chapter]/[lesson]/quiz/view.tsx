"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { QuizRunner } from "@/components/quiz/quiz-runner";
import { useSession } from "@/components/shell/session";
import { LessonSkeleton } from "@/components/shell/skeletons";
import NotFound from "@/app/not-found";
import type { StaticLesson } from "@/lib/content/static";
import { getLesson, lessonHref } from "@/lib/data/lesson";
import { useData } from "@/lib/use-data";

export function QuizPageView({ course, chapter, lesson, content }: { course: string; chapter: string; lesson: string; content: StaticLesson }) {
  const router = useRouter();
  const { profile } = useSession();
  // loaded once: the runner keeps its own state while the quiz is played (no reload on refreshData)
  const { data, error, loading } = useData(`quiz:${profile.id}:${course}/${chapter}/${lesson}`, () => getLesson(course, chapter, lesson, content));
  const locked = data?.view.locked;
  useEffect(() => {
    if (locked) router.replace(`/cours/${course}`);
  }, [locked, course, router]);

  if (error && !data) throw error;
  if (loading && !data) return <LessonSkeleton />;
  if (!data) return <NotFound />;
  if (data.view.locked) return <LessonSkeleton />;
  const { view, quiz } = data;
  return (
    <QuizRunner
      lessonId={view.lesson.id}
      lessonTitle={view.lesson.title}
      questions={quiz}
      backHref={lessonHref(course, chapter, lesson)}
      nextHref={view.next && !view.next.locked ? view.next.href : null}
      courseHref={`/cours/${course}`}
      alreadyCompleted={view.lesson.status === "completed" && !view.lesson.skipped}
    />
  );
}
