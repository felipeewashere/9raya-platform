import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { chapterSchema, type Chapter } from "@/content/schema";
import { importChapter, importLesson } from "@/lib/content/import";
import { FakeDb } from "./fake-db";

const dir = join(__dirname, "..", "..", "content", "algebre-1");
const files = readdirSync(dir).filter((f) => /^ch0\d+\.json$/.test(f)).sort();
const load = (f: string) => JSON.parse(readFileSync(join(dir, f), "utf8"));

let db: FakeDb;
beforeEach(() => {
  db = new FakeDb();
  db.rows("courses").push({ id: "course-1", slug: "algebre-1" });
});

const lessonId = (db: FakeDb, slug: string) => db.rows("lessons").find((l) => l.slug === slug)!.id as string;
const questionIds = (db: FakeDb, id: string) => Object.fromEntries(db.rows("questions").filter((q) => q.lesson_id === id).map((q) => [q.key, q.id]));

describe("history preservation", () => {
  it("re-importing a chapter keeps question ids and does not duplicate rows", async () => {
    await importChapter(db.client(), "algebre-1", load(files[0]));
    const counts = Object.fromEntries(Object.entries(db.tables).map(([t, r]) => [t, r.length]));
    const ids = db.rows("questions").map((q) => q.id).sort();
    await importChapter(db.client(), "algebre-1", load(files[0]));
    expect(Object.fromEntries(Object.entries(db.tables).map(([t, r]) => [t, r.length]))).toEqual(counts);
    expect(db.rows("questions").map((q) => q.id).sort()).toEqual(ids);
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
