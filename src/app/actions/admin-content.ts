"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { id, ids, must, ok, optText, optUrl, refreshContent, run, safeFileName, slug, UserError, type AdminDb } from "./admin-shared";

// ------------------------------------------------------------------ helpers

async function nextPosition(db: AdminDb, table: string, column: string, value: string) {
  const { data } = await db.from(table).select("position").eq(column, value).order("position", { ascending: false }).limit(1);
  return (((data ?? [])[0] as { position?: number } | undefined)?.position ?? 0) + 1;
}

/** Re-number every lesson of a chapter 1..N following section order, then lesson order. */
async function renumberChapterLessons(db: AdminDb, chapterId: string, sectionOverride?: { sectionId: string; ids: string[] }) {
  const { data: sections, error } = await db.from("sections").select("id, position, lessons(id, position)").eq("chapter_id", chapterId).order("position");
  if (error) throw new Error(error.message);
  let pos = 0;
  const updates: PromiseLike<{ error: { message: string } | null }>[] = [];
  for (const s of (sections ?? []) as { id: string; lessons: { id: string; position: number }[] }[]) {
    const order =
      sectionOverride && sectionOverride.sectionId === s.id ? sectionOverride.ids : [...s.lessons].sort((a, b) => a.position - b.position).map((l) => l.id);
    for (const lessonId of order) {
      pos++;
      const p = pos;
      const current = s.lessons.find((l) => l.id === lessonId);
      if (current && current.position !== p) updates.push(db.from("lessons").update({ position: p }).eq("id", lessonId));
    }
  }
  for (const r of await Promise.all(updates)) ok(r, "réordonner les leçons");
}

async function reorder(db: AdminDb, table: string, parentColumn: string, parentId: string, list: string[]) {
  const { data, error } = await db.from(table).select("id").eq(parentColumn, parentId);
  if (error) throw new Error(error.message);
  const existing = new Set(((data ?? []) as { id: string }[]).map((r) => r.id));
  if (list.length !== existing.size || !list.every((x) => existing.has(x))) throw new UserError("La liste a changé entre-temps : recharge la page.");
  const res = await Promise.all(list.map((rowId, i) => db.from(table).update({ position: i + 1 }).eq("id", rowId)));
  for (const r of res) ok(r, "réordonner");
}

// ------------------------------------------------------------------ semesters

const semesterInput = z.object({
  id: id.optional(),
  title: z.string().trim().min(1, "Titre requis.").max(120),
  slug,
  description: optText(1000),
  published: z.boolean(),
});

export async function saveSemester(input: z.input<typeof semesterInput>) {
  await requireAdmin();
  return run(async (db) => {
    const v = semesterInput.parse(input);
    const row = { title: v.title, slug: v.slug, description: v.description, published: v.published };
    if (v.id) {
      must(await db.from("semesters").update(row).eq("id", v.id).select("id").single(), "semestre");
    } else {
      const { data } = await db.from("semesters").select("position").order("position", { ascending: false }).limit(1);
      const position = (((data ?? [])[0] as { position?: number } | undefined)?.position ?? 0) + 1;
      must(await db.from("semesters").insert({ ...row, position }).select("id").single(), "créer le semestre");
    }
    refreshContent();
    return null;
  });
}

export async function deleteSemester(semesterId: string) {
  await requireAdmin();
  return run(async (db) => {
    const sid = id.parse(semesterId);
    const { count } = await db.from("courses").select("id", { count: "exact", head: true }).eq("semester_id", sid);
    if (count) throw new UserError("Ce semestre contient encore des cours : déplace-les ou supprime-les d'abord.");
    ok(await db.from("semesters").delete().eq("id", sid), "supprimer le semestre");
    refreshContent();
    return null;
  });
}

export async function reorderSemesters(list: string[]) {
  await requireAdmin();
  return run(async (db) => {
    const v = ids.parse(list);
    const res = await Promise.all(v.map((rowId, i) => db.from("semesters").update({ position: i + 1 }).eq("id", rowId)));
    for (const r of res) ok(r, "réordonner");
    refreshContent();
    return null;
  });
}

// ------------------------------------------------------------------ courses

const courseInput = z.object({
  id: id.optional(),
  semester_id: id,
  title: z.string().trim().min(1, "Titre requis.").max(120),
  short_title: optText(40),
  slug,
  description: optText(2000),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur au format #RRGGBB."),
  status: z.enum(["draft", "published", "coming_soon"]),
  sequential: z.boolean(),
  video_url: optUrl,
  cover_url: optUrl,
});

export async function saveCourse(input: z.input<typeof courseInput>) {
  await requireAdmin();
  return run(async (db) => {
    const { id: courseId, ...row } = courseInput.parse(input);
    if (courseId) {
      must(await db.from("courses").update(row).eq("id", courseId).select("id").single(), "cours");
      refreshContent();
      return { id: courseId };
    }
    const position = await nextPosition(db, "courses", "semester_id", row.semester_id);
    const created = must(await db.from("courses").insert({ ...row, position }).select("id").single(), "créer le cours") as { id: string };
    refreshContent();
    return { id: created.id };
  });
}

export async function setCourseStatus(courseId: string, status: "draft" | "published" | "coming_soon") {
  await requireAdmin();
  return run(async (db) => {
    const v = z.object({ id, status: z.enum(["draft", "published", "coming_soon"]) }).parse({ id: courseId, status });
    must(await db.from("courses").update({ status: v.status }).eq("id", v.id).select("id").single(), "cours");
    refreshContent();
    return null;
  });
}

export async function deleteCourse(courseId: string) {
  await requireAdmin();
  return run(async (db) => {
    const cid = id.parse(courseId);
    // storage objects of its resources go too (rows cascade)
    const { data: res } = await db.from("resources").select("storage_path").eq("course_id", cid);
    const paths = ((res ?? []) as { storage_path: string }[]).map((r) => r.storage_path);
    if (paths.length) await db.storage.from("resources").remove(paths);
    ok(await db.from("courses").delete().eq("id", cid), "supprimer le cours");
    refreshContent();
    return null;
  });
}

export async function reorderCourses(semesterId: string, list: string[]) {
  await requireAdmin();
  return run(async (db) => {
    await reorder(db, "courses", "semester_id", id.parse(semesterId), ids.parse(list));
    refreshContent();
    return null;
  });
}

// ------------------------------------------------------------------ chapters

const chapterInput = z.object({
  id: id.optional(),
  course_id: id,
  title: z.string().trim().min(1, "Titre requis.").max(160),
  slug,
  number: z.number().int().min(1, "Numéro ≥ 1.").max(99),
  description: optText(2000),
  video_url: optUrl,
  published: z.boolean(),
});

export async function saveChapter(input: z.input<typeof chapterInput>) {
  await requireAdmin();
  return run(async (db) => {
    const { id: chapterId, ...row } = chapterInput.parse(input);
    if (chapterId) {
      const { course_id: _ignored, ...rest } = row;
      void _ignored;
      must(await db.from("chapters").update(rest).eq("id", chapterId).select("id").single(), "chapitre");
      refreshContent();
      return { id: chapterId };
    }
    const position = await nextPosition(db, "chapters", "course_id", row.course_id);
    const created = must(await db.from("chapters").insert({ ...row, position }).select("id").single(), "créer le chapitre") as { id: string };
    refreshContent();
    return { id: created.id };
  });
}

export async function setChapterPublished(chapterId: string, published: boolean, withLessons = false) {
  await requireAdmin();
  return run(async (db) => {
    const v = z.object({ id, published: z.boolean(), withLessons: z.boolean() }).parse({ id: chapterId, published, withLessons });
    must(await db.from("chapters").update({ published: v.published }).eq("id", v.id).select("id").single(), "chapitre");
    if (v.withLessons) ok(await db.from("lessons").update({ published: v.published }).eq("chapter_id", v.id), "leçons");
    refreshContent();
    return null;
  });
}

export async function deleteChapter(chapterId: string) {
  await requireAdmin();
  return run(async (db) => {
    ok(await db.from("chapters").delete().eq("id", id.parse(chapterId)), "supprimer le chapitre");
    refreshContent();
    return null;
  });
}

export async function reorderChapters(courseId: string, list: string[]) {
  await requireAdmin();
  return run(async (db) => {
    await reorder(db, "chapters", "course_id", id.parse(courseId), ids.parse(list));
    refreshContent();
    return null;
  });
}

// ------------------------------------------------------------------ sections

const sectionInput = z.object({
  id: id.optional(),
  chapter_id: id,
  title: z.string().trim().min(1, "Titre requis.").max(160),
  slug,
  number: optText(20),
});

export async function saveSection(input: z.input<typeof sectionInput>) {
  await requireAdmin();
  return run(async (db) => {
    const { id: sectionId, ...row } = sectionInput.parse(input);
    if (sectionId) {
      must(await db.from("sections").update({ title: row.title, slug: row.slug, number: row.number }).eq("id", sectionId).select("id").single(), "section");
    } else {
      const position = await nextPosition(db, "sections", "chapter_id", row.chapter_id);
      must(await db.from("sections").insert({ ...row, position }).select("id").single(), "créer la section");
    }
    refreshContent();
    return null;
  });
}

export async function deleteSection(sectionId: string) {
  await requireAdmin();
  return run(async (db) => {
    const sid = id.parse(sectionId);
    const sec = must(await db.from("sections").select("chapter_id").eq("id", sid).maybeSingle(), "section") as { chapter_id: string };
    ok(await db.from("sections").delete().eq("id", sid), "supprimer la section");
    await renumberChapterLessons(db, sec.chapter_id);
    refreshContent();
    return null;
  });
}

export async function reorderSections(chapterId: string, list: string[]) {
  await requireAdmin();
  return run(async (db) => {
    const cid = id.parse(chapterId);
    await reorder(db, "sections", "chapter_id", cid, ids.parse(list));
    await renumberChapterLessons(db, cid);
    refreshContent();
    return null;
  });
}

// ------------------------------------------------------------------ lessons (metadata; content is saved by the lesson editor)

const lessonMetaInput = z.object({
  id: id.optional(),
  section_id: id,
  title: z.string().trim().min(1, "Titre requis.").max(200),
  slug,
  number: optText(20),
  summary: optText(1000),
  estimated_minutes: z.number().int().min(1, "Durée ≥ 1 min.").max(120, "Durée ≤ 120 min."),
  published: z.boolean(),
});

export async function saveLessonMeta(input: z.input<typeof lessonMetaInput>) {
  await requireAdmin();
  return run(async (db) => {
    const { id: lessonId, ...row } = lessonMetaInput.parse(input);
    const sec = must(await db.from("sections").select("id, chapter_id").eq("id", row.section_id).maybeSingle(), "section") as { id: string; chapter_id: string };
    if (lessonId) {
      const current = must(await db.from("lessons").select("section_id, chapter_id").eq("id", lessonId).maybeSingle(), "leçon") as { section_id: string; chapter_id: string };
      if (current.chapter_id !== sec.chapter_id) throw new UserError("Une leçon ne peut changer de section qu'à l'intérieur de son chapitre.");
      must(await db.from("lessons").update(row).eq("id", lessonId).select("id").single(), "leçon");
      if (current.section_id !== row.section_id) {
        // moved to another section: put it at the end of that section
        const { data: sibs } = await db.from("lessons").select("id, position").eq("section_id", row.section_id).neq("id", lessonId).order("position");
        await renumberChapterLessons(db, sec.chapter_id, { sectionId: row.section_id, ids: [...((sibs ?? []) as { id: string }[]).map((l) => l.id), lessonId] });
      }
      refreshContent();
      return { id: lessonId };
    }
    const created = must(
      await db
        .from("lessons")
        .insert({ ...row, chapter_id: sec.chapter_id, position: 10_000 })
        .select("id")
        .single(),
      "créer la leçon",
    ) as { id: string };
    await renumberChapterLessons(db, sec.chapter_id);
    refreshContent();
    return { id: created.id };
  });
}

export async function setLessonPublished(lessonId: string, published: boolean) {
  await requireAdmin();
  return run(async (db) => {
    const v = z.object({ id, published: z.boolean() }).parse({ id: lessonId, published });
    must(await db.from("lessons").update({ published: v.published }).eq("id", v.id).select("id").single(), "leçon");
    refreshContent();
    return null;
  });
}

export async function deleteLesson(lessonId: string) {
  await requireAdmin();
  return run(async (db) => {
    const lid = id.parse(lessonId);
    const les = must(await db.from("lessons").select("chapter_id").eq("id", lid).maybeSingle(), "leçon") as { chapter_id: string };
    ok(await db.from("lessons").delete().eq("id", lid), "supprimer la leçon");
    await renumberChapterLessons(db, les.chapter_id);
    refreshContent();
    return null;
  });
}

export async function reorderLessons(sectionId: string, list: string[]) {
  await requireAdmin();
  return run(async (db) => {
    const sid = id.parse(sectionId);
    const v = ids.parse(list);
    const sec = must(await db.from("sections").select("chapter_id").eq("id", sid).maybeSingle(), "section") as { chapter_id: string };
    const { data } = await db.from("lessons").select("id").eq("section_id", sid);
    const existing = new Set(((data ?? []) as { id: string }[]).map((r) => r.id));
    if (v.length !== existing.size || !v.every((x) => existing.has(x))) throw new UserError("La liste a changé entre-temps : recharge la page.");
    await renumberChapterLessons(db, sec.chapter_id, { sectionId: sid, ids: v });
    refreshContent();
    return null;
  });
}

// ------------------------------------------------------------------ media (public bucket "media")

const MEDIA_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "video/mp4", "video/webm"];
const mediaTarget = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("course"), id, field: z.enum(["video_url", "cover_url"]) }),
  z.object({ kind: z.literal("chapter"), id, field: z.literal("video_url") }),
]);
type MediaTarget = z.input<typeof mediaTarget>;

/** Signed upload URL: the browser sends the file straight to storage (no server-action size limit). */
export async function createMediaUpload(target: MediaTarget, file: { name: string; type: string; size: number }) {
  await requireAdmin();
  return run(async (db) => {
    const t = mediaTarget.parse(target);
    const f = z.object({ name: z.string().min(1).max(200), type: z.string(), size: z.number().int().positive().max(200 * 1024 * 1024, "200 Mo maximum.") }).parse(file);
    if (!MEDIA_TYPES.includes(f.type)) throw new UserError("Formats acceptés : PNG, JPEG, WebP, GIF, MP4, WebM.");
    if (t.field === "video_url" && !f.type.startsWith("video/")) throw new UserError("Choisis une vidéo (MP4 ou WebM).");
    if (t.field === "cover_url" && !f.type.startsWith("image/")) throw new UserError("Choisis une image.");
    const path = `${t.kind}s/${t.id}/${Date.now()}-${safeFileName(f.name)}`;
    const { data, error } = await db.storage.from("media").createSignedUploadUrl(path);
    if (error || !data) throw new Error(error?.message ?? "URL d'envoi indisponible.");
    return { path: data.path, token: data.token };
  });
}

/** Save (or clear, with path null) the public URL of an uploaded media file. Removes the previous file. */
export async function setMedia(target: MediaTarget, path: string | null) {
  await requireAdmin();
  return run(async (db) => {
    const t = mediaTarget.parse(target);
    const table = t.kind === "course" ? "courses" : "chapters";
    if (path !== null && !z.string().startsWith(`${t.kind}s/${t.id}/`).safeParse(path).success) throw new UserError("Chemin de fichier invalide.");
    const current = must(await db.from(table).select(t.field).eq("id", t.id).maybeSingle(), t.kind) as Record<string, string | null>;
    let url: string | null = null;
    if (path) {
      const dir = path.slice(0, path.lastIndexOf("/"));
      const { data: listed } = await db.storage.from("media").list(dir, { search: path.slice(path.lastIndexOf("/") + 1) });
      if (!listed?.length) throw new UserError("Le fichier n'a pas été reçu par le stockage. Réessaie l'envoi.");
      url = db.storage.from("media").getPublicUrl(path).data.publicUrl;
    }
    must(await db.from(table).update({ [t.field]: url }).eq("id", t.id).select("id").single(), t.kind);
    // clean up the replaced file when it was ours
    const old = current[t.field];
    const marker = "/storage/v1/object/public/media/";
    if (old && old !== url && old.includes(marker)) await db.storage.from("media").remove([decodeURIComponent(old.split(marker)[1])]);
    refreshContent();
    return { url };
  });
}
