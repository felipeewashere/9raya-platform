import { callApi, type Result } from "@/lib/api";
import { createClient, getUser } from "@/lib/supabase/client";
import type { Feedback, GivenAnswer, PublicQuestion } from "@/lib/quiz/types";

/*
 * Learning actions. Grading, XP, completion and skips go through the Edge Function `api`
 * (service role, hidden answers); the reading position is saved directly (RLS allows it).
 */

export type Achievement = { id: string; title: string; description: string; icon: string };
export type CheckpointResult = { feedback: Feedback; xp: number; achievements: Achievement[] };

export type QuizSummary = {
  score: number;
  total: number;
  passed: boolean;
  xpGained: number;
  totalXp: number;
  level: number;
  leveledUp: boolean;
  levelProgress: number;
  streak: { current_streak: number; longest_streak: number; active_today: boolean };
  achievements: Achievement[];
  lessonCompleted: boolean;
  chapterCompleted: boolean;
  unlockedChapter: { slug: string; title: string; number: number } | null;
  wrong: string[]; // question ids answered incorrectly, for the review mode
};

/** Furthest block read. Students may write only last_block / updated_at of their own rows. */
export async function saveLessonPosition(lessonId: string, block: number): Promise<Result<null>> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Session expirée. Reconnecte-toi." };
  const db = createClient();
  const last = Math.max(0, block);
  const { data: existing } = await db.from("lesson_progress").select("last_block").eq("user_id", user.id).eq("lesson_id", lessonId).maybeSingle();
  if (existing) {
    if ((existing as { last_block: number }).last_block !== last)
      await db.from("lesson_progress").update({ last_block: last, updated_at: new Date().toISOString() }).eq("user_id", user.id).eq("lesson_id", lessonId);
  } else {
    const { error } = await db.from("lesson_progress").insert({ user_id: user.id, lesson_id: lessonId, last_block: last });
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true, data: null };
}

export const answerCheckpoint = (questionId: string, given: GivenAnswer, stepIndex?: number, isLastStep?: boolean) =>
  callApi<CheckpointResult>("answerCheckpoint", { questionId, given, stepIndex, isLastStep });

export const startQuiz = (lessonId: string) => callApi<{ attemptId: string }>("startQuiz", { lessonId });

export const answerQuizQuestion = (attemptId: string, questionId: string, given: GivenAnswer, stepIndex?: number) =>
  callApi<{ feedback: Feedback; counted: boolean }>("answerQuizQuestion", { attemptId, questionId, given, stepIndex });

export const finishQuiz = (attemptId: string) => callApi<QuizSummary>("finishQuiz", { attemptId });

export const getAttemptReview = (attemptId: string) =>
  callApi<{ questionId: string; data: PublicQuestion; explanation: string; feedback: Feedback }[]>("getAttemptReview", { attemptId });

export const completeLessonWithoutQuiz = (lessonId: string) => callApi<{ xp: number }>("completeLessonWithoutQuiz", { lessonId });

export const skipLesson = (lessonId: string) => callApi<{ skipped: boolean }>("skipLesson", { lessonId });

export const unskipLesson = (lessonId: string) => callApi<null>("unskipLesson", { lessonId });
