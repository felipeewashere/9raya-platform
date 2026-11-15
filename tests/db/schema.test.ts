import { beforeAll, describe, expect, it } from "vitest";
import { as, createTestDb, createUser, type Db } from "./harness";

let db: Db;
let student: string;
let other: string;
let admin: string;
let lessonId: string;
let questionId: string;
let chapterId: string;

beforeAll(async () => {
  db = await createTestDb();
  student = await createUser(db, "amine@example.com", { full_name: "Amine" });
  other = await createUser(db, "sara@example.com");
  admin = await createUser(db, "prof@example.com");
  await db.query("update public.profiles set role = 'admin' where id = $1", [admin]);

  const course = await db.query<{ id: string }>("select id from public.courses where slug = 'algebre-1'");
  const ch = await db.query<{ id: string }>(
    "insert into public.chapters (course_id, slug, number, title, position, published) values ($1, 'ch1', 1, 'Chapitre 1', 1, true) returning id",
    [course.rows[0].id],
  );
  chapterId = ch.rows[0].id;
  const sec = await db.query<{ id: string }>(
    "insert into public.sections (chapter_id, slug, title, position) values ($1, 's1', 'Section', 1) returning id",
    [chapterId],
  );
  const les = await db.query<{ id: string }>(
    "insert into public.lessons (section_id, chapter_id, slug, title, position, published) values ($1, $2, 'l1', 'Leçon 1', 1, true) returning id",
    [sec.rows[0].id, chapterId],
  );
  lessonId = les.rows[0].id;
  const q = await db.query<{ id: string }>(
    `insert into public.questions (lesson_id, key, placement, position, kind, data)
     values ($1, 'quiz-1', 'quiz', 1, 'true_false', '{"prompt":"0 est neutre pour +"}') returning id`,
    [lessonId],
  );
  questionId = q.rows[0].id;
  await db.query("insert into public.question_answers (question_id, answer, explanation) values ($1, '{\"value\":true}', 'car x+0=x')", [
    questionId,
  ]);
});

describe("profiles", () => {
  it("creates a profile with a unique username for each new user", async () => {
    const r = await db.query<{ username: string; full_name: string | null }>(
      "select username, full_name from public.profiles where id = $1",
      [student],
    );
    expect(r.rows[0]).toEqual({ username: "amine", full_name: "Amine" });
    const dup = await createUser(db, "amine@other.org");
    const r2 = await db.query<{ username: string }>("select username from public.profiles where id = $1", [dup]);
    expect(r2.rows[0].username).toBe("amine1");
  });

  it("lets a student edit their username but not their role", async () => {
    await as(db, "authenticated", student, (tx) =>
      tx.query("update public.profiles set username = 'amine_math' where id = $1", [student]),
    );
    await expect(
      as(db, "authenticated", student, (tx) => tx.query("update public.profiles set role = 'admin' where id = $1", [student])),
    ).rejects.toThrow(/permission denied/);
    const r = await db.query<{ role: string; username: string }>("select role, username from public.profiles where id = $1", [student]);
    expect(r.rows[0]).toEqual({ role: "student", username: "amine_math" });
  });

  it("stores the student's year, section and group, and rejects unknown groups", async () => {
    await as(db, "authenticated", student, (tx) =>
      tx.query("update public.profiles set study_year = 'AP1', section = 1, group_code = 'G3' where id = $1", [student]),
    );
    const r = await db.query<{ study_year: string; section: number; group_code: string }>(
      "select study_year, section, group_code from public.profiles where id = $1",
      [student],
    );
    expect(r.rows[0]).toEqual({ study_year: "AP1", section: 1, group_code: "G3" });
    await expect(
      as(db, "authenticated", student, (tx) => tx.query("update public.profiles set section = 2, group_code = 'G7' where id = $1", [student])),
    ).rejects.toThrow();
  });

  it("hides other students' profiles", async () => {
    const r = await as(db, "authenticated", student, (tx) => tx.query("select id from public.profiles"));
    expect(r.rows.map((x) => (x as { id: string }).id)).toEqual([student]);
  });
});

describe("content access", () => {
  it("shows the course catalog to anonymous visitors, but not lessons", async () => {
    const courses = await as(db, "anon", null, (tx) => tx.query("select slug from public.courses order by position"));
    expect(courses.rows.map((x) => (x as { slug: string }).slug)).toEqual(["algebre-1", "analyse-1", "mecanique-du-point"]);
    const lessons = await as(db, "anon", null, (tx) => tx.query("select id from public.lessons"));
    expect(lessons.rows).toHaveLength(0);
    const blocks = await as(db, "anon", null, (tx) => tx.query("select id from public.lesson_blocks"));
    expect(blocks.rows).toHaveLength(0);
  });

  it("lets students read questions but never the correct answers", async () => {
    const q = await as(db, "authenticated", student, (tx) => tx.query("select id, data from public.questions"));
    expect(q.rows).toHaveLength(1);
    const a = await as(db, "authenticated", student, (tx) => tx.query("select * from public.question_answers"));
    expect(a.rows).toHaveLength(0);
    const aAdmin = await as(db, "authenticated", admin, (tx) => tx.query("select * from public.question_answers"));
    expect(aAdmin.rows).toHaveLength(1);
  });

  it("hides unpublished lessons from students", async () => {
    await db.query("update public.lessons set published = false where id = $1", [lessonId]);
    const r = await as(db, "authenticated", student, (tx) => tx.query("select id from public.lessons"));
    expect(r.rows).toHaveLength(0);
    const rAdmin = await as(db, "authenticated", admin, (tx) => tx.query("select id from public.lessons"));
    expect(rAdmin.rows).toHaveLength(1);
    await db.query("update public.lessons set published = true where id = $1", [lessonId]);
  });

  it("stops students from writing content", async () => {
    const r = await as(db, "authenticated", student, (tx) =>
      tx.query("update public.lessons set title = 'hacked' where id = $1", [lessonId]),
    );
    expect(r.affectedRows).toBe(0);
  });
});

describe("progress and XP", () => {
  it("lets students save their reading position but not mark lessons completed", async () => {
    await as(db, "authenticated", student, (tx) =>
      tx.query("insert into public.lesson_progress (user_id, lesson_id, last_block) values ($1, $2, 3)", [student, lessonId]),
    );
    await expect(
      as(db, "authenticated", student, (tx) => tx.query("update public.lesson_progress set status = 'completed' where user_id = $1", [student])),
    ).rejects.toThrow(/permission denied/);
  });

  it("refuses direct XP writes and XP functions from the browser", async () => {
    await expect(
      as(db, "authenticated", student, (tx) =>
        tx.query("insert into public.xp_events (user_id, amount, reason, ref) values ($1, 999, 'quiz_pass', 'x')", [student]),
      ),
    ).rejects.toThrow();
    await expect(
      as(db, "authenticated", student, (tx) => tx.query("select public.award_xp($1, 999, 'quiz_pass', 'x')", [student])),
    ).rejects.toThrow(/permission denied/);
  });

  it("awards XP once per reason and reference (no farming)", async () => {
    const first = await as(db, "service_role", null, (tx) =>
      tx.query<{ award_xp: number }>("select public.award_xp($1, 20, 'quiz_pass', $2)", [student, lessonId]),
    );
    const again = await as(db, "service_role", null, (tx) =>
      tx.query<{ award_xp: number }>("select public.award_xp($1, 20, 'quiz_pass', $2)", [student, lessonId]),
    );
    expect(first.rows[0].award_xp).toBe(20);
    expect(again.rows[0].award_xp).toBe(0);
    const total = await db.query<{ sum: number }>("select sum(amount)::int as sum from public.xp_events where user_id = $1", [student]);
    expect(total.rows[0].sum).toBe(20);
  });

  it("computes current and longest streaks from active days", async () => {
    const today = (await db.query<{ d: string }>("select public.user_local_day($1)::text as d", [other])).rows[0].d;
    // active: today, yesterday, 2 days ago (3-day streak) and an older 4-day run
    await db.query(
      `insert into public.activity_days (user_id, day, xp)
       select $1, $2::date - g, 10 from unnest(array[0,1,2,10,11,12,13]) as g`,
      [other, today],
    );
    const s = await as(db, "service_role", null, (tx) =>
      tx.query<{ current_streak: number; longest_streak: number; active_today: boolean }>("select * from public.get_streak($1)", [other]),
    );
    expect(s.rows[0]).toEqual({ current_streak: 3, longest_streak: 4, active_today: true });
  });

  it("keeps the streak alive until the end of the day after the last activity", async () => {
    const u = await createUser(db, "yesterday@example.com");
    await db.query("insert into public.activity_days (user_id, day, xp) values ($1, public.user_local_day($1) - 1, 5), ($1, public.user_local_day($1) - 2, 5)", [u]);
    const s = await as(db, "service_role", null, (tx) => tx.query<Record<string, unknown>>("select * from public.get_streak($1)", [u]));
    expect(s.rows[0].current_streak).toBe(2);
    expect(s.rows[0].active_today).toBe(false);
    const b = await as(db, "service_role", null, (tx) => tx.query<{ award_xp: number }>("select public.award_xp($1, 10, 'lesson_complete', 'l9')", [u]));
    // 10 for the lesson + 5 streak bonus (streak now 3 days)
    expect(b.rows[0].award_xp).toBe(15);
    const again = await as(db, "service_role", null, (tx) => tx.query<{ award_xp: number }>("select public.award_xp($1, 10, 'lesson_complete', 'l10')", [u]));
    expect(again.rows[0].award_xp).toBe(10);
  });

  it("grants achievements once, when their conditions are met", async () => {
    await db.query("update public.lesson_progress set status = 'completed', completed_at = now() where user_id = $1", [student]);
    for (let i = 0; i < 5; i++)
      await db.query("insert into public.answer_events (user_id, question_id, correct) values ($1, $2, true)", [student, questionId]);
    const r = await as(db, "service_role", null, (tx) => tx.query<{ evaluate_achievements: string }>("select * from public.evaluate_achievements($1)", [student]));
    expect(r.rows.map((x) => x.evaluate_achievements).sort()).toEqual(["first-lesson", "streak-5-correct"]);
    const again = await as(db, "service_role", null, (tx) => tx.query("select * from public.evaluate_achievements($1)", [student]));
    expect(again.rows).toHaveLength(0);
    const mine = await as(db, "authenticated", student, (tx) => tx.query("select achievement_id from public.user_achievements"));
    expect(mine.rows).toHaveLength(2);
    const theirs = await as(db, "authenticated", other, (tx) => tx.query("select achievement_id from public.user_achievements"));
    expect(theirs.rows).toHaveLength(0);
  });

  it("reports chapter progress for the signed-in student", async () => {
    const course = await db.query<{ id: string }>("select id from public.courses where slug = 'algebre-1'");
    const r = await as(db, "authenticated", student, (tx) =>
      tx.query<Record<string, unknown>>("select * from public.my_chapter_progress($1)", [course.rows[0].id]),
    );
    expect(r.rows).toEqual([{ chapter_id: chapterId, total_lessons: 1, completed_lessons: 1 }]);
  });
});

describe("skipping and leaderboard", () => {
  it("does not count skipped lessons for achievements", async () => {
    const u = await createUser(db, "skipper@example.com");
    await db.query("insert into public.lesson_progress (user_id, lesson_id, status, skipped, completed_at) values ($1, $2, 'completed', true, now())", [u, lessonId]);
    const r = await as(db, "service_role", null, (tx) => tx.query("select * from public.evaluate_achievements($1)", [u]));
    expect(r.rows).toHaveLength(0);
  });

  it("ranks students by XP for a period and always includes the caller", async () => {
    const a = await createUser(db, "lb-a@example.com");
    const b = await createUser(db, "lb-b@example.com");
    const c = await createUser(db, "lb-c@example.com");
    await db.query(
      `insert into public.xp_events (user_id, amount, reason, ref, created_at) values
         ($1, 100, 'lesson_complete', 'old', now() - interval '30 days'),
         ($2, 30, 'lesson_complete', 'today', now()),
         ($1, 5, 'quiz_pass', 'today', now())`,
      [a, b],
    );
    const all = await as(db, "authenticated", c, (tx) => tx.query<{ username: string; xp: number; rank: number; is_me: boolean }>("select * from public.leaderboard('tout', 2)"));
    const names = all.rows.map((r) => r.username);
    expect(names.slice(0, 2)).toEqual(["lb-a", "lb-b"]);
    expect(all.rows.find((r) => r.is_me)?.xp).toBe(0); // caller shown even with 0 XP
    const today = await as(db, "authenticated", c, (tx) => tx.query<{ username: string; xp: number }>("select * from public.leaderboard('jour', 10)"));
    expect(today.rows.filter((r) => r.xp > 0).map((r) => [r.username, r.xp])).toContainEqual(["lb-b", 30]);
    expect(today.rows.find((r) => r.username === "lb-a")?.xp).toBe(5);
    await expect(as(db, "anon", null, (tx) => tx.query("select * from public.leaderboard('tout', 10)"))).rejects.toThrow(/permission denied/);
  });
});

describe("bookmarks, notes and admin tools", () => {
  it("keeps bookmarks and notes private", async () => {
    await as(db, "authenticated", student, (tx) =>
      tx.query("insert into public.bookmarks (user_id, lesson_id) values ($1, $2)", [student, lessonId]),
    );
    await expect(
      as(db, "authenticated", other, (tx) => tx.query("insert into public.bookmarks (user_id, lesson_id) values ($1, $2)", [student, lessonId])),
    ).rejects.toThrow(/row-level security/);
    const r = await as(db, "authenticated", other, (tx) => tx.query("select * from public.bookmarks"));
    expect(r.rows).toHaveLength(0);
  });

  it("restricts analytics to admins", async () => {
    const course = await db.query<{ id: string }>("select id from public.courses where slug = 'algebre-1'");
    await expect(
      as(db, "authenticated", student, (tx) => tx.query("select * from public.admin_lesson_stats($1)", [course.rows[0].id])),
    ).rejects.toThrow(/forbidden/);
    const r = await as(db, "authenticated", admin, (tx) => tx.query("select * from public.admin_students()"));
    expect(r.rows.length).toBeGreaterThanOrEqual(3);
  });
});
