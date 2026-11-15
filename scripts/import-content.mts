/**
 * Import course content from content/<course-slug>/chNN.json into Supabase.
 *
 *   npm run content:import                     → every course folder under content/
 *   npm run content:import -- algebre-1        → one course
 *   npm run content:import -- algebre-1 --draft --prune
 *
 * --draft  import without publishing (preview in the admin first)
 * --prune  delete sections/lessons that are no longer in the files (removes their progress)
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (read from .env.local).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { importChapter } from "../src/lib/content/import";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Fill in .env.local first (see README).");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const courses = args.filter((a) => !a.startsWith("--"));
const root = "content";
const targets = courses.length ? courses : readdirSync(root).filter((d) => statSync(join(root, d)).isDirectory());

let failed = false;
for (const course of targets) {
  const dir = join(root, course);
  if (!existsSync(dir)) {
    console.error(`✗ no folder ${dir}`);
    failed = true;
    continue;
  }
  for (const file of readdirSync(dir).filter((f) => /^ch\d+\.json$/.test(f)).sort()) {
    try {
      const r = await importChapter(db, course, JSON.parse(readFileSync(join(dir, file), "utf8")), {
        publish: !flags.has("--draft"),
        prune: flags.has("--prune"),
      });
      console.log(`✓ ${course}/${file}: ${r.lessons} leçons, ${r.questions} questions, ${r.blocks} blocs${r.pruned ? `, ${r.pruned} supprimés` : ""}`);
    } catch (e) {
      failed = true;
      console.error(`✗ ${course}/${file}: ${(e as Error).message}`);
    }
  }
}
process.exit(failed ? 1 : 0);
