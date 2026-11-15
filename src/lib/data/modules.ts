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

/** Clips found at build time (see getModuleClips in src/lib/content/static.ts). */
export type ModuleClips = Record<string, ModuleCard["clip"]>;

/** Every module of the first semester that has courses, with the student's progress. */
export async function getModuleCards(clips: ModuleClips = {}): Promise<ModuleCard[]> {
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
        clip: clips[c.slug] ?? null,
      };
    }),
  );
}
