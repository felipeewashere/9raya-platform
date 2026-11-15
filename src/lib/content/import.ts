import type { SupabaseClient } from "@supabase/supabase-js";
import { chapterSchema, lessonSchema, type Block, type Chapter, type Lesson, type Question } from "@/content/schema";
import { joinQuestion, splitQuestion } from "@/lib/quiz/serialize";
import type { PublicQuestion, SecretAnswer } from "@/lib/quiz/types";

export type ImportOptions = {
  /** Publish chapters and lessons immediately (default true). */
  publish?: boolean;
  /** Delete sections/lessons that are no longer in the file (removes their student progress). */
  prune?: boolean;
};

export type ImportReport = { chapter: string; lessons: number; questions: number; blocks: number; pruned: number };

/** Where a lesson goes in the database. */
export type LessonTarget = {
  chapterId: string;
  /** Used with the lesson slug and question key to seed the stored shuffles (keep it stable). */
  chapterSlug: string;
  sectionId: string;
  /** Position of the lesson within its chapter (1-based). */
  position: number;
  /** true/false sets `published`; undefined leaves it unchanged (new lessons start unpublished). */
  publish?: boolean;
  /**
   * Update this existing lesson row (matched by id, so its slug may change). Without it the
   * lesson is upserted by (chapter, slug), like a chapter import.
   */
  lessonId?: string;
};

export type LessonImportReport = { id: string; questions: number; blocks: number };

function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  if (res.data === null) throw new Error(`${what}: no data`);
  return res.data;
}

/** Stable question keys: end-of-lesson quiz `quiz-N`, in-lesson checkpoints `cp-N` (in block order). */
export function lessonQuestionRows(lesson: Lesson) {
  const rows: { key: string; placement: "quiz" | "checkpoint"; position: number; q: Question }[] = [];
  lesson.quiz.forEach((q, i) => rows.push({ key: `quiz-${i + 1}`, placement: "quiz", position: i + 1, q }));
  let cp = 0;
  lesson.blocks.forEach((b) => {
    if (b.type === "checkpoint") {
      cp++;
      rows.push({ key: `cp-${cp}`, placement: "checkpoint", position: cp, q: b.question });
    }
  });
  return rows;
}

/**
 * Create or update one lesson: its row, its questions (upserted by key so students' answer
 * history survives), and its blocks (replaced wholesale — no student data points at them).
 * Questions whose key disappeared are deleted. Requires a service-role client.
 */
export async function importLesson(db: SupabaseClient, target: LessonTarget, raw: unknown): Promise<LessonImportReport> {
  const lesson: Lesson = lessonSchema.parse(raw);
  const row: Record<string, unknown> = {
    section_id: target.sectionId,
    chapter_id: target.chapterId,
    slug: lesson.slug,
    number: lesson.number ?? null,
    title: lesson.title,
    summary: lesson.summary,
    estimated_minutes: lesson.estimatedMinutes,
    position: target.position,
  };
  if (target.publish !== undefined) row.published = target.publish;

  const les = target.lessonId
    ? (must(await db.from("lessons").update(row).eq("id", target.lessonId).select("id").single(), `update lesson ${lesson.slug}`) as { id: string })
    : (must(await db.from("lessons").upsert(row, { onConflict: "chapter_id,slug" }).select("id").single(), `upsert lesson ${lesson.slug}`) as { id: string });

  // questions: end-of-lesson quiz + checkpoints, keyed so history survives re-imports
  const questionRows = lessonQuestionRows(lesson);
  const idByKey = new Map<string, string>();
  if (questionRows.length) {
    // two round trips per lesson (all questions, then all answers) instead of two per question
    const split = questionRows.map((r) => ({ r, ...splitQuestion(r.q, `${target.chapterSlug}/${lesson.slug}/${r.key}`) }));
    const saved = must(
      await db
        .from("questions")
        .upsert(
          split.map(({ r, data }) => ({ lesson_id: les.id, key: r.key, placement: r.placement, position: r.position, kind: r.q.kind, data })),
          { onConflict: "lesson_id,key" },
        )
        .select("id, key"),
      `upsert questions of ${lesson.slug}`,
    ) as { id: string; key: string }[];
    for (const s of saved) idByKey.set(s.key, s.id);
    const missing = split.find(({ r }) => !idByKey.has(r.key));
    if (missing) throw new Error(`upsert questions of ${lesson.slug}: no id returned for ${missing.r.key}`);
    must(
      await db
        .from("question_answers")
        .upsert(
          split.map(({ r, answer, explanation }) => ({ question_id: idByKey.get(r.key)!, answer, explanation })),
          { onConflict: "question_id" },
        )
        .select("question_id"),
      `upsert answers of ${lesson.slug}`,
    );
  }
  // remove questions that disappeared from the lesson
  const keys = questionRows.map((r) => r.key);
  const stale = keys.length
    ? await db.from("questions").delete().eq("lesson_id", les.id).not("key", "in", `(${keys.map((k) => `"${k}"`).join(",")})`)
    : await db.from("questions").delete().eq("lesson_id", les.id);
  if (stale.error) throw new Error(`prune questions: ${stale.error.message}`);

  // blocks: replaced wholesale (no student data points at them)
  const del = await db.from("lesson_blocks").delete().eq("lesson_id", les.id);
  if (del.error) throw new Error(`clear blocks: ${del.error.message}`);
  let cpIndex = 0;
  const blockRows = lesson.blocks.map((b, i) => {
    if (b.type === "checkpoint") {
      cpIndex++;
      return { lesson_id: les.id, position: i + 1, type: "checkpoint", data: {}, origin: b.origin, question_id: idByKey.get(`cp-${cpIndex}`) };
    }
    const { type, origin, ...rest } = b;
    return { lesson_id: les.id, position: i + 1, type, data: rest, origin, question_id: null };
  });
  if (blockRows.length) {
    const ins = await db.from("lesson_blocks").insert(blockRows);
    if (ins.error) throw new Error(`insert blocks for ${lesson.slug}: ${ins.error.message}`);
  }
  return { id: les.id, questions: questionRows.length, blocks: blockRows.length };
}

/** Database rows of one lesson, as read by the admin editor (service role: answers included). */
export type StoredLessonRows = {
  lesson: { slug: string; title: string; number: string | null; summary: string | null; estimated_minutes: number };
  blocks: { position: number; type: string; data: Record<string, unknown>; origin: "source" | "added"; question_id: string | null }[];
  questions: {
    id: string;
    key: string;
    placement: "quiz" | "checkpoint";
    position: number;
    kind: string;
    data: PublicQuestion;
    answer: { answer: SecretAnswer; explanation: string } | null;
  }[];
};

/**
 * Rebuild the AUTHORING lesson (lessonSchema shape) from its database rows — the inverse of
 * `importLesson`. The result is not validated: a lesson created in the admin may still be
 * incomplete (no blocks, fewer than 3 quiz questions). Checkpoint blocks whose question is
 * missing are dropped and reported in `warnings`.
 */
export function lessonFromRows(rows: StoredLessonRows): { lesson: Lesson; warnings: string[] } {
  const warnings: string[] = [];
  const toQuestion = (q: StoredLessonRows["questions"][number]): Question | null => {
    if (!q.answer) {
      warnings.push(`La question ${q.key} n'a pas de correction enregistrée : elle a été ignorée.`);
      return null;
    }
    try {
      return joinQuestion(q.kind, q.data, q.answer.answer, q.answer.explanation);
    } catch (e) {
      warnings.push(`${q.key} : ${(e as Error).message}`);
      return null;
    }
  };
  const byId = new Map(rows.questions.map((q) => [q.id, q]));
  const blocks: Block[] = [];
  for (const b of [...rows.blocks].sort((x, y) => x.position - y.position)) {
    if (b.type === "checkpoint") {
      const q = b.question_id ? byId.get(b.question_id) : undefined;
      const question = q ? toQuestion(q) : null;
      if (!question) {
        if (!q) warnings.push(`Le bloc ${b.position} (question intégrée) ne pointe plus vers une question : il a été retiré.`);
        continue;
      }
      blocks.push({ type: "checkpoint", question, origin: b.origin });
    } else {
      blocks.push({ ...(b.data as object), type: b.type, origin: b.origin } as Block);
    }
  }
  const quiz = rows.questions
    .filter((q) => q.placement === "quiz")
    .sort((a, b) => a.position - b.position)
    .map(toQuestion)
    .filter((q): q is Question => q !== null);
  const l = rows.lesson;
  return {
    lesson: {
      slug: l.slug,
      title: l.title,
      ...(l.number ? { number: l.number } : {}),
      estimatedMinutes: l.estimated_minutes,
      summary: l.summary ?? "",
      blocks,
      quiz,
    },
    warnings,
  };
}

/**
 * Import (create or update) one chapter into a course. Idempotent: rows are matched by slug
 * and question key, so re-importing a corrected file keeps students' progress and history.
 * Requires a service-role client.
 */
export async function importChapter(db: SupabaseClient, courseSlug: string, raw: unknown, opts: ImportOptions = {}): Promise<ImportReport> {
  const chapter: Chapter = chapterSchema.parse(raw);
  const publish = opts.publish ?? true;

  const course = must(await db.from("courses").select("id").eq("slug", courseSlug).maybeSingle(), `course ${courseSlug}`) as { id: string };

  const ch = must(
    await db
      .from("chapters")
      .upsert(
        {
          course_id: course.id,
          slug: chapter.slug,
          number: chapter.number,
          title: chapter.title,
          description: chapter.description,
          position: chapter.number,
          published: publish,
          review_notes: chapter.reviewNotes,
        },
        { onConflict: "course_id,slug" },
      )
      .select("id")
      .single(),
    "upsert chapter",
  ) as { id: string };

  let lessonPos = 0;
  let questionCount = 0;
  let blockCount = 0;
  const keptSections: string[] = [];
  const keptLessons: string[] = [];

  for (const [si, section] of chapter.sections.entries()) {
    const sec = must(
      await db
        .from("sections")
        .upsert({ chapter_id: ch.id, slug: section.slug, number: section.number ?? null, title: section.title, position: si + 1 }, { onConflict: "chapter_id,slug" })
        .select("id")
        .single(),
      `upsert section ${section.slug}`,
    ) as { id: string };
    keptSections.push(sec.id);

    for (const lesson of section.lessons) {
      lessonPos++;
      const r = await importLesson(db, { chapterId: ch.id, chapterSlug: chapter.slug, sectionId: sec.id, position: lessonPos, publish }, lesson);
      keptLessons.push(r.id);
      questionCount += r.questions;
      blockCount += r.blocks;
    }
  }

  let pruned = 0;
  if (opts.prune) {
    const goneLessons = await db.from("lessons").delete().eq("chapter_id", ch.id).not("id", "in", `(${keptLessons.join(",")})`).select("id");
    if (goneLessons.error) throw new Error(goneLessons.error.message);
    const goneSections = await db.from("sections").delete().eq("chapter_id", ch.id).not("id", "in", `(${keptSections.join(",")})`).select("id");
    if (goneSections.error) throw new Error(goneSections.error.message);
    pruned = (goneLessons.data?.length ?? 0) + (goneSections.data?.length ?? 0);
  }

  return { chapter: chapter.slug, lessons: lessonPos, questions: questionCount, blocks: blockCount, pruned };
}
