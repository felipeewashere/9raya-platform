import "server-only";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@/lib/supabase/server";
import { getCatalog } from "./courses";

export type HomeModule = {
  slug: string;
  name: string;
  /** one word for the scrolling band */
  short: string;
  available: boolean;
  chapters: string[];
};

/**
 * Chapter titles of a course. Chapters are only readable by signed-in students (RLS), so
 * visitors get the titles from the course content files the database is imported from.
 */
async function chapterTitles(courseId: string, slug: string, signedIn: boolean): Promise<string[]> {
  if (signedIn) {
    const supabase = await createClient();
    const { data } = await supabase.from("chapters").select("title, position").eq("course_id", courseId).order("position");
    if (data?.length) return data.map((c) => c.title as string);
  }
  try {
    const dir = path.join(process.cwd(), "content", slug);
    const files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
    const chapters = await Promise.all(
      files.map(async (f) => {
        const json = JSON.parse(await readFile(path.join(dir, f), "utf8")) as { number?: number; title?: string };
        return { number: json.number ?? 0, title: json.title ?? "" };
      }),
    );
    return chapters
      .filter((c) => c.title)
      .sort((a, b) => a.number - b.number)
      .map((c) => c.title);
  } catch {
    return [];
  }
}

/** The modules of the first semester, as shown on the home page. */
export async function getHomeModules(signedIn: boolean): Promise<{ semester: string; modules: HomeModule[] }> {
  const catalog = await getCatalog().catch(() => []);
  const semester = catalog.find((s) => s.slug === "s1") ?? catalog[0];
  const modules = await Promise.all(
    (semester?.courses ?? []).map(async (c) => {
      const available = c.status === "published";
      return {
        slug: c.slug,
        name: c.title,
        short: c.short_title || c.title.replace(/\s+\d+$/, "").split(" ")[0],
        available,
        chapters: available ? await chapterTitles(c.id, c.slug, signedIn) : [],
      };
    }),
  );
  return { semester: semester?.title ?? "Semestre 1", modules };
}
