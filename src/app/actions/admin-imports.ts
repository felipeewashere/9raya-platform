"use server";

import { z } from "zod";
import { chapterSchema } from "@/content/schema";
import { importChapter } from "@/lib/content/import";
import { requireAdmin } from "@/lib/auth";
import { id, must, ok, refreshContent, run, safeFileName, toIssues, UserError, type AdminDb, type Issue } from "./admin-shared";

/** Pages are stored in content_imports.extracted_text separated by form feeds. */
const PAGE_BREAK = "\f";

type ImportRow = { id: string; course_id: string | null; storage_path: string; file_name: string; draft: unknown; status: string };

async function loadImport(db: AdminDb, importId: string) {
  return must(await db.from("content_imports").select("id, course_id, storage_path, file_name, draft, status").eq("id", id.parse(importId)).maybeSingle(), "import") as ImportRow;
}

const isPdfPath = (p: string) => p.startsWith("pdf/");

// ------------------------------------------------------------------ upload + extraction

export async function createImportUpload(file: { name: string; type: string; size: number }) {
  await requireAdmin();
  return run(async (db) => {
    const f = z.object({ name: z.string().min(1).max(200), type: z.string(), size: z.number().int().positive().max(50 * 1024 * 1024, "50 Mo maximum.") }).parse(file);
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) throw new UserError("Choisis un fichier PDF.");
    const path = `pdf/${Date.now()}-${safeFileName(f.name)}`;
    const { data, error } = await db.storage.from("imports").createSignedUploadUrl(path);
    if (error || !data) throw new Error(error?.message ?? "URL d'envoi indisponible.");
    return { path: data.path, token: data.token };
  });
}

export async function registerImport(input: { path: string; fileName: string; courseId: string | null }) {
  const admin = await requireAdmin();
  return run(async (db) => {
    const v = z.object({ path: z.string().startsWith("pdf/").max(400), fileName: z.string().min(1).max(200), courseId: id.nullable() }).parse(input);
    const name = v.path.slice(4);
    const { data: listed } = await db.storage.from("imports").list("pdf", { search: name });
    if (!listed?.some((o) => o.name === name)) throw new UserError("Le PDF n'a pas été reçu par le stockage. Réessaie l'envoi.");
    const row = must(
      await db.from("content_imports").insert({ storage_path: v.path, file_name: v.fileName, course_id: v.courseId, created_by: admin.id, status: "uploaded" }).select("id").single(),
      "créer l'import",
    ) as { id: string };
    refreshContent();
    return { id: row.id };
  });
}

/** Extract the text of every page (unpdf, pure JS). Never creates content by itself. */
export async function extractImport(importId: string) {
  await requireAdmin();
  return run(async (db) => {
    const row = await loadImport(db, importId);
    if (!isPdfPath(row.storage_path)) throw new UserError("Cet import ne provient pas d'un PDF.");
    try {
      const file = await db.storage.from("imports").download(row.storage_path);
      if (file.error || !file.data) throw new Error(file.error?.message ?? "téléchargement impossible");
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(await file.data.arrayBuffer()));
      const { totalPages, text } = await extractText(pdf, { mergePages: false });
      const pages = text.map((t) => t.replaceAll(PAGE_BREAK, " ").trim());
      ok(await db.from("content_imports").update({ extracted_text: pages.join(PAGE_BREAK), status: "extracted", error: null }).eq("id", row.id), "enregistrer le texte");
      refreshContent();
      return { pages: totalPages, empty: pages.every((p) => !p) };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await db.from("content_imports").update({ status: "failed", error: `Extraction : ${message}` }).eq("id", row.id);
      refreshContent();
      throw new UserError(`Extraction impossible : ${message}`);
    }
  });
}

/** Import a chapter JSON file (authoring format) directly: it goes through the same review flow. */
export async function createJsonImport(input: { fileName: string; text: string; courseId: string | null }) {
  const admin = await requireAdmin();
  return run(async (db) => {
    const v = z.object({ fileName: z.string().min(1).max(200), text: z.string().min(2).max(10_000_000), courseId: id.nullable() }).parse(input);
    let draft: unknown;
    try {
      draft = JSON.parse(v.text);
    } catch (e) {
      throw new UserError(`JSON invalide : ${(e as Error).message}`);
    }
    const row = must(
      await db
        .from("content_imports")
        .insert({ storage_path: `json/${Date.now()}-${safeFileName(v.fileName)}`, file_name: v.fileName, course_id: v.courseId, created_by: admin.id, draft, status: "extracted" })
        .select("id")
        .single(),
      "créer l'import",
    ) as { id: string };
    refreshContent();
    return { id: row.id };
  });
}

// ------------------------------------------------------------------ review

/** Save the reviewer's work. The draft is kept even when invalid, so nothing is lost. */
export async function saveImportDraft(importId: string, input: { courseId: string | null; draftText: string }) {
  await requireAdmin();
  return run(async (db): Promise<{ valid: boolean; issues: Issue[] }> => {
    const row = await loadImport(db, importId);
    const v = z.object({ courseId: id.nullable(), draftText: z.string().max(10_000_000) }).parse(input);
    if (row.status === "published") throw new UserError("Import déjà publié : modifie le contenu depuis l'éditeur de leçons.");
    let draft: unknown = null;
    if (v.draftText.trim()) {
      try {
        draft = JSON.parse(v.draftText);
      } catch (e) {
        throw new UserError(`JSON invalide : ${(e as Error).message}`);
      }
    }
    ok(await db.from("content_imports").update({ course_id: v.courseId, draft }).eq("id", row.id), "enregistrer le brouillon");
    refreshContent();
    const parsed = chapterSchema.safeParse(draft);
    return { valid: parsed.success, issues: parsed.success ? [] : toIssues(parsed.error) };
  });
}

/** Import the reviewed chapter UNPUBLISHED (students cannot see it; admins can preview it). */
export async function importDraft(importId: string) {
  await requireAdmin();
  return run(async (db) => {
    const row = await loadImport(db, importId);
    if (!row.course_id) throw new UserError("Choisis le cours de destination.");
    const chapter = chapterSchema.parse(row.draft);
    const course = must(await db.from("courses").select("slug").eq("id", row.course_id).maybeSingle(), "cours") as { slug: string };
    const report = await importChapter(db, course.slug, chapter, { publish: false });
    ok(await db.from("content_imports").update({ status: "reviewed", error: null }).eq("id", row.id), "statut");
    refreshContent();
    const first = chapter.sections[0]?.lessons[0];
    return { report, previewHref: first ? `/cours/${course.slug}/${chapter.slug}/${first.slug}` : `/cours/${course.slug}` };
  });
}

/** Publish the imported chapter and its lessons (only after "Importer en brouillon"). */
export async function publishImport(importId: string) {
  await requireAdmin();
  return run(async (db) => {
    const row = await loadImport(db, importId);
    if (row.status !== "reviewed" && row.status !== "published") throw new UserError("Importe d'abord le chapitre en brouillon et vérifie-le.");
    if (!row.course_id) throw new UserError("Choisis le cours de destination.");
    const chapter = chapterSchema.parse(row.draft);
    const ch = must(await db.from("chapters").select("id").eq("course_id", row.course_id).eq("slug", chapter.slug).maybeSingle(), "chapitre importé") as { id: string };
    const slugs = chapter.sections.flatMap((s) => s.lessons.map((l) => l.slug));
    ok(await db.from("chapters").update({ published: true }).eq("id", ch.id), "publier le chapitre");
    ok(await db.from("lessons").update({ published: true }).eq("chapter_id", ch.id).in("slug", slugs), "publier les leçons");
    ok(await db.from("content_imports").update({ status: "published", error: null }).eq("id", row.id), "statut");
    refreshContent();
    return { chapterId: ch.id, lessons: slugs.length };
  });
}

export async function deleteImport(importId: string) {
  await requireAdmin();
  return run(async (db) => {
    const row = await loadImport(db, importId);
    if (isPdfPath(row.storage_path)) await db.storage.from("imports").remove([row.storage_path]);
    ok(await db.from("content_imports").delete().eq("id", row.id), "supprimer l'import");
    refreshContent();
    return null;
  });
}
