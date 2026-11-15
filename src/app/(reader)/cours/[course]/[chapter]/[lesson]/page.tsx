import { notFound } from "next/navigation";
import { courseTitle, getStaticLesson, lessonParams } from "@/lib/content/static";
import { LessonPageView } from "./view";

type Props = PageProps<"/cours/[course]/[chapter]/[lesson]">;

export function generateStaticParams() {
  return lessonParams();
}

export async function generateMetadata({ params }: Props) {
  const { course, chapter, lesson } = await params;
  const l = getStaticLesson(course, chapter, lesson);
  const c = await courseTitle(course);
  return { title: l ? `${l.title}${c ? ` — ${c}` : ""}` : "Leçon" };
}

/** Lesson content is embedded at build time (public part only); the student's data is loaded in the browser. */
export default async function LessonPage({ params }: Props) {
  const { course, chapter, lesson } = await params;
  const content = getStaticLesson(course, chapter, lesson);
  if (!content) notFound();
  return <LessonPageView course={course} chapter={chapter} lesson={lesson} content={content} />;
}
