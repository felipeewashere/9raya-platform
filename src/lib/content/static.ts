import "server-only";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chapterSchema, type Chapter, type Lesson } from "@/content/schema";
import { lessonQuestionRows } from "@/lib/content/import";
import { splitQuestion } from "@/lib/quiz/serialize";
import type { PublicQuestion } from "@/lib/quiz/types";
import type { ModuleClips } from "@/lib/data/modules";
import type { PublicTdExercise, TdChapter, TdExercise, TdIndex } from "@/lib/data/td";
import type { SearchEntry } from "@/lib/actions/profile";

/*
 * Build-time content (static export). Read from content/<course>/chNN.json — the same files
 * imported into the database by `npm run content:import` — and embedded in the generated pages.
 *
 * Questions are split exactly like the import does (same shuffle seed), and ONLY their public
 * part is kept: answers and explanations never reach the pages. Grading happens in the Edge
 * Function against the database (question_answers), using the question ids that the browser
 * resolves at runtime from the stable keys `quiz-N` / `cp-N`.
 */

const CONTENT = join(process.cwd(), "content");
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const chapterCache = new Map<string, Chapter[]>();

/** Courses that have chapter files. */
export function contentCourses(): string[] {
  return readdirSync(CONTENT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && SLUG.test(d.name))
    .map((d) => d.name)
    .filter((c) => readdirSync(join(CONTENT, c)).some((f) => /^ch\d+\.json$/.test(f)))
    .sort();
}

export function readChapters(course: string): Chapter[] {
  if (!SLUG.test(course)) return [];
  const hit = chapterCache.get(course);
  if (hit) return hit;
  const dir = join(CONTENT, course);
  const chapters = existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => /^ch\d+\.json$/.test(f))
        .map((f) => chapterSchema.parse(JSON.parse(readFileSync(join(dir, f), "utf8"))))
        .sort((a, b) => a.number - b.number)
    : [];
  chapterCache.set(course, chapters);
  return chapters;
}

export type StaticBlock = {
  position: number;
  type: string;
  origin: "source" | "added";
  data: Record<string, unknown>;
  /** checkpoint blocks: the question's stable key (cp-N) and its public data */
  question?: { key: string; data: PublicQuestion };
};

export type StaticQuizQuestion = { key: string; kind: string; data: PublicQuestion; position: number };

export type StaticLesson = { title: string; blocks: StaticBlock[]; quiz: StaticQuizQuestion[] };

function findLesson(course: string, chapterSlug: string, lessonSlug: string): { chapter: Chapter; lesson: Lesson } | null {
  const chapter = readChapters(course).find((c) => c.slug === chapterSlug);
  const lesson = chapter?.sections.flatMap((s) => s.lessons).find((l) => l.slug === lessonSlug);
  return chapter && lesson ? { chapter, lesson } : null;
}

/** The public part of one lesson (no answers, no explanations). */
export function getStaticLesson(course: string, chapterSlug: string, lessonSlug: string): StaticLesson | null {
  const found = findLesson(course, chapterSlug, lessonSlug);
  if (!found) return null;
  const { chapter, lesson } = found;
  const publicData = new Map(
    lessonQuestionRows(lesson).map((r) => [r.key, splitQuestion(r.q, `${chapter.slug}/${lesson.slug}/${r.key}`).data]),
  );
  // stored JSON drops undefined fields: keep the embedded data identical to the database rows
  const clean = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
  let cp = 0;
  const blocks: StaticBlock[] = lesson.blocks.map((b, i) => {
    if (b.type === "checkpoint") {
      const key = `cp-${++cp}`;
      return { position: i + 1, type: "checkpoint", origin: b.origin, data: {}, question: { key, data: clean(publicData.get(key)!) } };
    }
    const { type, origin, ...rest } = b;
    return { position: i + 1, type, origin, data: clean(rest) as Record<string, unknown> };
  });
  const quiz = lesson.quiz.map((q, i) => ({ key: `quiz-${i + 1}`, kind: q.kind, data: clean(publicData.get(`quiz-${i + 1}`)!), position: i + 1 }));
  return { title: lesson.title, blocks, quiz };
}

export function lessonParams() {
  return contentCourses().flatMap((course) =>
    readChapters(course).flatMap((ch) => ch.sections.flatMap((s) => s.lessons.map((l) => ({ course, chapter: ch.slug, lesson: l.slug })))),
  );
}

// ------------------------------------------------------------------ TD

export function readTdChapters(slug: string): TdChapter[] {
  const dir = join(CONTENT, slug, "td");
  if (!SLUG.test(slug) || !existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^ch\d+\.json$/.test(f))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as TdChapter)
    .filter((c) => Array.isArray(c.exercises) && c.exercises.length > 0)
    .sort((a, b) => a.chapter - b.chapter);
}

/** What the page embeds: statement and correction only. */
export function publicExercise(e: TdExercise): PublicTdExercise {
  return { number: e.number, title: e.title, statement_md: e.statement_md, solution_md: e.solution_md, solution_source: e.solution_source ?? null, source: e.source };
}

export function tdCourses(): string[] {
  return readdirSync(CONTENT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && SLUG.test(d.name) && readTdChapters(d.name).length > 0)
    .map((d) => d.name)
    .sort();
}

export function tdIndex(): TdIndex {
  return Object.fromEntries(tdCourses().map((c) => [c, readTdChapters(c).map((ch) => ({ chapter: ch.chapter, exercises: ch.exercises.map((e) => e.number) }))]));
}

// ------------------------------------------------------------------ catalog (public course list, read with the anon key)

export type BuildCourse = { slug: string; title: string; status: string };

let catalog: Promise<BuildCourse[]> | undefined;

/**
 * Course titles and slugs (courses are readable by anonymous visitors). Needed for page titles
 * and for the course pages of modules that have no content yet ("coming soon").
 */
export function getBuildCatalog(): Promise<BuildCourse[]> {
  catalog ??= (async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY must be set to build the site.");
    const res = await fetch(`${url}/rest/v1/courses?select=slug,title,status&order=position`, { headers: { apikey: key } });
    if (!res.ok) throw new Error(`Supabase courses: HTTP ${res.status}`);
    return (await res.json()) as BuildCourse[];
  })();
  return catalog;
}

export async function courseTitle(slug: string) {
  return (await getBuildCatalog()).find((c) => c.slug === slug)?.title ?? null;
}

/** Every /cours/[course] page: courses of the catalog plus any content folder. */
export async function courseParams() {
  const slugs = new Set([...(await getBuildCatalog()).map((c) => c.slug), ...contentCourses()]);
  return [...slugs].sort().map((course) => ({ course }));
}

// ------------------------------------------------------------------ media and search

/** Module clips in public/media/modules/<slug>.mp4 (+ .jpg poster). */
export function getModuleClips(): ModuleClips {
  const dir = join(process.cwd(), "public", "media", "modules");
  if (!existsSync(dir)) return {};
  const out: ModuleClips = {};
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".mp4"))) {
    const slug = f.replace(/\.mp4$/, "");
    out[slug] = { src: `/media/modules/${slug}.mp4`, poster: existsSync(join(dir, `${slug}.jpg`)) ? `/media/modules/${slug}.jpg` : null };
  }
  return out;
}

/** Index of every published course, chapter and lesson for the search palette (public titles only). */
export async function buildSearchIndex(): Promise<SearchEntry[]> {
  const published = (await getBuildCatalog()).filter((c) => c.status === "published");
  const out: SearchEntry[] = [];
  for (const c of published) {
    out.push({ type: "course", title: c.title, subtitle: "Module", href: `/cours/${c.slug}`, keywords: c.title });
    for (const ch of readChapters(c.slug)) {
      out.push({ type: "chapter", title: `Ch. ${ch.number} — ${ch.title}`, subtitle: c.title, href: `/cours/${c.slug}#chapitre-${ch.slug}`, keywords: `${ch.title} ${ch.description ?? ""}` });
      for (const s of ch.sections)
        for (const l of s.lessons)
          out.push({
            type: "lesson",
            title: l.title,
            subtitle: `${c.title} · Ch. ${ch.number} · ${s.title}`,
            href: `/cours/${c.slug}/${ch.slug}/${l.slug}`,
            keywords: `${l.title} ${l.summary ?? ""} ${s.title}`,
          });
    }
  }
  return out;
}
