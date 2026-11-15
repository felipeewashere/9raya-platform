import "server-only";
import { cache } from "react";
import { createClient, getUser } from "@/lib/supabase/server";
import { getCourseOutline, type OutlineChapter, type OutlineLesson } from "./courses";
import type { PublicQuestion } from "@/lib/quiz/types";

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
  note: string;
  locked: boolean;
};

export const lessonHref = (course: string, chapter: string, lesson: string) => `/cours/${course}/${chapter}/${lesson}`;

export const getLesson = cache(async (courseSlug: string, chapterSlug: string, lessonSlug: string): Promise<LessonView | null> => {
  const outline = await getCourseOutline(courseSlug);
  if (!outline) return null;
  const chapter = outline.chapters.find((c) => c.slug === chapterSlug);
  if (!chapter) return null;

  // flatten the whole course for prev/next across chapters
  const flat = outline.chapters.flatMap((c) =>
    c.sections.flatMap((s) => s.lessons.map((l) => ({ chapter: c, section: s, lesson: l }))),
  );
  const i = flat.findIndex((x) => x.chapter.slug === chapterSlug && x.lesson.slug === lessonSlug);
  if (i < 0) return null;
  const here = flat[i];

  const supabase = await createClient();
  const user = await getUser();
  const [{ data: blocks, error }, { count }, progress, note] = await Promise.all([
    supabase
      .from("lesson_blocks")
      .select("id, position, type, origin, data, question:questions(id, data)")
      .eq("lesson_id", here.lesson.id)
      .order("position"),
    supabase.from("questions").select("id", { count: "exact", head: true }).eq("lesson_id", here.lesson.id).eq("placement", "quiz"),
    user
      ? supabase.from("lesson_progress").select("last_block").eq("user_id", user.id).eq("lesson_id", here.lesson.id).maybeSingle()
      : Promise.resolve({ data: null }),
    user ? supabase.from("notes").select("body").eq("user_id", user.id).eq("lesson_id", here.lesson.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (error) throw new Error(error.message);

  const prev = flat[i - 1];
  const next = flat[i + 1];
  const chapterLessons = chapter.sections.flatMap((s) => s.lessons);

  return {
    courseSlug,
    courseTitle: outline.course.title,
    chapter,
    lesson: { ...here.lesson, section_title: here.section.title, section_number: here.section.number },
    blocks: (blocks ?? []) as unknown as LessonBlock[],
    quizCount: count ?? 0,
    prev: prev ? { href: lessonHref(courseSlug, prev.chapter.slug, prev.lesson.slug), title: prev.lesson.title } : null,
    next: next
      ? { href: lessonHref(courseSlug, next.chapter.slug, next.lesson.slug), title: next.lesson.title, locked: next.chapter.state === "locked" }
      : null,
    index: chapterLessons.findIndex((l) => l.id === here.lesson.id) + 1,
    chapterLessonCount: chapterLessons.length,
    lastBlock: (progress.data as { last_block?: number } | null)?.last_block ?? 0,
    note: (note.data as { body?: string } | null)?.body ?? "",
    locked: chapter.state === "locked",
  };
});

export async function getQuizQuestions(lessonId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("questions")
    .select("id, kind, data, position")
    .eq("lesson_id", lessonId)
    .eq("placement", "quiz")
    .order("position");
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; kind: string; data: PublicQuestion; position: number }[];
}
