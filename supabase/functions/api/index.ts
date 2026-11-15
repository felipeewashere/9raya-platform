// 9raya "api" Edge Function: everything that needs the service role.
// Grading against the hidden answers (question_answers), XP / streak / achievement writes,
// lesson completion, skip / unskip and account deletion.
//
// POST { action: string, ...args } with the student's access token in Authorization.
// Every response is { ok: true, data } or { ok: false, error } (same shapes as the former server actions).
//
// The grading and gamification modules in ./shared are copies of src/lib (run `npm run edge:sync`).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { gradeQuestion, gradeStep } from "./shared/grade.ts";
import type { Feedback, GivenAnswer, PublicQuestion, SecretAnswer } from "./shared/types.ts";
import { PASS_RATIO, XP, chapterStates, levelFromXp } from "./shared/gamification.ts";

const ALLOWED_ORIGINS = ["https://felipeewashere.github.io", "http://localhost:3000"];

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

class UserError extends Error {}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function uuid(v: unknown, what: string): string {
  if (typeof v !== "string" || !UUID.test(v)) throw new UserError(`${what} invalide.`);
  return v;
}

// ------------------------------------------------------------------ helpers (ported from the server actions)

type QuestionWithAnswer = {
  id: string;
  lesson_id: string;
  kind: string;
  placement: "quiz" | "checkpoint";
  data: PublicQuestion;
  answer: { answer: SecretAnswer; explanation: string } | null;
};

async function loadQuestion(questionId: string): Promise<QuestionWithAnswer> {
  const { data, error } = await db
    .from("questions")
    .select("id, lesson_id, kind, placement, data, answer:question_answers(answer, explanation), lesson:lessons!inner(published)")
    .eq("id", questionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new UserError("Question introuvable.");
  const q = data as unknown as QuestionWithAnswer & { lesson: { published: boolean } };
  if (!q.lesson?.published) throw new UserError("Question introuvable.");
  if (!q.answer) throw new UserError("Cette question n'a pas encore de correction.");
  return q;
}

function grade(q: QuestionWithAnswer, given: GivenAnswer, stepIndex?: number): Feedback {
  const answer = q.answer!.answer;
  if (answer.kind === "steps" && q.data.kind === "steps") {
    if (stepIndex === undefined || !Number.isInteger(stepIndex)) throw new UserError("Étape manquante.");
    return gradeStep(q.data, answer, stepIndex, given);
  }
  return gradeQuestion(q.data, answer, given, q.answer!.explanation);
}

function givenAnswer(v: unknown): GivenAnswer {
  if (!v || typeof v !== "object") throw new UserError("Réponse invalide.");
  return v as GivenAnswer;
}

async function totalXp(userId: string) {
  const { data } = await db.from("xp_events").select("amount").eq("user_id", userId);
  return (data ?? []).reduce((n, r) => n + (r as { amount: number }).amount, 0);
}

async function award(userId: string, amount: number, reason: string, ref: string) {
  const { data, error } = await db.rpc("award_xp", { p_user: userId, p_amount: amount, p_reason: reason, p_ref: ref });
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

type Achievement = { id: string; title: string; description: string; icon: string };

async function newAchievements(userId: string): Promise<Achievement[]> {
  const { data, error } = await db.rpc("evaluate_achievements", { p_user: userId });
  if (error) throw new Error(error.message);
  const ids = ((data ?? []) as unknown[]).map((r) => (typeof r === "string" ? r : (r as { evaluate_achievements: string }).evaluate_achievements));
  if (!ids.length) return [];
  const { data: rows } = await db.from("achievements").select("id, title, description, icon").in("id", ids);
  return (rows ?? []) as Achievement[];
}

async function streakOf(userId: string) {
  const { data } = await db.rpc("get_streak", { p_user: userId });
  const row = (Array.isArray(data) ? data[0] : data) as { current_streak: number; longest_streak: number; active_today: boolean } | null;
  return row ?? { current_streak: 0, longest_streak: 0, active_today: false };
}

/** The lesson must be visible to students (published, in a published chapter). */
async function visibleLesson(lessonId: string) {
  const { data } = await db.from("lessons").select("id, published, chapter:chapters!inner(published)").eq("id", lessonId).maybeSingle();
  const l = data as unknown as { id: string; published: boolean; chapter: { published: boolean } } | null;
  if (!l || !l.published || !l.chapter?.published) throw new UserError("Leçon introuvable.");
}

/** Chapter states for one user in one course (service-side version of the outline rule). */
async function courseChapterStates(userId: string, courseId: string) {
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

type StoredResult = { correct: boolean; given: unknown; steps?: boolean[]; done: boolean };

// ------------------------------------------------------------------ actions

type Args = Record<string, unknown>;

const actions: Record<string, (userId: string, a: Args) => Promise<unknown>> = {
  async answerCheckpoint(userId, a) {
    const q = await loadQuestion(uuid(a.questionId, "Question"));
    if (q.placement !== "checkpoint") throw new UserError("Question invalide.");
    const stepIndex = typeof a.stepIndex === "number" ? a.stepIndex : undefined;
    const feedback = grade(q, givenAnswer(a.given), stepIndex);
    let xp = 0;
    const final = q.kind !== "steps" || a.isLastStep === true;
    if (final) {
      await db.from("answer_events").insert({ user_id: userId, question_id: q.id, correct: feedback.correct });
      await db.rpc("bump_activity", { p_user: userId, p_lessons: 0, p_questions: 1 });
      if (feedback.correct) xp = await award(userId, XP.checkpoint, "checkpoint", q.id);
    }
    const achievements = final ? await newAchievements(userId) : [];
    return { feedback, xp, achievements };
  },

  async startQuiz(userId, a) {
    const lessonId = uuid(a.lessonId, "Leçon");
    await visibleLesson(lessonId);
    const { count } = await db.from("questions").select("id", { count: "exact", head: true }).eq("lesson_id", lessonId).eq("placement", "quiz");
    if (!count) throw new UserError("Ce quiz n'a pas encore de questions.");
    const { data, error } = await db.from("quiz_attempts").insert({ user_id: userId, lesson_id: lessonId, total: count }).select("id").single();
    if (error) throw new Error(error.message);
    return { attemptId: (data as { id: string }).id };
  },

  /**
   * Grade one quiz answer. Only the FIRST answer to each question (or each step) counts for
   * the score: answering again after seeing the correction returns feedback but changes nothing.
   */
  async answerQuizQuestion(userId, a) {
    const attemptId = uuid(a.attemptId, "Tentative");
    const questionId = uuid(a.questionId, "Question");
    const stepIndex = typeof a.stepIndex === "number" ? a.stepIndex : undefined;
    const given = givenAnswer(a.given);
    const { data: attempt } = await db.from("quiz_attempts").select("id, user_id, lesson_id, status, results").eq("id", attemptId).maybeSingle();
    const at = attempt as { id: string; user_id: string; lesson_id: string; status: string; results: Record<string, StoredResult> } | null;
    if (!at || at.user_id !== userId) throw new UserError("Tentative introuvable.");
    if (at.status !== "open") throw new UserError("Ce quiz est déjà terminé.");
    const q = await loadQuestion(questionId);
    if (q.lesson_id !== at.lesson_id || q.placement !== "quiz") throw new UserError("Question invalide pour ce quiz.");

    const feedback = grade(q, given, stepIndex);
    const results = { ...(at.results ?? {}) };
    const prev = results[questionId];
    let counted = false;

    if (q.kind === "steps" && q.answer!.answer.kind === "steps") {
      const nSteps = q.answer!.answer.steps.length;
      const steps = prev?.steps ? [...prev.steps] : [];
      if (stepIndex !== undefined && steps[stepIndex] === undefined) {
        steps[stepIndex] = feedback.correct;
        counted = true;
      }
      const done = steps.filter((s) => s !== undefined && s !== null).length >= nSteps;
      results[questionId] = { correct: done && steps.every(Boolean), given: null, steps, done };
    } else if (!prev) {
      results[questionId] = { correct: feedback.correct, given, done: true };
      counted = true;
    }

    if (counted) {
      const { error } = await db.from("quiz_attempts").update({ results }).eq("id", attemptId).eq("status", "open");
      if (error) throw new Error(error.message);
    }
    return { feedback, counted };
  },

  async finishQuiz(userId, a) {
    const attemptId = uuid(a.attemptId, "Tentative");
    const { data: attempt } = await db
      .from("quiz_attempts")
      .select("id, user_id, lesson_id, status, total, results, lesson:lessons(id, chapter_id, chapter:chapters(id, course_id))")
      .eq("id", attemptId)
      .maybeSingle();
    const at = attempt as unknown as {
      id: string;
      user_id: string;
      lesson_id: string;
      status: string;
      total: number;
      results: Record<string, StoredResult>;
      lesson: { id: string; chapter_id: string; chapter: { id: string; course_id: string } };
    } | null;
    if (!at || at.user_id !== userId) throw new UserError("Tentative introuvable.");
    if (at.status !== "open") throw new UserError("Ce quiz est déjà terminé.");

    const entries = Object.entries(at.results ?? {});
    if (entries.filter(([, r]) => r.done).length < at.total) throw new UserError("Réponds à toutes les questions avant de terminer.");
    const score = entries.filter(([, r]) => r.done && r.correct).length;
    const passed = score / at.total >= PASS_RATIO;
    const wrong = entries.filter(([, r]) => !r.correct).map(([id]) => id);

    const xpBefore = await totalXp(userId);
    const courseId = at.lesson.chapter.course_id;
    const statesBefore = await courseChapterStates(userId, courseId);

    const { error: upErr } = await db
      .from("quiz_attempts")
      .update({ status: "finished", score, passed, finished_at: new Date().toISOString() })
      .eq("id", attemptId)
      .eq("status", "open");
    if (upErr) throw new Error(upErr.message);

    await db.from("answer_events").insert(entries.map(([qid, r]) => ({ user_id: userId, question_id: qid, attempt_id: attemptId, correct: r.correct })));

    let lessonCompleted = false;
    let chapterCompleted = false;
    let gained = 0;
    if (passed) {
      const { data: prog } = await db.from("lesson_progress").select("status, skipped").eq("user_id", userId).eq("lesson_id", at.lesson_id).maybeSingle();
      const p = prog as { status?: string; skipped?: boolean } | null;
      // a skipped lesson becomes a real completion once its quiz is passed
      const wasCompleted = p?.status === "completed" && !p.skipped;
      if (!wasCompleted) {
        const { error } = await db
          .from("lesson_progress")
          .upsert(
            { user_id: userId, lesson_id: at.lesson_id, status: "completed", skipped: false, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { onConflict: "user_id,lesson_id" },
          );
        if (error) throw new Error(error.message);
        lessonCompleted = true;
        await db.rpc("bump_activity", { p_user: userId, p_lessons: 1, p_questions: at.total });
      } else {
        await db.rpc("bump_activity", { p_user: userId, p_lessons: 0, p_questions: at.total });
      }
      gained += await award(userId, XP.lessonComplete, "lesson_complete", at.lesson_id);
      gained += await award(userId, XP.quizPass, "quiz_pass", at.lesson_id);
      if (score === at.total) gained += await award(userId, XP.quizPerfect, "quiz_perfect", at.lesson_id);

      // chapter / course completion bonuses need every lesson really completed (skips don't count)
      const really = async (lessonIds: string[]) => {
        if (!lessonIds.length) return 0;
        const { count } = await db
          .from("lesson_progress")
          .select("lesson_id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "completed")
          .eq("skipped", false)
          .in("lesson_id", lessonIds);
        return count ?? 0;
      };
      const { data: chLessons } = await db.from("lessons").select("id").eq("chapter_id", at.lesson.chapter_id).eq("published", true);
      const ids = (chLessons ?? []).map((l) => (l as { id: string }).id);
      if (ids.length && (await really(ids)) === ids.length) {
        const g = await award(userId, XP.chapterComplete, "chapter_complete", at.lesson.chapter_id);
        chapterCompleted = g > 0;
        gained += g;
        const { data: courseLessons } = await db
          .from("lessons")
          .select("id, chapter:chapters!inner(course_id, published)")
          .eq("published", true)
          .eq("chapters.course_id", courseId)
          .eq("chapters.published", true);
        const all = (courseLessons ?? []).map((l) => (l as { id: string }).id);
        if (all.length && (await really(all)) === all.length) gained += await award(userId, XP.courseComplete, "course_complete", courseId);
      }
    } else {
      await db.rpc("bump_activity", { p_user: userId, p_lessons: 0, p_questions: at.total });
    }

    if (gained) await db.from("quiz_attempts").update({ xp_awarded: gained }).eq("id", attemptId);

    const statesAfter = await courseChapterStates(userId, courseId);
    const unlocked = statesAfter.find((c, i) => statesBefore[i]?.state === "locked" && c.state !== "locked") ?? null;
    const achievements = await newAchievements(userId);
    const xpAfter = await totalXp(userId);
    const lvBefore = levelFromXp(xpBefore);
    const lvAfter = levelFromXp(xpAfter);

    return {
      score,
      total: at.total,
      passed,
      xpGained: xpAfter - xpBefore,
      totalXp: xpAfter,
      level: lvAfter.level,
      leveledUp: lvAfter.level > lvBefore.level,
      levelProgress: lvAfter.progress,
      streak: await streakOf(userId),
      achievements,
      lessonCompleted,
      chapterCompleted,
      unlockedChapter: unlocked ? { slug: unlocked.slug, title: unlocked.title, number: unlocked.number } : null,
      wrong,
    };
  },

  /** Review mode: the corrections of the questions answered wrongly in a finished attempt. */
  async getAttemptReview(userId, a) {
    const attemptId = uuid(a.attemptId, "Tentative");
    const { data: attempt } = await db.from("quiz_attempts").select("user_id, status, results").eq("id", attemptId).maybeSingle();
    const at = attempt as { user_id: string; status: string; results: Record<string, StoredResult> } | null;
    if (!at || at.user_id !== userId || at.status !== "finished") throw new UserError("Tentative introuvable.");
    const wrongIds = Object.entries(at.results).filter(([, r]) => !r.correct).map(([id]) => id);
    const out = [];
    for (const id of wrongIds) {
      const q = await loadQuestion(id);
      const given = (at.results[id].given ?? {}) as GivenAnswer;
      const feedback = q.kind === "steps" ? { correct: false, explanation: q.answer!.explanation } : grade(q, given);
      out.push({ questionId: id, data: q.data, explanation: q.answer!.explanation, feedback });
    }
    return out;
  },

  /** Lessons without a quiz can be completed directly. */
  async completeLessonWithoutQuiz(userId, a) {
    const lessonId = uuid(a.lessonId, "Leçon");
    await visibleLesson(lessonId);
    const { count } = await db.from("questions").select("id", { count: "exact", head: true }).eq("lesson_id", lessonId).eq("placement", "quiz");
    if (count) throw new UserError("Cette leçon se termine en réussissant son quiz.");
    await db
      .from("lesson_progress")
      .upsert({ user_id: userId, lesson_id: lessonId, status: "completed", skipped: false, completed_at: new Date().toISOString() }, { onConflict: "user_id,lesson_id" });
    const xp = await award(userId, XP.lessonComplete, "lesson_complete", lessonId);
    await db.rpc("bump_activity", { p_user: userId, p_lessons: 1, p_questions: 0 });
    await newAchievements(userId);
    return { xp };
  },

  /**
   * Skip a lesson: it is checked as done (progress, chapter unlocking) but earns no XP and does
   * not count for achievements or chapter/course bonuses. Passing its quiz later earns the XP.
   */
  async skipLesson(userId, a) {
    const lessonId = uuid(a.lessonId, "Leçon");
    await visibleLesson(lessonId);
    const { data: existing } = await db.from("lesson_progress").select("status").eq("user_id", userId).eq("lesson_id", lessonId).maybeSingle();
    if ((existing as { status?: string } | null)?.status === "completed") return { skipped: false };
    const { error } = await db
      .from("lesson_progress")
      .upsert(
        { user_id: userId, lesson_id: lessonId, status: "completed", skipped: true, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { onConflict: "user_id,lesson_id" },
      );
    if (error) throw new Error(error.message);
    return { skipped: true };
  },

  /** Undo a skip (back to "in progress"). Real completions are never undone. */
  async unskipLesson(userId, a) {
    const lessonId = uuid(a.lessonId, "Leçon");
    const { error } = await db
      .from("lesson_progress")
      .update({ status: "in_progress", skipped: false, completed_at: null, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("lesson_id", lessonId)
      .eq("skipped", true);
    if (error) throw new Error(error.message);
    return null;
  },

  /** Delete the account and all its data (profile rows cascade from auth.users). */
  async deleteAccount(userId, a) {
    if (a.confirm !== "SUPPRIMER") throw new UserError("Tape SUPPRIMER pour confirmer.");
    const { error } = await db.auth.admin.deleteUser(userId);
    if (error) throw new UserError("Suppression impossible pour le moment.");
    return null;
  },
};

// ------------------------------------------------------------------ entry point

Deno.serve(async (req) => {
  const headers = { ...cors(req), "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: false, error: "Méthode non autorisée." }), { status: 405, headers });

  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

  // verify the student's JWT with Supabase Auth
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return reply({ ok: false, error: "Session expirée. Reconnecte-toi." }, 401);
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return reply({ ok: false, error: "Session expirée. Reconnecte-toi." }, 401);

  let body: Args;
  try {
    body = (await req.json()) as Args;
  } catch {
    return reply({ ok: false, error: "Requête invalide." }, 400);
  }
  const name = typeof body?.action === "string" ? body.action : "";
  const action = Object.hasOwn(actions, name) ? actions[name] : undefined;
  if (!action) return reply({ ok: false, error: "Action inconnue." }, 400);

  try {
    return reply({ ok: true, data: await action(auth.user.id, body) });
  } catch (e) {
    if (e instanceof UserError) return reply({ ok: false, error: e.message });
    console.error(e);
    return reply({ ok: false, error: "Erreur inattendue." });
  }
});
