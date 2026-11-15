// Copies the pure grading / gamification modules into the Edge Function (Deno needs .ts extensions).
// Run after editing src/lib/quiz/grade.ts, src/lib/quiz/types.ts or src/lib/gamification.ts:
//   npm run edge:sync
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "supabase", "functions", "api", "shared");
const files = { "grade.ts": "src/lib/quiz/grade.ts", "types.ts": "src/lib/quiz/types.ts", "gamification.ts": "src/lib/gamification.ts" };

export function edgeCopy(src) {
  const code = readFileSync(join(root, src), "utf8").replace(/from "\.\/(\w+)"/g, 'from "./$1.ts"');
  return `// GENERATED from ${src} by scripts/sync-edge.mjs. Do not edit.\n${code}`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(out, { recursive: true });
  for (const [name, src] of Object.entries(files)) writeFileSync(join(out, name), edgeCopy(src));
  console.log("Edge Function shared modules updated.");
}
export { files, out };
