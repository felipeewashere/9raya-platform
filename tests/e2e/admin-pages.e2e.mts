/**
 * Smoke test of every admin page with a throwaway admin account (deleted at the end).
 *   node --env-file=.env.local --import tsx tests/e2e/admin-pages.e2e.mts
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.E2E_BASE ?? "http://localhost:3100";
const SHOTS = process.env.E2E_SHOTS ?? "e2e-shots";
mkdirSync(SHOTS, { recursive: true });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const email = `e2e-admin-${Date.now()}@example.com`;
const password = "Admin-e2e-" + Math.random().toString(36).slice(2, 10);
let userId = "";

async function main() {
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Admin Test" } });
  if (error) throw error;
  userId = data.user.id;
  await db.from("profiles").update({ role: "admin", onboarded: true, study_year: "AP1", section: 1, group_code: "G1" }).eq("id", userId);

  const { data: course } = await db.from("courses").select("id").eq("slug", "algebre-1").single();
  const { data: chapter } = await db.from("chapters").select("id").eq("course_id", course!.id).order("position").limit(1).single();
  const { data: lesson } = await db.from("lessons").select("id").eq("chapter_id", chapter!.id).order("position").limit(1).single();

  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 }, locale: "fr-FR" });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`${page.url()} :: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${page.url()} :: ${m.text()}`));
  try {
    await page.goto(`${BASE}/connexion`);
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Mot de passe", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await page.waitForURL(/tableau-de-bord/, { timeout: 30000 });

    const pages: [string, string][] = [
      ["admin", "/admin"],
      ["contenu", "/admin/contenu"],
      ["course", `/admin/contenu/${course!.id}`],
      ["chapter", `/admin/contenu/${course!.id}/${chapter!.id}`],
      ["lesson-editor", `/admin/lecons/${lesson!.id}`],
      ["imports", "/admin/imports"],
      ["ressources", "/admin/ressources"],
      ["etudiants", "/admin/etudiants"],
      ["student", `/admin/etudiants/${userId}`],
      ["analytique", "/admin/analytique"],
      ["analytics-lesson", `/admin/analytique/${lesson!.id}`],
      ["widgets", "/admin/widgets"],
    ];
    for (const [name, path] of pages) {
      const res = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 60000 });
      const status = res?.status() ?? 0;
      const text = await page.locator("main, body").first().innerText();
      const broken = /Oups|introuvable|Application error/i.test(text);
      console.log(status === 200 && !broken ? "  ✓" : "  ✗", name.padEnd(18), status, broken ? "(error page)" : "");
      await page.screenshot({ path: `${SHOTS}/admin-${name}.png`, fullPage: name === "widgets" ? false : false });
      if (status !== 200 || broken) process.exitCode = 1;
    }
    // a student must NOT reach the admin
    await db.from("profiles").update({ role: "student" }).eq("id", userId);
    await page.goto(`${BASE}/admin`);
    const blocked = !page.url().includes("/admin");
    console.log(blocked ? "  ✓" : "  ✗", "student redirected away from /admin →", new URL(page.url()).pathname);
    if (!blocked) process.exitCode = 1;
    console.log(errors.length ? `browser errors (${errors.length}):\n  ` + errors.slice(0, 12).join("\n  ") : "  ✓ no browser errors");
    if (errors.length) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main()
  .catch((e) => {
    console.error("✗ failed:", e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (userId) await db.auth.admin.deleteUser(userId);
  });
