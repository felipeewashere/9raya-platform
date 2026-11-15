import { createClient, getUser } from "@/lib/supabase/client";
import { getCourseOutline, type OutlineChapter, type OutlineLesson } from "./courses";
import type { PublicQuestion } from "@/lib/quiz/types";
import type { StaticLesson } from "@/lib/content/static";

export type LessonBlock = {
  id: string;
  position: number;
  type: string;
  origin: "source" | "added";
  data: Record<string, unknown>;
  question?: { id: string; data: PublicQuestion } | null;
};

export type LessonView = {
  courseSlug: string;
  courseTitle: string;
  chapter: OutlineChapter;
  lesson: OutlineLesson & { section_title: string; section_number: string | null };
  blocks: LessonBlock[];
  quizCount: number;
  prev: { href: string; title: string } | null;
  next: { href: string; title: string; locked: boolean } | null;
  index: number;
  chapterLessonCount: number;
  lastBlock: number;
  locked: boolean;
};

export type QuizQuestion = { id: string; kind: string; data: PublicQuestion; position: number };

export const lessonHref = (course: string, chapter: string, lesson: string) => `/cours/${course}/${chapter}/${lesson}`;

/**
 * Combines the lesson content embedded at build time with the student's data: the course
 * outline (ids, progress, locks), the reading position, and the database ids of the questions
 * (matched by their stable keys quiz-N / cp-N) needed to grade them.
 */
export async function getLesson(
  courseSlug: string,
  chapterSlug: string,
  lessonSlug: string,
  content: StaticLesson,
): Promise<{ view: LessonView; chapters: OutlineChapter[]; quiz: QuizQuestion[] } | null> {
  const outline = await getCourseOutline(courseSlug);
  if (!outline) return null;
  const chapter = outline.chapters.find((c) => c.slug === chapterSlug);
  if (!chapter) return null;

  // flatten the whole course for prev/next across chapters
  const flat = outline.chapters.flatMap((c) => c.sections.flatMap((s) => s.lessons.map((l) => ({ chapter: c, section: s, lesson: l }))));
  const i = flat.findIndex((x) => x.chapter.slug === chapterSlug && x.lesson.slug === lessonSlug);
  if (i < 0) return null;
  const here = flat[i];

  const supabase = createClient();
  const user = await getUser();
  const [{ data: questions, error }, progress] = await Promise.all([
    supabase.from("questions").select("id, key").eq("lesson_id", here.lesson.id),
    user
      ? supabase.from("lesson_progress").select("last_block").eq("user_id", user.id).eq("lesson_id", here.lesson.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (error) throw new Error(error.message);
  const idByKey = new Map(((questions ?? []) as { id: string; key: string }[]).map((q) => [q.key, q.id]));

  const prev = flat[i - 1];
  const next = flat[i + 1];
  const chapterLessons = chapter.sections.flatMap((s) => s.lessons);

  const blocks: LessonBlock[] = content.blocks.map((b) => {
    const id = b.question ? idByKey.get(b.question.key) : undefined;
    return {
      id: String(b.position),
      position: b.position,
      type: b.type,
      origin: b.origin,
      data: b.data,
      question: b.question && id ? { id, data: b.question.data } : null,
    };
  });
  const quiz = content.quiz
    .filter((q) => idByKey.has(q.key))
    .map((q) => ({ id: idByKey.get(q.key)!, kind: q.kind, data: q.data, position: q.position }));

  return {
    chapters: outline.chapters,
    quiz,
    view: {
      courseSlug,
      courseTitle: outline.course.title,
      chapter,
      lesson: { ...here.lesson, section_title: here.section.title, section_number: here.section.number },
      blocks,
      quizCount: quiz.length,
      prev: prev ? { href: lessonHref(courseSlug, prev.chapter.slug, prev.lesson.slug), title: prev.lesson.title } : null,
      next: next
        ? { href: lessonHref(courseSlug, next.chapter.slug, next.lesson.slug), title: next.lesson.title, locked: next.chapter.state === "locked" }
        : null,
      index: chapterLessons.findIndex((l) => l.id === here.lesson.id) + 1,
      chapterLessonCount: chapterLessons.length,
      lastBlock: (progress.data as { last_block?: number } | null)?.last_block ?? 0,
      locked: chapter.state === "locked",
    },
  };
}
