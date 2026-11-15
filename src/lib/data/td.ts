import "server-only";
import { cache } from "react";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, getUser } from "@/lib/supabase/server";
import { getCatalog } from "./courses";
import type { ModuleCard } from "./modules";
import type { AnswerType } from "@/lib/quiz/types";

/*
 * TD series of each module, one file per course chapter:
 *   content/<course-slug>/td/chNN.json
 * Exercises are the professor's statements; the correction is the professor's when it exists
 * (solution_source "prof"), otherwise written with AI (solution_source "ia") and labelled as such.
 * `answers` (optional) lets the student check a final result: only the result is compared,
 * so any method that reaches it counts.
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

const dir = (slug: string) => join(process.cwd(), "content", slug, "td");

export const readTdChapters = cache((slug: string): TdChapter[] => {
  if (!/^[a-z0-9-]+$/.test(slug) || !existsSync(dir(slug))) return [];
  return readdirSync(dir(slug))
    .filter((f) => /^ch\d+\.json$/.test(f))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir(slug), f), "utf8")) as TdChapter)
    .filter((c) => Array.isArray(c.exercises) && c.exercises.length > 0)
    .sort((a, b) => a.chapter - b.chapter);
});

export type TdStatus = "done" | "review";

export const getTdProgress = cache(async (slug?: string): Promise<Map<string, TdStatus>> => {
  const user = await getUser();
  const out = new Map<string, TdStatus>();
  if (!user) return out;
  const supabase = await createClient();
  let q = supabase.from("td_progress").select("course_slug, chapter, exercise, status").eq("user_id", user.id);
  if (slug) q = q.eq("course_slug", slug);
  const { data } = await q;
  for (const r of (data ?? []) as { course_slug: string; chapter: number; exercise: string; status: TdStatus }[])
    out.set(`${r.course_slug}/${r.chapter}/${r.exercise}`, r.status);
  return out;
});

/** TD cards for every module (same panels as the courses). */
export async function getTdModuleCards(): Promise<ModuleCard[]> {
  const catalog = await getCatalog();
  const semester = catalog.find((s) => s.courses.length) ?? catalog[0];
  if (!semester) return [];
  const progress = await getTdProgress();
  return semester.courses
    .filter((c) => c.status !== "draft")
    .map((c) => {
      const chapters = readTdChapters(c.slug);
      const total = chapters.reduce((n, ch) => n + ch.exercises.length, 0);
      const completed = chapters.reduce((n, ch) => n + ch.exercises.filter((e) => progress.get(`${c.slug}/${ch.chapter}/${e.number}`) === "done").length, 0);
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

/** Exercise without the expected answers (those stay on the server). */
export type PublicTdExercise = Omit<TdExercise, "answers" | "qcm"> & {
  answerLabels: string[];
  qcm: { prompt: string; options: { id: string; md: string }[] }[];
};

/** Answers the site can check (a typed value + accepted list); anything else is ignored. */
export function checkableAnswers(e: TdExercise): TdAnswer[] {
  return (e.answers ?? []).filter(
    (a) => a && ["text", "number", "expression"].includes(a.answerType) && Array.isArray(a.accepted) && a.accepted.length > 0,
  );
}

export function publicExercise(e: TdExercise): PublicTdExercise {
  const { answers: _answers, qcm, ...rest } = e;
  void _answers;
  const answers = checkableAnswers(e);
  return {
    ...rest,
    answerLabels: answers.map((a, i) => a.label ?? (answers.length > 1 ? `Résultat ${i + 1}` : "Résultat final")),
    // answers and explanations stay on the server
    qcm: (qcm ?? []).filter((q) => q && Array.isArray(q.options) && q.options.length >= 2).map((q) => ({ prompt: q.prompt_md, options: q.options })),
  };
}
