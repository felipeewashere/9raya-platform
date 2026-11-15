import "server-only";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { lessonFromRows, type StoredLessonRows } from "@/lib/content/import";
import type { PublicQuestion } from "@/lib/quiz/types";

/**
 * Data for admin pages. Every loader re-checks the admin role itself (layouts and pages render
 * in parallel, so the layout check alone does not protect a page's data). Content is read with
 * the service role so drafts are included; analytics RPCs run as the signed-in admin because
 * they verify `is_admin()` from the JWT.
 */

async function admin() {
  await requireAdmin();
  return createAdminClient();
}

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? ([] as unknown)) as T;
}

// ------------------------------------------------------------------ types

export type AdminSemester = { id: string; slug: string; title: string; description: string | null; position: number; published: boolean };
export type AdminCourse = {
  id: string;
  semester_id: string;
  slug: string;
  title: string;
  short_title: string | null;
  description: string | null;
  cover_url: string | null;
  video_url: string | null;
  color: string;
  status: "draft" | "published" | "coming_soon";
  sequential: boolean;
  position: number;
};
export type AdminLessonRow = { id: string; section_id: string; slug: string; number: string | null; title: string; summary: string | null; estimated_minutes: number; position: number; published: boolean };
export type AdminSection = { id: string; chapter_id: string; slug: string; number: string | null; title: string; position: number; lessons: AdminLessonRow[] };
export type AdminChapter = {
  id: string;
  course_id: string;
  slug: string;
  number: number;
  title: string;
  description: string | null;
  video_url: string | null;
  position: number;
  published: boolean;
  review_notes: string[];
};

// ------------------------------------------------------------------ overview

export async function getOverview() {
  const db = await admin();
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const [students, lessons, questions, attempts, signups, courses] = await Promise.all([
    db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student"),
    db.from("lessons").select("id", { count: "exact", head: true }),
    db.from("questions").select("id", { count: "exact", head: true }),
    db.from("quiz_attempts").select("id", { count: "exact", head: true }).eq("status", "finished").gte("finished_at", since),
    db.from("profiles").select("id, username, full_name, avatar_url, created_at, role").order("created_at", { ascending: false }).limit(8),
    db.from("courses").select("id, title, slug").order("position"),
  ]);
  const supabase = await createClient();
  const stats = await Promise.all(
    ((courses.data ?? []) as { id: string; title: string; slug: string }[]).map(async (c) => {
      const { data } = await supabase.rpc("admin_lesson_stats", { p_course: c.id });
      return ((data ?? []) as LessonStat[]).map((s) => ({ ...s, course: c.title, course_id: c.id }));
    }),
  );
  const weakest = stats
    .flat()
    .filter((s) => s.attempts > 0 && s.pass_rate !== null)
    .sort((a, b) => Number(a.pass_rate) - Number(b.pass_rate) || b.attempts - a.attempts)
    .slice(0, 6);
  return {
    counts: { students: students.count ?? 0, lessons: lessons.count ?? 0, questions: questions.count ?? 0, attempts7d: attempts.count ?? 0 },
    signups: (signups.data ?? []) as { id: string; username: string | null; full_name: string | null; avatar_url: string | null; created_at: string; role: string }[],
    weakest,
  };
}

// ------------------------------------------------------------------ content tree

export async function getCatalogAdmin() {
  const db = await admin();
  const [semesters, courses, chapters] = await Promise.all([
    db.from("semesters").select("*").order("position"),
    db.from("courses").select("*").order("position"),
    db.from("chapters").select("course_id, published"),
  ]);
  const chapterCount = new Map<string, { total: number; published: number }>();
  for (const c of check(chapters) as { course_id: string; published: boolean }[]) {
    const n = chapterCount.get(c.course_id) ?? { total: 0, published: 0 };
    n.total++;
    if (c.published) n.published++;
    chapterCount.set(c.course_id, n);
  }
  return {
    semesters: check(semesters) as AdminSemester[],
    courses: (check(courses) as AdminCourse[]).map((c) => ({ ...c, chapters: chapterCount.get(c.id) ?? { total: 0, published: 0 } })),
  };
}

export async function getCourseAdmin(courseId: string) {
  const db = await admin();
  const { data: course } = await db.from("courses").select("*").eq("id", courseId).maybeSingle();
  if (!course) notFound();
  const [semesters, chapters] = await Promise.all([
    db.from("semesters").select("id, title").order("position"),
    db.from("chapters").select("*, sections(id, lessons(id, published))").eq("course_id", courseId).order("position"),
  ]);
  type Raw = AdminChapter & { sections: { id: string; lessons: { id: string; published: boolean }[] }[] };
  return {
    course: course as AdminCourse,
    semesters: check(semesters) as { id: string; title: string }[],
    chapters: (check(chapters) as Raw[]).map(({ sections, ...c }) => {
      const ls = sections.flatMap((s) => s.lessons);
      return { ...c, sectionCount: sections.length, lessonCount: ls.length, publishedLessons: ls.filter((l) => l.published).length };
    }),
  };
}

export async function getChapterAdmin(chapterId: string) {
  const db = await admin();
  const { data: chapter } = await db.from("chapters").select("*, course:courses(id, slug, title)").eq("id", chapterId).maybeSingle();
  if (!chapter) notFound();
  const sections = check(
    await db
      .from("sections")
      .select("id, chapter_id, slug, number, title, position, lessons(id, section_id, slug, number, title, summary, estimated_minutes, position, published)")
      .eq("chapter_id", chapterId)
      .order("position"),
  ) as AdminSection[];
  for (const s of sections) s.lessons.sort((a, b) => a.position - b.position);
  return { chapter: chapter as AdminChapter & { course: { id: string; slug: string; title: string } }, sections };
}

// ------------------------------------------------------------------ lesson editor

export async function getLessonForEditor(lessonId: string) {
  const db = await admin();
  const { data: row } = await db
    .from("lessons")
    .select("id, slug, title, number, summary, estimated_minutes, published, section_id, chapter:chapters(id, slug, title, number, course:courses(id, slug, title))")
    .eq("id", lessonId)
    .maybeSingle();
  if (!row) notFound();
  const [blocks, questions] = await Promise.all([
    db.from("lesson_blocks").select("position, type, data, origin, question_id").eq("lesson_id", lessonId).order("position"),
    db.from("questions").select("id, key, placement, position, kind, data, answer:question_answers(answer, explanation)").eq("lesson_id", lessonId),
  ]);
  const r = row as unknown as {
    id: string;
    slug: string;
    title: string;
    number: string | null;
    summary: string | null;
    estimated_minutes: number;
    published: boolean;
    section_id: string;
    chapter: { id: string; slug: string; title: string; number: number; course: { id: string; slug: string; title: string } };
  };
  const qs = (check(questions) as (Omit<StoredLessonRows["questions"][number], "answer"> & { answer: unknown })[]).map((q) => ({
    ...q,
    // the embedded one-to-one relation may come back as an object or a one-element array
    answer: (Array.isArray(q.answer) ? (q.answer[0] ?? null) : q.answer) as StoredLessonRows["questions"][number]["answer"],
  }));
  const { lesson, warnings } = lessonFromRows({ lesson: r, blocks: check(blocks) as StoredLessonRows["blocks"], questions: qs });
  return { meta: r, lesson, warnings };
}

// ------------------------------------------------------------------ imports

export type ImportListRow = { id: string; file_name: string; status: string; error: string | null; created_at: string; updated_at: string; course: { title: string } | null; storage_path: string };

export async function getImports() {
  const db = await admin();
  const [rows, courses] = await Promise.all([
    db.from("content_imports").select("id, file_name, status, error, created_at, updated_at, storage_path, course:courses(title)").order("created_at", { ascending: false }),
    db.from("courses").select("id, title, slug").order("position"),
  ]);
  return { imports: check(rows) as unknown as ImportListRow[], courses: check(courses) as { id: string; title: string; slug: string }[] };
}

export async function getImport(importId: string) {
  const db = await admin();
  const { data } = await db.from("content_imports").select("*").eq("id", importId).maybeSingle();
  if (!data) notFound();
  const row = data as { id: string; course_id: string | null; storage_path: string; file_name: string; extracted_text: string | null; draft: unknown; status: string; error: string | null; updated_at: string };
  const courses = check(await db.from("courses").select("id, title, slug").order("position")) as { id: string; title: string; slug: string }[];
  let pdfUrl: string | null = null;
  if (row.storage_path.startsWith("pdf/")) {
    const { data: signed } = await db.storage.from("imports").createSignedUrl(row.storage_path, 3600);
    pdfUrl = signed?.signedUrl ?? null;
  }
  const { extracted_text, ...rest } = row;
  return { row: rest, pages: extracted_text ? extracted_text.split("\f") : [], courses, pdfUrl };
}

// ------------------------------------------------------------------ resources

export type ResourceRow = { id: string; course_id: string; chapter_id: string | null; lesson_id: string | null; title: string; storage_path: string; mime_type: string | null; size_bytes: number | null; created_at: string };
export type CourseTree = { id: string; title: string; slug: string; chapters: { id: string; number: number; title: string; lessons: { id: string; title: string; number: string | null }[] }[] };

export async function getResources() {
  const db = await admin();
  const [res, courses] = await Promise.all([
    db.from("resources").select("*").order("created_at", { ascending: false }),
    db.from("courses").select("id, title, slug, position, chapters(id, number, title, position, lessons(id, title, number, position))").order("position"),
  ]);
  type RawCourse = Omit<CourseTree, "chapters"> & { chapters: (CourseTree["chapters"][number] & { position: number; lessons: (CourseTree["chapters"][number]["lessons"][number] & { position: number })[] })[] };
  const tree: CourseTree[] = (check(courses) as RawCourse[]).map((c) => ({
    id: c.id,
    title: c.title,
    slug: c.slug,
    chapters: [...c.chapters]
      .sort((a, b) => a.position - b.position)
      .map((ch) => ({ id: ch.id, number: ch.number, title: ch.title, lessons: [...ch.lessons].sort((a, b) => a.position - b.position).map(({ id, title, number }) => ({ id, title, number })) })),
  }));
  return { resources: check(res) as ResourceRow[], courses: tree };
}

// ------------------------------------------------------------------ students

export type StudentRow = { id: string; username: string | null; full_name: string | null; avatar_url: string | null; created_at: string; total_xp: number; lessons_completed: number; last_active: string | null };

export async function getStudents() {
  const db = await admin();
  const supabase = await createClient();
  const [{ data, error }, roles] = await Promise.all([supabase.rpc("admin_students"), db.from("profiles").select("id, role")]);
  if (error) throw new Error(error.message);
  const roleOf = new Map(((roles.data ?? []) as { id: string; role: string }[]).map((r) => [r.id, r.role]));
  return ((data ?? []) as StudentRow[]).map((s) => ({ ...s, role: (roleOf.get(s.id) ?? "student") as "student" | "admin" }));
}

export async function getStudent(userId: string) {
  const db = await admin();
  const { data: profile } = await db.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (!profile) notFound();
  const [streak, xp, progress, attempts, auth] = await Promise.all([
    db.rpc("get_streak", { p_user: userId }),
    db.from("xp_events").select("amount").eq("user_id", userId),
    db.from("lesson_progress").select("lesson_id, status, completed_at, updated_at").eq("user_id", userId),
    db
      .from("quiz_attempts")
      .select("id, score, total, passed, xp_awarded, finished_at, created_at, lesson:lessons(title, chapter:chapters(number, course:courses(title)))")
      .eq("user_id", userId)
      .eq("status", "finished")
      .order("finished_at", { ascending: false })
      .limit(20),
    db.auth.admin.getUserById(userId).catch(() => ({ data: { user: null } })),
  ]);
  const done = new Set(((progress.data ?? []) as { lesson_id: string; status: string }[]).filter((p) => p.status === "completed").map((p) => p.lesson_id));
  const started = new Set(((progress.data ?? []) as { lesson_id: string }[]).map((p) => p.lesson_id));
  // completion per chapter, for every course where the student did something
  const { data: chapters } = await db
    .from("chapters")
    .select("id, number, title, position, course:courses(id, title, position), lessons(id, published)")
    .order("position");
  type RawCh = { id: string; number: number; title: string; position: number; course: { id: string; title: string; position: number }; lessons: { id: string; published: boolean }[] };
  const perChapter = ((chapters ?? []) as unknown as RawCh[])
    .map((c) => ({
      id: c.id,
      number: c.number,
      title: c.title,
      course: c.course.title,
      coursePos: c.course.position,
      position: c.position,
      total: c.lessons.filter((l) => l.published).length,
      completed: c.lessons.filter((l) => done.has(l.id)).length,
      touched: c.lessons.some((l) => started.has(l.id)),
    }))
    .filter((c) => c.touched)
    .sort((a, b) => a.coursePos - b.coursePos || a.position - b.position);
  const s = (Array.isArray(streak.data) ? streak.data[0] : streak.data) as { current_streak: number; longest_streak: number; active_today: boolean } | null;
  return {
    profile: profile as { id: string; username: string | null; full_name: string | null; avatar_url: string | null; role: "student" | "admin"; created_at: string; timezone: string; daily_goal_xp: number },
    email: (auth.data?.user?.email as string | undefined) ?? null,
    streak: s ?? { current_streak: 0, longest_streak: 0, active_today: false },
    xp: ((xp.data ?? []) as { amount: number }[]).reduce((n, r) => n + r.amount, 0),
    completedLessons: done.size,
    perChapter,
    attempts: (attempts.data ?? []) as unknown as {
      id: string;
      score: number;
      total: number;
      passed: boolean;
      xp_awarded: number;
      finished_at: string | null;
      lesson: { title: string; chapter: { number: number; course: { title: string } } } | null;
    }[],
  };
}

// ------------------------------------------------------------------ analytics

export type LessonStat = { lesson_id: string; title: string; chapter_number: number; started: number; completed: number; attempts: number; avg_score: number | null; pass_rate: number | null };

export async function getCourseStats(courseId: string | undefined) {
  const db = await admin();
  const courses = check(await db.from("courses").select("id, title, slug").order("position")) as { id: string; title: string; slug: string }[];
  const course = courses.find((c) => c.id === courseId) ?? courses[0] ?? null;
  if (!course) return { courses, course: null, stats: [] as LessonStat[] };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_lesson_stats", { p_course: course.id });
  if (error) throw new Error(error.message);
  const stats = ((data ?? []) as LessonStat[]).map((s) => ({ ...s, avg_score: s.avg_score === null ? null : Number(s.avg_score), pass_rate: s.pass_rate === null ? null : Number(s.pass_rate) }));
  return { courses, course, stats };
}

export async function getLessonQuestionStats(lessonId: string) {
  const db = await admin();
  const { data: lesson } = await db.from("lessons").select("id, title, number, chapter:chapters(number, title, course:courses(id, title))").eq("id", lessonId).maybeSingle();
  if (!lesson) notFound();
  const supabase = await createClient();
  const [stats, questions] = await Promise.all([
    supabase.rpc("admin_question_stats", { p_lesson: lessonId }),
    db.from("questions").select("id, key, placement, position, kind, data").eq("lesson_id", lessonId),
  ]);
  if (stats.error) throw new Error(stats.error.message);
  const byId = new Map(((questions.data ?? []) as { id: string; key: string; placement: "quiz" | "checkpoint"; position: number; kind: string; data: PublicQuestion }[]).map((q) => [q.id, q]));
  const rows = ((stats.data ?? []) as { question_id: string; answered: number; correct_rate: number | null }[])
    .map((s) => {
      const q = byId.get(s.question_id);
      return q ? { ...q, answered: s.answered, correct_rate: s.correct_rate === null ? null : Number(s.correct_rate) } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  return {
    lesson: lesson as unknown as { id: string; title: string; number: string | null; chapter: { number: number; title: string; course: { id: string; title: string } } },
    rows,
  };
}
