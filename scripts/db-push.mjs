// Apply supabase/migrations to your Supabase database (no Docker needed).
// Needs SUPABASE_DB_URL in .env.local — the "Session pooler" connection string from
// Supabase → Project Settings → Database → Connection string (URI), with your DB password.
import { spawnSync } from "node:child_process";

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL manquant dans .env.local (voir README → Base de données).");
  process.exit(1);
}
const r = spawnSync("npx", ["--yes", "supabase@2", "db", "push", "--db-url", url, "--include-all", "--yes"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(r.status ?? 1);
