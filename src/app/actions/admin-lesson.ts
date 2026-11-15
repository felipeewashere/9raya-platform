"use server";

import { lessonSchema } from "@/content/schema";
import { importLesson } from "@/lib/content/import";
import { requireAdmin } from "@/lib/auth";
import { id, must, refreshContent, run, UserError } from "./admin-shared";

/**
 * Save a lesson edited in the admin (authoring format, validated with lessonSchema).
 * Goes through `importLesson`, the same code path as a chapter import: questions keep their
 * keys (quiz-N, cp-N) and row ids, so students' answer history survives; blocks are replaced.
 * The lesson's `published` flag and position are left unchanged.
 */
export async function saveLesson(lessonId: string, raw: unknown) {
  await requireAdmin();
  return run(async (db) => {
    const lid = id.parse(lessonId);
    const lesson = lessonSchema.parse(raw);
    const row = must(
      await db.from("lessons").select("id, section_id, chapter_id, position, chapter:chapters(slug)").eq("id", lid).maybeSingle(),
      "leçon",
    ) as unknown as { id: string; section_id: string; chapter_id: string; position: number; chapter: { slug: string } };
    const { data: clash } = await db.from("lessons").select("id").eq("chapter_id", row.chapter_id).eq("slug", lesson.slug).neq("id", lid).limit(1);
    if (clash?.length) throw new UserError(`Le slug « ${lesson.slug} » est déjà utilisé par une autre leçon de ce chapitre.`);
    const report = await importLesson(
      db,
      { chapterId: row.chapter_id, chapterSlug: row.chapter.slug, sectionId: row.section_id, position: row.position, lessonId: lid },
      lesson,
    );
    refreshContent();
    return report;
  });
}
