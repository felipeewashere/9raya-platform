import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { chapterSchema, lessonSchema, type Chapter, type Lesson } from "@/content/schema";
import { importChapter, importLesson, lessonFromRows, type StoredLessonRows } from "@/lib/content/import";
import { FakeDb } from "./fake-db";

const dir = join(__dirname, "..", "..", "content", "algebre-1");
const files = readdirSync(dir).filter((f) => /^ch0\d+\.json$/.test(f)).sort();
const load = (f: string) => JSON.parse(readFileSync(join(dir, f), "utf8"));

let db: FakeDb;
beforeEach(() => {
  db = new FakeDb();
  db.rows("courses").push({ id: "course-1", slug: "algebre-1" });
});

/** What the admin editor reads for one lesson. */
function stored(db: FakeDb, lessonId: string): StoredLessonRows {
  const lesson = db.rows("lessons").find((l) => l.id === lessonId)!;
  return {
    lesson: lesson as unknown as StoredLessonRows["lesson"],
    blocks: db.rows("lesson_blocks").filter((b) => b.lesson_id === lessonId) as unknown as StoredLessonRows["blocks"],
    questions: db
      .rows("questions")
      .filter((q) => q.lesson_id === lessonId)
      .map((q) => {
        const a = db.rows("question_answers").find((x) => x.question_id === q.id);
        return { ...q, answer: a ? { answer: a.answer, explanation: a.explanation } : null };
      }) as unknown as StoredLessonRows["questions"],
  };
}

const lessonId = (db: FakeDb, slug: string) => db.rows("lessons").find((l) => l.slug === slug)!.id as string;
const questionIds = (db: FakeDb, id: string) => Object.fromEntries(db.rows("questions").filter((q) => q.lesson_id === id).map((q) => [q.key, q.id]));

describe.each(files)("importChapter + lessonFromRows (%s)", (file) => {
  it("rebuilds every imported lesson exactly as authored", async () => {
    const chapter: Chapter = chapterSchema.parse(load(file));
    const report = await importChapter(db.client(), "algebre-1", load(file));
    expect(report.lessons).toBe(chapter.sections.flatMap((s) => s.lessons).length);
    for (const lesson of chapter.sections.flatMap((s) => s.lessons)) {
      const { lesson: rebuilt, warnings } = lessonFromRows(stored(db, lessonId(db, lesson.slug)));
      expect(warnings).toEqual([]);
      expect(rebuilt).toEqual(lesson);
      expect(lessonSchema.parse(rebuilt)).toEqual(lesson);
    }
  });
});

describe("history preservation", () => {
  it("re-importing a chapter keeps question ids and does not duplicate rows", async () => {
    await importChapter(db.client(), "algebre-1", load(files[0]));
    const counts = Object.fromEntries(Object.entries(db.tables).map(([t, r]) => [t, r.length]));
    const ids = db.rows("questions").map((q) => q.id).sort();
    await importChapter(db.client(), "algebre-1", load(files[0]));
    expect(Object.fromEntries(Object.entries(db.tables).map(([t, r]) => [t, r.length]))).toEqual(counts);
    expect(db.rows("questions").map((q) => q.id).sort()).toEqual(ids);
  });

  it("saving an edited lesson from the editor updates in place and keeps keys", async () => {
    const chapter: Chapter = chapterSchema.parse(load(files[0]));
    await importChapter(db.client(), "algebre-1", load(files[0]), { publish: false });
    const original = chapter.sections[0].lessons[0];
    const id = lessonId(db, original.slug);
    const before = questionIds(db, id);
    const row = db.rows("lessons").find((l) => l.id === id)!;
    row.published = true; // published from the admin since the import

    const { lesson } = lessonFromRows(stored(db, id));
    const checkpoints = lesson.blocks.filter((b) => b.type === "checkpoint").length;
    const edited: Lesson = {
      ...lesson,
      slug: "nouveau-slug",
      title: "Titre modifié",
      blocks: [{ type: "text", md: "Nouveau paragraphe $x^2$", origin: "added" }, ...lesson.blocks],
      quiz: lesson.quiz.map((q, i) => (i === 0 ? { ...q, explanation: "Corrigée." } : q)),
    };
    const r = await importLesson(
      db.client(),
      { chapterId: row.chapter_id as string, chapterSlug: chapter.slug, sectionId: row.section_id as string, position: row.position as number, lessonId: id },
      edited,
    );
    expect(r.id).toBe(id);
    expect(db.rows("lessons").filter((l) => l.chapter_id === row.chapter_id)).toHaveLength(chapter.sections.flatMap((s) => s.lessons).length);
    const after = db.rows("lessons").find((l) => l.id === id)!;
    expect(after).toMatchObject({ slug: "nouveau-slug", title: "Titre modifié", published: true });
    // same question rows (ids) for the same keys → answer history survives
    expect(questionIds(db, id)).toEqual(before);
    expect(Object.keys(before).filter((k) => k.startsWith("cp-"))).toHaveLength(checkpoints);

    const { lesson: rebuilt } = lessonFromRows(stored(db, id));
    expect(rebuilt).toEqual(lessonSchema.parse(edited));
  });

  it("removing a checkpoint deletes only its question", async () => {
    const chapter: Chapter = chapterSchema.parse(load(files[0]));
    await importChapter(db.client(), "algebre-1", load(files[0]));
    const original = chapter.sections.flatMap((s) => s.lessons).find((l) => l.blocks.some((b) => b.type === "checkpoint"))!;
    const id = lessonId(db, original.slug);
    const row = db.rows("lessons").find((l) => l.id === id)!;
    const before = questionIds(db, id);
    const cps = original.blocks.filter((b) => b.type === "checkpoint").length;
    let seen = 0;
    const edited = { ...original, blocks: original.blocks.filter((b) => !(b.type === "checkpoint" && ++seen === cps)) };
    await importLesson(db.client(), { chapterId: row.chapter_id as string, chapterSlug: chapter.slug, sectionId: row.section_id as string, position: 1, lessonId: id }, edited);
    const after = questionIds(db, id);
    expect(after[`cp-${cps}`]).toBeUndefined();
    const { [`cp-${cps}`]: _gone, ...rest } = before;
    void _gone;
    expect(after).toEqual(rest);
  });

  it("imports drafts unpublished", async () => {
    await importChapter(db.client(), "algebre-1", load(files[0]), { publish: false });
    expect(db.rows("chapters")[0].published).toBe(false);
    expect(db.rows("lessons").every((l) => l.published === false)).toBe(true);
  });

  it("rejects invalid lessons before writing anything", async () => {
    await expect(
      importLesson(db.client(), { chapterId: "c", chapterSlug: "c", sectionId: "s", position: 1 }, { slug: "Bad Slug", title: "", blocks: [], quiz: [] }),
    ).rejects.toThrow();
    expect(db.rows("lessons")).toHaveLength(0);
  });
});
