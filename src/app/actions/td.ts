"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { matchesAccepted } from "@/lib/quiz/grade";
import type { Feedback } from "@/lib/quiz/types";
import { checkableAnswers, readTdChapters } from "@/lib/data/td";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function findExercise(slug: string, chapter: number, exercise: string) {
  return readTdChapters(slug)
    .find((c) => c.chapter === chapter)
    ?.exercises.find((e) => e.number === exercise);
}

/** Checks one final result of a TD exercise. Only the result is compared, so any method counts. */
export async function checkTdAnswer(slug: string, chapter: number, exercise: string, index: number, given: string): Promise<Result<{ correct: boolean }>> {
  const ex = findExercise(slug, chapter, exercise);
  const answer = ex ? checkableAnswers(ex)[index] : undefined;
  if (!answer) return { ok: false, error: "Exercice introuvable." };
  if (!given.trim()) return { ok: false, error: "Écris ton résultat." };
  return { ok: true, data: { correct: matchesAccepted(answer.answerType, given, answer.accepted, answer.variables ?? []) } };
}

/** Grades one QCM of a TD exercise. */
export async function checkTdQcm(slug: string, chapter: number, exercise: string, index: number, option: string): Promise<Result<Feedback>> {
  const ex = findExercise(slug, chapter, exercise);
  const q = (ex?.qcm ?? []).filter((x) => x && Array.isArray(x.options) && x.options.length >= 2)[index];
  if (!q) return { ok: false, error: "Question introuvable." };
  const right = q.options.find((o) => o.id === q.answer);
  return {
    ok: true,
    data: { correct: option === q.answer, explanation: q.explanation_md, correctOption: q.answer, correctAnswer: right?.md },
  };
}

/** "Réussi" / "À revoir" for one exercise (null clears it). */
export async function setTdStatus(slug: string, chapter: number, exercise: string, status: "done" | "review" | null): Promise<Result<null>> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Session expirée." };
  if (!findExercise(slug, chapter, exercise)) return { ok: false, error: "Exercice introuvable." };
  const supabase = await createClient();
  const key = { user_id: user.id, course_slug: slug, chapter, exercise };
  const { error } = status
    ? await supabase.from("td_progress").upsert({ ...key, status, updated_at: new Date().toISOString() })
    : await supabase.from("td_progress").delete().match(key);
  if (error) return { ok: false, error: "Impossible d'enregistrer." };
  revalidatePath("/td", "layout");
  return { ok: true, data: null };
}
