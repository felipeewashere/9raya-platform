import { createClient, getUser } from "@/lib/supabase/client";
import { getCatalog } from "./courses";
import type { ModuleCard } from "./modules";
import type { AnswerType } from "@/lib/quiz/types";

/*
 * TD sheets of each module, in the order the professor gave them (TD 1, TD 2…):
 *   content/<course-slug>/td/tdNN.json   ("chapter" = TD number, "title" = theme)
 * Regrouped from the per-chapter builder output by output/td_path/series_from_chapters.py.
 * Exercises are the professor's statements; the correction is the professor's when it exists
 * (solution_source "prof"), otherwise written with AI (solution_source "ia") and labelled as such.
 * The files are read at build time (src/lib/content/static.ts); the pages only embed PublicTdExercise.
 */

export type TdAnswer = { label?: string; answerType: AnswerType; accepted: string[]; variables?: string[] };
export type TdQcm = { prompt_md: string; options: { id: string; md: string }[]; answer: string; explanation_md: string };
export type TdExercise = {
  number: string;
  title?: string;
  statement_md: string;
  solution_md: string | null;
  solution_source?: "prof" | "ia" | null;
  source?: string;
  answers?: TdAnswer[];
  /** concours-style multiple choice questions about the exercise (not shown anymore) */
  qcm?: TdQcm[];
};
export type TdChapter = { chapter: number; title: string; exercises: TdExercise[] };

/** Exercise as embedded in the page: statement and correction, without the checkable answers and QCM. */
export type PublicTdExercise = Omit<TdExercise, "answers" | "qcm">;

/** Exercise numbers of each chapter of each module's TD (computed at build time). */
export type TdIndex = Record<string, { chapter: number; exercises: string[] }[]>;

export type TdStatus = "done" | "review";

export async function getTdProgress(slug?: string): Promise<Map<string, TdStatus>> {
  const user = await getUser();
  const out = new Map<string, TdStatus>();
  if (!user) return out;
  let q = createClient().from("td_progress").select("course_slug, chapter, exercise, status").eq("user_id", user.id);
  if (slug) q = q.eq("course_slug", slug);
  const { data } = await q;
  for (const r of (data ?? []) as { course_slug: string; chapter: number; exercise: string; status: TdStatus }[])
    out.set(`${r.course_slug}/${r.chapter}/${r.exercise}`, r.status);
  return out;
}

/** TD cards for every module (same panels as the courses). */
export async function getTdModuleCards(index: TdIndex): Promise<ModuleCard[]> {
  const catalog = await getCatalog();
  const semester = catalog.find((s) => s.courses.length) ?? catalog[0];
  if (!semester) return [];
  const progress = await getTdProgress();
  return semester.courses
    .filter((c) => c.status !== "draft")
    .map((c) => {
      const chapters = index[c.slug] ?? [];
      const total = chapters.reduce((n, ch) => n + ch.exercises.length, 0);
      const completed = chapters.reduce((n, ch) => n + ch.exercises.filter((e) => progress.get(`${c.slug}/${ch.chapter}/${e}`) === "done").length, 0);
      return {
        slug: c.slug,
        title: c.title,
        color: c.color,
        available: total > 0,
        total,
        completed,
        href: `/td/${c.slug}`,
        nextLesson: null,
        clip: null,
      };
    });
}
