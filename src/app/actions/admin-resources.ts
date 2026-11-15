"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { id, must, ok, refreshContent, run, safeFileName, UserError, type AdminDb } from "./admin-shared";

const MAX = 50 * 1024 * 1024;

async function courseSlug(db: AdminDb, courseId: string) {
  return (must(await db.from("courses").select("slug").eq("id", courseId).maybeSingle(), "cours") as { slug: string }).slug;
}

/** Chapter / lesson links must belong to the course. */
async function checkLinks(db: AdminDb, courseId: string, chapterId: string | null, lessonId: string | null) {
  if (chapterId) {
    const ch = must(await db.from("chapters").select("course_id").eq("id", chapterId).maybeSingle(), "chapitre") as { course_id: string };
    if (ch.course_id !== courseId) throw new UserError("Ce chapitre n'appartient pas au cours choisi.");
  }
  if (lessonId) {
    const l = must(await db.from("lessons").select("chapter_id, chapter:chapters(course_id)").eq("id", lessonId).maybeSingle(), "leçon") as unknown as {
      chapter_id: string;
      chapter: { course_id: string };
    };
    if (l.chapter.course_id !== courseId) throw new UserError("Cette leçon n'appartient pas au cours choisi.");
    if (chapterId && l.chapter_id !== chapterId) throw new UserError("Cette leçon n'appartient pas au chapitre choisi.");
    return l.chapter_id;
  }
  return chapterId;
}

export async function createResourceUpload(courseId: string, file: { name: string; type: string; size: number }) {
  await requireAdmin();
  return run(async (db) => {
    const cid = id.parse(courseId);
    const f = z.object({ name: z.string().min(1).max(200), type: z.string().max(200), size: z.number().int().positive().max(MAX, "50 Mo maximum.") }).parse(file);
    const path = `${await courseSlug(db, cid)}/${Date.now()}-${safeFileName(f.name)}`;
    const { data, error } = await db.storage.from("resources").createSignedUploadUrl(path);
    if (error || !data) throw new Error(error?.message ?? "URL d'envoi indisponible.");
    return { path: data.path, token: data.token };
  });
}

const registerInput = z.object({
  courseId: id,
  chapterId: id.nullable(),
  lessonId: id.nullable(),
  title: z.string().trim().min(1, "Titre requis.").max(200),
  path: z.string().min(3).max(400),
  mime: z.string().max(200).nullable(),
  size: z.number().int().nonnegative().max(MAX),
});

export async function registerResource(input: z.input<typeof registerInput>) {
  await requireAdmin();
  return run(async (db) => {
    const v = registerInput.parse(input);
    const slug = await courseSlug(db, v.courseId);
    if (!v.path.startsWith(`${slug}/`) || v.path.slice(slug.length + 1).includes("/")) throw new UserError("Chemin de fichier invalide.");
    const name = v.path.slice(slug.length + 1);
    const { data: listed } = await db.storage.from("resources").list(slug, { search: name });
    if (!listed?.some((o) => o.name === name)) throw new UserError("Le fichier n'a pas été reçu par le stockage. Réessaie l'envoi.");
    const chapterId = await checkLinks(db, v.courseId, v.chapterId, v.lessonId);
    must(
      await db
        .from("resources")
        .insert({ course_id: v.courseId, chapter_id: chapterId, lesson_id: v.lessonId, title: v.title, storage_path: v.path, mime_type: v.mime, size_bytes: v.size })
        .select("id")
        .single(),
      "enregistrer la ressource",
    );
    refreshContent();
    return null;
  });
}

const updateInput = z.object({ id, title: z.string().trim().min(1, "Titre requis.").max(200), chapterId: id.nullable(), lessonId: id.nullable() });

export async function updateResource(input: z.input<typeof updateInput>) {
  await requireAdmin();
  return run(async (db) => {
    const v = updateInput.parse(input);
    const res = must(await db.from("resources").select("course_id").eq("id", v.id).maybeSingle(), "ressource") as { course_id: string };
    const chapterId = await checkLinks(db, res.course_id, v.chapterId, v.lessonId);
    must(await db.from("resources").update({ title: v.title, chapter_id: chapterId, lesson_id: v.lessonId }).eq("id", v.id).select("id").single(), "ressource");
    refreshContent();
    return null;
  });
}

export async function deleteResource(resourceId: string) {
  await requireAdmin();
  return run(async (db) => {
    const rid = id.parse(resourceId);
    const res = must(await db.from("resources").select("storage_path").eq("id", rid).maybeSingle(), "ressource") as { storage_path: string };
    const rm = await db.storage.from("resources").remove([res.storage_path]);
    if (rm.error) throw new Error(`stockage : ${rm.error.message}`);
    ok(await db.from("resources").delete().eq("id", rid), "supprimer la ressource");
    refreshContent();
    return null;
  });
}

/** Short-lived link for the admin to open a file. */
export async function resourceDownloadUrl(resourceId: string) {
  await requireAdmin();
  return run(async (db) => {
    const res = must(await db.from("resources").select("storage_path").eq("id", id.parse(resourceId)).maybeSingle(), "ressource") as { storage_path: string };
    const { data, error } = await db.storage.from("resources").createSignedUrl(res.storage_path, 120);
    if (error || !data) throw new Error(error?.message ?? "lien indisponible");
    return { url: data.signedUrl };
  });
}
