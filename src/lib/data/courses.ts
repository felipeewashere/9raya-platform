import { createClient, getUser } from "@/lib/supabase/client";
import { chapterStates } from "@/lib/gamification";

export type CourseRow = {
  id: string;
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
  semester_id: string;
};

export type SemesterWithCourses = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  position: number;
  courses: CourseRow[];
};

export type OutlineLesson = {
  id: string;
  slug: string;
  number: string | null;
  title: string;
  summary: string | null;
  estimated_minutes: number;
  position: number;
  status: "not_started" | "in_progress" | "completed";
  /** completed by skipping (checked, no XP) */
  skipped: boolean;
  bookmarked: boolean;
  bestScore: number | null; // percentage of the best finished quiz attempt
};

export type OutlineSection = { id: string; slug: string; number: string | null; title: string; position: number; lessons: OutlineLesson[] };

export type OutlineChapter = {
  id: string;
  slug: string;
  number: number;
  title: string;
  description: string | null;
  video_url: string | null;
  position: number;
  sections: OutlineSection[];
  total: number;
  completed: number;
  state: "completed" | "in_progress" | "available" | "locked";
};

export type CourseOutline = {
  course: CourseRow;
  chapters: OutlineChapter[];
  total: number;
  completed: number;
  /** First lesson to continue with (last opened unfinished lesson, else first unfinished). */
  resume: { chapterSlug: string; lessonSlug: string; title: string } | null;
};

export async function getCatalog(): Promise<SemesterWithCourses[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("semesters")
    .select("id, slug, title, description, position, courses(*)")
    .order("position");
  if (error) throw new Error(error.message);
  return (data ?? []).map((s) => ({
    ...(s as Omit<SemesterWithCourses, "courses">),
    courses: ((s as { courses: CourseRow[] }).courses ?? []).sort((a, b) => a.position - b.position),
  }));
}

export async function getCourseOutline(courseSlug: string): Promise<CourseOutline | null> {
  const supabase = createClient();
  const user = await getUser();
  const { data: course } = await supabase.from("courses").select("*").eq("slug", courseSlug).maybeSingle();
  if (!course) return null;

  const [{ data: chapters, error }, progress, bookmarks, attempts, profile] = await Promise.all([
    supabase
      .from("chapters")
      .select("id, slug, number, title, description, video_url, position, sections(id, slug, number, title, position, lessons(id, slug, number, title, summary, estimated_minutes, position))")
      .eq("course_id", course.id)
      .order("position"),
    user ? supabase.from("lesson_progress").select("lesson_id, status, skipped, updated_at").eq("user_id", user.id) : Promise.resolve({ data: [] }),
    user ? supabase.from("bookmarks").select("lesson_id").eq("user_id", user.id) : Promise.resolve({ data: [] }),
    user ? supabase.from("quiz_attempts").select("lesson_id, score, total").eq("user_id", user.id).eq("status", "finished") : Promise.resolve({ data: [] }),
    user ? supabase.from("profiles").select("role").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (error) throw new Error(error.message);

  const statusOf = new Map<string, { status: string; skipped: boolean; updated_at: string }>();
  for (const p of (progress.data ?? []) as { lesson_id: string; status: string; skipped: boolean; updated_at: string }[]) statusOf.set(p.lesson_id, p);
  const bookmarked = new Set(((bookmarks.data ?? []) as { lesson_id: string }[]).map((b) => b.lesson_id));
  const best = new Map<string, number>();
  for (const a of (attempts.data ?? []) as { lesson_id: string; score: number; total: number }[]) {
    const pct = Math.round((100 * a.score) / a.total);
    best.set(a.lesson_id, Math.max(best.get(a.lesson_id) ?? 0, pct));
  }

  type RawLesson = Omit<OutlineLesson, "status" | "skipped" | "bookmarked" | "bestScore">;
  type RawSection = Omit<OutlineSection, "lessons"> & { lessons: RawLesson[] };
  type RawChapter = Omit<OutlineChapter, "sections" | "total" | "completed" | "state"> & { sections: RawSection[] };

  const built = ((chapters ?? []) as RawChapter[]).map((c) => {
    const sections = [...c.sections]
      .sort((a, b) => a.position - b.position)
      .map((s) => ({
        ...s,
        lessons: [...s.lessons]
          .sort((a, b) => a.position - b.position)
          .map((l) => ({
            ...l,
            status: ((statusOf.get(l.id)?.status as OutlineLesson["status"]) ?? "not_started") as OutlineLesson["status"],
            skipped: Boolean(statusOf.get(l.id)?.skipped),
            bookmarked: bookmarked.has(l.id),
            bestScore: best.get(l.id) ?? null,
          })),
      }));
    const lessons = sections.flatMap((s) => s.lessons);
    return { ...c, sections, total: lessons.length, completed: lessons.filter((l) => l.status === "completed").length };
  });

  const isAdmin = (profile.data as { role?: string } | null)?.role === "admin";
  const states = chapterStates(built, (course as CourseRow).sequential, isAdmin);
  const outline: OutlineChapter[] = built.map((c, i) => ({ ...c, state: states[i] }));

  // resume: most recently touched unfinished lesson in an unlocked chapter, else first unfinished
  let resume: CourseOutline["resume"] = null;
  let latest = "";
  for (const c of outline) {
    if (c.state === "locked") continue;
    for (const l of c.sections.flatMap((s) => s.lessons)) {
      const p = statusOf.get(l.id);
      if (p && p.status !== "completed" && p.updated_at > latest) {
        latest = p.updated_at;
        resume = { chapterSlug: c.slug, lessonSlug: l.slug, title: l.title };
      }
    }
  }
  if (!resume)
    for (const c of outline) {
      if (c.state === "locked") continue;
      const l = c.sections.flatMap((s) => s.lessons).find((x) => x.status !== "completed");
      if (l) {
        resume = { chapterSlug: c.slug, lessonSlug: l.slug, title: l.title };
        break;
      }
    }

  return {
    course: course as CourseRow,
    chapters: outline,
    total: outline.reduce((n, c) => n + c.total, 0),
    completed: outline.reduce((n, c) => n + c.completed, 0),
    resume,
  };
}
