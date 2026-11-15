"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUser } from "@/lib/supabase/server";
import { gradeQuestion, gradeStep } from "@/lib/quiz/grade";
import type { Feedback, GivenAnswer, PublicQuestion, SecretAnswer } from "@/lib/quiz/types";
import { PASS_RATIO, XP, levelFromXp } from "@/lib/gamification";
import { chapterStates } from "@/lib/data/courses";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function authed() {
  const user = await getUser();
  if (!user) throw new Error("Session expirée. Reconnecte-toi.");
  return user;
}

function fail(e: unknown): { ok: false; error: string } {
  console.error(e);
  return { ok: false, error: e instanceof Error ? e.message : "Erreur inattendue." };
}

type QuestionWithAnswer = {
  id: string;
  lesson_id: string;
  kind: string;
  placement: "quiz" | "checkpoint";
  data: PublicQuestion;
  answer: { answer: SecretAnswer; explanation: string } | null;
};

async function loadQuestion(questionId: string): Promise<QuestionWithAnswer> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("questions")
    .select("id, lesson_id, kind, placement, data, answer:question_answers(answer, explanation), lesson:lessons!inner(published)")
    .eq("id", questionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Question introuvable.");
  const q = data as unknown as QuestionWithAnswer & { lesson: { published: boolean } };
  if (!q.answer) throw new Error("Cette question n'a pas encore de correction.");
  return q;
}

function grade(q: QuestionWithAnswer, given: GivenAnswer, stepIndex?: number): Feedback {
  const answer = q.answer!.answer;
  if (answer.kind === "steps" && q.data.kind === "steps") {
    if (stepIndex === undefined) throw new Error("Étape manquante.");
    return gradeStep(q.data, answer, stepIndex, given);
  }
  return gradeQuestion(q.data, answer, given, q.answer!.explanation);
}

async function totalXp(userId: string) {
  const db = createAdminClient();
  const { data } = await db.from("xp_events").select("amount").eq("user_id", userId);
  return (data ?? []).reduce((n, r) => n + (r as { amount: number }).amount, 0);
}

async function award(userId: string, amount: number, reason: string, ref: string) {
  const db = createAdminClient();
  const { data, error } = await db.rpc("award_xp", { p_user: userId, p_amount: amount, p_reason: reason, p_ref: ref });
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

async function newAchievements(userId: string) {
  const db = createAdminClient();
  const { data, error } = await db.rpc("evaluate_achievements", { p_user: userId });
  if (error) throw new Error(error.message);
  const ids = ((data ?? []) as unknown[]).map((r) => (typeof r === "string" ? r : (r as { evaluate_achievements: string }).evaluate_achievements));
  if (!ids.length) return [];
  const { data: rows } = await db.from("achievements").select("id, title, description, icon").in("id", ids);
  return (rows ?? []) as { id: string; title: string; description: string; icon: string }[];
}

async function streakOf(userId: string) {
  const db = createAdminClient();
  const { data } = await db.rpc("get_streak", { p_user: userId });
  const row = (Array.isArray(data) ? data[0] : data) as { current_streak: number; longest_streak: number; active_today: boolean } | null;
  return row ?? { current_streak: 0, longest_streak: 0, active_today: false };
}

// ------------------------------------------------------------------ lesson position, bookmarks, notes

export async function saveLessonPosition(lessonId: string, block: number): Promise<Result<null>> {
  try {
    const user = await authed();
    const db = createAdminClient();
    const { data: existing } = await db.from("lesson_progress").select("status, last_block").eq("user_id", user.id).eq("lesson_id", lessonId).maybeSingle();
    if (existing) {
      if ((existing as { last_block: number }).last_block !== block)
        await db.from("lesson_progress").update({ last_block: Math.max(0, block), updated_at: new Date().toISOString() }).eq("user_id", user.id).eq("lesson_id", lessonId);
    } else {
      const { error } = await db.from("lesson_progress").insert({ user_id: user.id, lesson_id: lessonId, last_block: Math.max(0, block) });
      if (error) throw new Error(error.message);
    }
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleBookmark(lessonId: string): Promise<Result<{ bookmarked: boolean }>> {
  try {
    const user = await authed();
    const supabase = await createClient();
    const { data: existing } = await supabase.from("bookmarks").select("lesson_id").eq("user_id", user.id).eq("lesson_id", lessonId).maybeSingle();
    if (existing) {
      const { error } = await supabase.from("bookmarks").delete().eq("user_id", user.id).eq("lesson_id", lessonId);
      if (error) throw new Error(error.message);
      revalidatePath("/favoris");
      return { ok: true, data: { bookmarked: false } };
    }
    const { error } = await supabase.from("bookmarks").insert({ user_id: user.id, lesson_id: lessonId });
    if (error) throw new Error(error.message);
    revalidatePath("/favoris");
    return { ok: true, data: { bookmarked: true } };
  } catch (e) {
    return fail(e);
  }
}

export async function saveNote(lessonId: string, body: string): Promise<Result<{ savedAt: string }>> {
  try {
    const user = await authed();
    if (body.length > 20000) throw new Error("Note trop longue (20 000 caractères max).");
    const supabase = await createClient();
    const { error } = await supabase.from("notes").upsert({ user_id: user.id, lesson_id: lessonId, body }, { onConflict: "user_id,lesson_id" });
    if (error) throw new Error(error.message);
    return { ok: true, data: { savedAt: new Date().toISOString() } };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------------------------ in-lesson checkpoints

export type CheckpointResult = { feedback: Feedback; xp: number; achievements: Awaited<ReturnType<typeof newAchievements>> };

export async function answerCheckpoint(questionId: string, given: GivenAnswer, stepIndex?: number, isLastStep?: boolean): Promise<Result<CheckpointResult>> {
  try {
    const user = await authed();
    const q = await loadQuestion(questionId);
    if (q.placement !== "checkpoint") throw new Error("Question invalide.");
    const feedback = grade(q, given, stepIndex);
    const db = createAdminClient();
    let xp = 0;
    const final = q.kind !== "steps" || isLastStep;
    if (final) {
      await db.from("answer_events").insert({ user_id: user.id, question_id: q.id, correct: feedback.correct });
      await db.rpc("bump_activity", { p_user: user.id, p_lessons: 0, p_questions: 1 });
      if (feedback.correct) xp = await award(user.id, XP.checkpoint, "checkpoint", q.id);
    }
    const achievements = final ? await newAchievements(user.id) : [];
    return { ok: true, data: { feedback, xp, achievements } };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------------------------ quizzes

type StoredResult = { correct: boolean; given: unknown; steps?: boolean[]; done: boolean };

export async function startQuiz(lessonId: string): Promise<Result<{ attemptId: string }>> {
  try {
    const user = await authed();
    const supabase = await createClient();
    // the student must be able to see the lesson (published, RLS) — checked with their own client
    const { data: lesson } = await supabase.from("lessons").select("id").eq("id", lessonId).maybeSingle();
    if (!lesson) throw new Error("Leçon introuvable.");
    const db = createAdminClient();
    const { count } = await db.from("questions").select("id", { count: "exact", head: true }).eq("lesson_id", lessonId).eq("placement", "quiz");
    if (!count) throw new Error("Ce quiz n'a pas encore de questions.");
    const { data, error } = await db.from("quiz_attempts").insert({ user_id: user.id, lesson_id: lessonId, total: count }).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, data: { attemptId: (data as { id: string }).id } };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Grade one quiz answer. Only the FIRST answer to each question (or each step) counts for
 * the score: answering again after seeing the correction returns feedback but changes nothing.
 */
export async function answerQuizQuestion(attemptId: string, questionId: string, given: GivenAnswer, stepIndex?: number): Promise<Result<{ feedback: Feedback; counted: boolean }>> {
  try {
    const user = await authed();
    const db = createAdminClient();
    const { data: attempt } = await db.from("quiz_attempts").select("id, user_id, lesson_id, status, results").eq("id", attemptId).maybeSingle();
    const a = attempt as { id: string; user_id: string; lesson_id: string; status: string; results: Record<string, StoredResult> } | null;
    if (!a || a.user_id !== user.id) throw new Error("Tentative introuvable.");
    if (a.status !== "open") throw new Error("Ce quiz est déjà terminé.");
    const q = await loadQuestion(questionId);
    if (q.lesson_id !== a.lesson_id || q.placement !== "quiz") throw new Error("Question invalide pour ce quiz.");

    const feedback = grade(q, given, stepIndex);
    const results = { ...(a.results ?? {}) };
    const prev = results[questionId];
    let counted = false;

    if (q.kind === "steps" && q.answer!.answer.kind === "steps") {
      const nSteps = q.answer!.answer.steps.length;
      const steps = prev?.steps ? [...prev.steps] : [];
      if (stepIndex !== undefined && steps[stepIndex] === undefined) {
        steps[stepIndex] = feedback.correct;
        counted = true;
      }
      const done = steps.filter((s) => s !== undefined).length >= nSteps;
      results[questionId] = { correct: done && steps.every(Boolean), given: null, steps, done };
    } else if (!prev) {
      results[questionId] = { correct: feedback.correct, given, done: true };
      counted = true;
    }

    if (counted) {
      const { error } = await db.from("quiz_attempts").update({ results }).eq("id", attemptId).eq("status", "open");
      if (error) throw new Error(error.message);
    }
    return { ok: true, data: { feedback, counted } };
  } catch (e) {
    return fail(e);
  }
}

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
  achievements: Awaited<ReturnType<typeof newAchievements>>;
  lessonCompleted: boolean;
  chapterCompleted: boolean;
  unlockedChapter: { slug: string; title: string; number: number } | null;
  wrong: string[]; // question ids answered incorrectly, for the review mode
};

export async function finishQuiz(attemptId: string): Promise<Result<QuizSummary>> {
  try {
    const user = await authed();
    const db = createAdminClient();
    const { data: attempt } = await db
      .from("quiz_attempts")
      .select("id, user_id, lesson_id, status, total, results, lesson:lessons(id, chapter_id, chapter:chapters(id, course_id))")
      .eq("id", attemptId)
      .maybeSingle();
    const a = attempt as unknown as {
      id: string;
      user_id: string;
      lesson_id: string;
      status: string;
      total: number;
      results: Record<string, StoredResult>;
      lesson: { id: string; chapter_id: string; chapter: { id: string; course_id: string } };
    } | null;
    if (!a || a.user_id !== user.id) throw new Error("Tentative introuvable.");
    if (a.status !== "open") throw new Error("Ce quiz est déjà terminé.");

    const entries = Object.entries(a.results ?? {});
    if (entries.filter(([, r]) => r.done).length < a.total) throw new Error("Réponds à toutes les questions avant de terminer.");
    const score = entries.filter(([, r]) => r.done && r.correct).length;
    const passed = score / a.total >= PASS_RATIO;
    const wrong = entries.filter(([, r]) => !r.correct).map(([id]) => id);

    const xpBefore = await totalXp(user.id);
    const courseId = a.lesson.chapter.course_id;
    const statesBefore = await courseChapterStates(user.id, courseId);

    const { error: upErr } = await db
      .from("quiz_attempts")
      .update({ status: "finished", score, passed, finished_at: new Date().toISOString() })
      .eq("id", attemptId)
      .eq("status", "open");
    if (upErr) throw new Error(upErr.message);

    await db.from("answer_events").insert(entries.map(([qid, r]) => ({ user_id: user.id, question_id: qid, attempt_id: attemptId, correct: r.correct })));

    let lessonCompleted = false;
    let chapterCompleted = false;
    let gained = 0;
    if (passed) {
      const { data: prog } = await db.from("lesson_progress").select("status, skipped").eq("user_id", user.id).eq("lesson_id", a.lesson_id).maybeSingle();
      const p = prog as { status?: string; skipped?: boolean } | null;
      // a skipped lesson becomes a real completion once its quiz is passed
      const wasCompleted = p?.status === "completed" && !p.skipped;
      if (!wasCompleted) {
        const { error } = await db
          .from("lesson_progress")
          .upsert(
            { user_id: user.id, lesson_id: a.lesson_id, status: "completed", skipped: false, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { onConflict: "user_id,lesson_id" },
          );
        if (error) throw new Error(error.message);
        lessonCompleted = true;
        await db.rpc("bump_activity", { p_user: user.id, p_lessons: 1, p_questions: a.total });
      } else {
        await db.rpc("bump_activity", { p_user: user.id, p_lessons: 0, p_questions: a.total });
      }
      gained += await award(user.id, XP.lessonComplete, "lesson_complete", a.lesson_id);
      gained += await award(user.id, XP.quizPass, "quiz_pass", a.lesson_id);
      if (score === a.total) gained += await award(user.id, XP.quizPerfect, "quiz_perfect", a.lesson_id);

      // chapter / course completion bonuses need every lesson really completed (skips don't count)
      const really = async (lessonIds: string[]) => {
        if (!lessonIds.length) return 0;
        const { count } = await db
          .from("lesson_progress")
          .select("lesson_id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "completed")
          .eq("skipped", false)
          .in("lesson_id", lessonIds);
        return count ?? 0;
      };
      const { data: chLessons } = await db.from("lessons").select("id").eq("chapter_id", a.lesson.chapter_id).eq("published", true);
      const ids = (chLessons ?? []).map((l) => (l as { id: string }).id);
      if (ids.length && (await really(ids)) === ids.length) {
        const g = await award(user.id, XP.chapterComplete, "chapter_complete", a.lesson.chapter_id);
        chapterCompleted = g > 0;
        gained += g;
        const { data: courseLessons } = await db.from("lessons").select("id, chapter:chapters!inner(course_id, published)").eq("published", true).eq("chapters.course_id", courseId).eq("chapters.published", true);
        const all = (courseLessons ?? []).map((l) => (l as { id: string }).id);
        if (all.length && (await really(all)) === all.length) gained += await award(user.id, XP.courseComplete, "course_complete", courseId);
      }
    } else {
      await db.rpc("bump_activity", { p_user: user.id, p_lessons: 0, p_questions: a.total });
    }

    if (gained) await db.from("quiz_attempts").update({ xp_awarded: gained }).eq("id", attemptId);

    const statesAfter = await courseChapterStates(user.id, courseId);
    const unlocked = statesAfter.find((c, i) => statesBefore[i]?.state === "locked" && c.state !== "locked") ?? null;
    const achievements = await newAchievements(user.id);
    const xpAfter = await totalXp(user.id);
    const lvBefore = levelFromXp(xpBefore);
    const lvAfter = levelFromXp(xpAfter);

    revalidatePath("/tableau-de-bord");
    revalidatePath("/cours", "layout");
    return {
      ok: true,
      data: {
        score,
        total: a.total,
        passed,
        xpGained: xpAfter - xpBefore,
        totalXp: xpAfter,
        level: lvAfter.level,
        leveledUp: lvAfter.level > lvBefore.level,
        levelProgress: lvAfter.progress,
        streak: await streakOf(user.id),
        achievements,
        lessonCompleted,
        chapterCompleted,
        unlockedChapter: unlocked ? { slug: unlocked.slug, title: unlocked.title, number: unlocked.number } : null,
        wrong,
      },
    };
  } catch (e) {
    return fail(e);
  }
}

/** Chapter states for one user in one course (service-side version of the outline rule). */
async function courseChapterStates(userId: string, courseId: string) {
  const db = createAdminClient();
  const [{ data: course }, { data: chapters }, { data: progress }, { data: profile }] = await Promise.all([
    db.from("courses").select("sequential").eq("id", courseId).single(),
    db.from("chapters").select("id, slug, title, number, position, lessons(id, published)").eq("course_id", courseId).eq("published", true).order("position"),
    db.from("lesson_progress").select("lesson_id").eq("user_id", userId).eq("status", "completed"),
    db.from("profiles").select("role").eq("id", userId).single(),
  ]);
  const done = new Set((progress ?? []).map((p) => (p as { lesson_id: string }).lesson_id));
  const rows = ((chapters ?? []) as { id: string; slug: string; title: string; number: number; lessons: { id: string; published: boolean }[] }[]).map((c) => {
    const ls = c.lessons.filter((l) => l.published);
    return { ...c, total: ls.length, completed: ls.filter((l) => done.has(l.id)).length };
  });
  const states = chapterStates(rows, (course as { sequential: boolean } | null)?.sequential ?? true, (profile as { role?: string } | null)?.role === "admin");
  return rows.map((r, i) => ({ ...r, state: states[i] }));
}

/** Review mode: the corrections of the questions answered wrongly in a finished attempt. */
export async function getAttemptReview(attemptId: string): Promise<Result<{ questionId: string; data: PublicQuestion; explanation: string; feedback: Feedback }[]>> {
  try {
    const user = await authed();
    const db = createAdminClient();
    const { data: attempt } = await db.from("quiz_attempts").select("user_id, status, results").eq("id", attemptId).maybeSingle();
    const a = attempt as { user_id: string; status: string; results: Record<string, StoredResult> } | null;
    if (!a || a.user_id !== user.id || a.status !== "finished") throw new Error("Tentative introuvable.");
    const wrongIds = Object.entries(a.results).filter(([, r]) => !r.correct).map(([id]) => id);
    const out = [];
    for (const id of wrongIds) {
      const q = await loadQuestion(id);
      const given = (a.results[id].given ?? {}) as GivenAnswer;
      const feedback = q.kind === "steps" ? { correct: false, explanation: q.answer!.explanation } : grade(q, given);
      out.push({ questionId: id, data: q.data, explanation: q.answer!.explanation, feedback });
    }
    return { ok: true, data: out };
  } catch (e) {
    return fail(e);
  }
}

/** Lessons without a quiz can be completed directly (admin-authored lessons may have none). */
export async function completeLessonWithoutQuiz(lessonId: string): Promise<Result<{ xp: number }>> {
  try {
    const user = await authed();
    const db = createAdminClient();
    const { count } = await db.from("questions").select("id", { count: "exact", head: true }).eq("lesson_id", lessonId).eq("placement", "quiz");
    if (count) throw new Error("Cette leçon se termine en réussissant son quiz.");
    await db.from("lesson_progress").upsert({ user_id: user.id, lesson_id: lessonId, status: "completed", skipped: false, completed_at: new Date().toISOString() }, { onConflict: "user_id,lesson_id" });
    const xp = await award(user.id, XP.lessonComplete, "lesson_complete", lessonId);
    await db.rpc("bump_activity", { p_user: user.id, p_lessons: 1, p_questions: 0 });
    await newAchievements(user.id);
    revalidatePath("/tableau-de-bord");
    return { ok: true, data: { xp } };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Skip a lesson: it is checked as done (progress, chapter unlocking) but earns no XP and does
 * not count for achievements or chapter/course bonuses. Passing its quiz later earns the XP.
 */
export async function skipLesson(lessonId: string): Promise<Result<{ skipped: boolean }>> {
  try {
    const user = await authed();
    // the student must be able to see the lesson (published + RLS), checked with their own client
    const supabase = await createClient();
    const { data: lesson } = await supabase.from("lessons").select("id").eq("id", lessonId).maybeSingle();
    if (!lesson) throw new Error("Leçon introuvable.");
    const db = createAdminClient();
    const { data: existing } = await db.from("lesson_progress").select("status").eq("user_id", user.id).eq("lesson_id", lessonId).maybeSingle();
    if ((existing as { status?: string } | null)?.status === "completed") return { ok: true, data: { skipped: false } };
    const { error } = await db
      .from("lesson_progress")
      .upsert(
        { user_id: user.id, lesson_id: lessonId, status: "completed", skipped: true, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { onConflict: "user_id,lesson_id" },
      );
    if (error) throw new Error(error.message);
    revalidatePath("/tableau-de-bord");
    revalidatePath("/cours", "layout");
    return { ok: true, data: { skipped: true } };
  } catch (e) {
    return fail(e);
  }
}

/** Undo a skip (back to "in progress"). Real completions are never undone. */
export async function unskipLesson(lessonId: string): Promise<Result<null>> {
  try {
    const user = await authed();
    const db = createAdminClient();
    const { error } = await db
      .from("lesson_progress")
      .update({ status: "in_progress", skipped: false, completed_at: null, updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("lesson_id", lessonId)
      .eq("skipped", true);
    if (error) throw new Error(error.message);
    revalidatePath("/tableau-de-bord");
    revalidatePath("/cours", "layout");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}
