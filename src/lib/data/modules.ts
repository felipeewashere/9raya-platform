import "server-only";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getCatalog, getCourseOutline } from "./courses";

export type ModuleCard = {
  slug: string;
  title: string;
  color: string;
  available: boolean;
  total: number;
  completed: number;
  /** where "continue" goes: the next lesson, else the course page */
  href: string;
  nextLesson: string | null;
  /** Higgsfield clip in public/media/modules/<slug>.mp4 (+ .jpg poster), if present */
  clip: { src: string; poster: string | null } | null;
};

function clipFor(slug: string): ModuleCard["clip"] {
  const dir = join(process.cwd(), "public", "media", "modules");
  if (!existsSync(join(dir, `${slug}.mp4`))) return null;
  return { src: `/media/modules/${slug}.mp4`, poster: existsSync(join(dir, `${slug}.jpg`)) ? `/media/modules/${slug}.jpg` : null };
}

/** Every module of the first semester that has courses, with the student's progress. */
export async function getModuleCards(): Promise<ModuleCard[]> {
  const catalog = await getCatalog();
  const semester = catalog.find((s) => s.courses.length) ?? catalog[0];
  if (!semester) return [];
  const courses = semester.courses.filter((c) => c.status !== "draft");
  return Promise.all(
    courses.map(async (c) => {
      const available = c.status === "published";
      const outline = available ? await getCourseOutline(c.slug) : null;
      const resume = outline?.resume ?? null;
      return {
        slug: c.slug,
        title: c.title,
        color: c.color,
        available,
        total: outline?.total ?? 0,
        completed: outline?.completed ?? 0,
        href: resume ? `/cours/${c.slug}/${resume.chapterSlug}/${resume.lessonSlug}` : `/cours/${c.slug}`,
        nextLesson: resume?.title ?? null,
        clip: clipFor(c.slug),
      };
    }),
  );
}
