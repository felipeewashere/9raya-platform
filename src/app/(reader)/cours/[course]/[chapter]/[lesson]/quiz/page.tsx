import { notFound } from "next/navigation";
import { getStaticLesson, lessonParams } from "@/lib/content/static";
import { QuizPageView } from "./view";

type Props = PageProps<"/cours/[course]/[chapter]/[lesson]/quiz">;

export function generateStaticParams() {
  return lessonParams();
}

export async function generateMetadata({ params }: Props) {
  const { course, chapter, lesson } = await params;
  const l = getStaticLesson(course, chapter, lesson);
  return { title: l ? `Quiz — ${l.title}` : "Quiz" };
}

export default async function QuizPage({ params }: Props) {
  const { course, chapter, lesson } = await params;
  const content = getStaticLesson(course, chapter, lesson);
  if (!content) notFound();
  // the quiz page needs only the quiz questions (public data)
  return <QuizPageView course={course} chapter={chapter} lesson={lesson} content={{ ...content, blocks: [] }} />;
}
