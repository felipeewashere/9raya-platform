import { beforeAll, describe, expect, it } from "vitest";
import { as, createTestDb, createUser, type Db } from "../db/harness";

let db: Db;
let admin: string;
let student: string;
let courseId: string;
let lessonId: string;
let q1: string;
let q2: string;

beforeAll(async () => {
  db = await createTestDb();
  admin = await createUser(db, "prof@example.com");
  student = await createUser(db, "etu@example.com");
  await db.query("update public.profiles set role = 'admin' where id = $1", [admin]);
  courseId = (await db.query<{ id: string }>("select id from public.courses where slug = 'algebre-1'")).rows[0].id;
  const ch = await db.query<{ id: string }>("insert into public.chapters (course_id, slug, number, title, position, published) values ($1, 'c', 1, 'C', 1, true) returning id", [courseId]);
  const sec = await db.query<{ id: string }>("insert into public.sections (chapter_id, slug, title, position) values ($1, 's', 'S', 1) returning id", [ch.rows[0].id]);
  lessonId = (
    await db.query<{ id: string }>("insert into public.lessons (section_id, chapter_id, slug, title, position, published) values ($1, $2, 'l', 'L', 1, true) returning id", [
      sec.rows[0].id,
      ch.rows[0].id,
    ])
  ).rows[0].id;
  q1 = (await db.query<{ id: string }>("insert into public.questions (lesson_id, key, placement, position, kind, data) values ($1, 'quiz-1', 'quiz', 1, 'true_false', '{}') returning id", [lessonId])).rows[0].id;
  q2 = (await db.query<{ id: string }>("insert into public.questions (lesson_id, key, placement, position, kind, data) values ($1, 'quiz-2', 'quiz', 2, 'true_false', '{}') returning id", [lessonId])).rows[0].id;

  // one finished attempt (2/2, passed) and one abandoned attempt (still open)
  const done = await db.query<{ id: string }>(
    "insert into public.quiz_attempts (user_id, lesson_id, status, score, total, passed, finished_at) values ($1, $2, 'finished', 2, 2, true, now()) returning id",
    [student, lessonId],
  );
  await db.query("insert into public.quiz_attempts (user_id, lesson_id, status, score, total, passed) values ($1, $2, 'open', 0, 2, false)", [student, lessonId]);
  await db.query("insert into public.answer_events (user_id, question_id, attempt_id, correct) values ($1, $2, $3, true), ($1, $4, $3, true)", [student, q1, done.rows[0].id, q2]);
});

describe("admin analytics", () => {
  it("counts only finished quiz attempts", async () => {
    const r = await as(db, "authenticated", admin, (tx) => tx.query<{ attempts: number; avg_score: string; pass_rate: string }>("select * from public.admin_lesson_stats($1)", [courseId]));
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].attempts).toBe(1);
    expect(Number(r.rows[0].avg_score)).toBe(100);
    expect(Number(r.rows[0].pass_rate)).toBe(100);
  });

  it("reports per-question correct rates, null when never answered", async () => {
    await db.query("insert into public.questions (lesson_id, key, placement, position, kind, data) values ($1, 'cp-1', 'checkpoint', 1, 'true_false', '{}')", [lessonId]);
    const r = await as(db, "authenticated", admin, (tx) => tx.query<{ question_id: string; answered: number; correct_rate: string | null }>("select * from public.admin_question_stats($1)", [lessonId]));
    expect(r.rows.map((x) => x.answered)).toEqual([1, 1, 0]);
    expect(Number(r.rows[0].correct_rate)).toBe(100);
    expect(r.rows[2].correct_rate).toBeNull();
  });

  it("is forbidden to students", async () => {
    await expect(as(db, "authenticated", student, (tx) => tx.query("select * from public.admin_question_stats($1)", [lessonId]))).rejects.toThrow(/forbidden/);
  });

  it("creates a public media bucket writable by admins only", async () => {
    const b = await db.query<{ public: boolean }>("select public from storage.buckets where id = 'media'");
    expect(b.rows[0].public).toBe(true);
    await as(db, "authenticated", admin, (tx) => tx.query("insert into storage.objects (bucket_id, name) values ('media', 'courses/a.png')"));
    await expect(as(db, "authenticated", student, (tx) => tx.query("insert into storage.objects (bucket_id, name) values ('media', 'courses/b.png')"))).rejects.toThrow(/row-level security/);
    const anon = await as(db, "anon", null, (tx) => tx.query("select name from storage.objects where bucket_id = 'media'"));
    expect(anon.rows).toHaveLength(1);
  });
});
