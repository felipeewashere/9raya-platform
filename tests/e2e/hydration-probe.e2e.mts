/** Prints React hydration warnings for one page (dev server), signed in as a throwaway admin. */
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.E2E_BASE ?? "http://localhost:3200";
const PATH = process.argv[2] ?? "/admin/widgets";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const email = `e2e-probe-${Date.now()}@example.com`;
const password = "Probe-" + Math.random().toString(36).slice(2, 10);
const { data } = await db.auth.admin.createUser({ email, password, email_confirm: true });
const id = data.user!.id;
await db.from("profiles").update({ role: "admin", onboarded: true, study_year: "AP1", section: 1, group_code: "G1" }).eq("id", id);
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({ locale: "fr-FR" });
  const msgs: string[] = [];
  page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && msgs.push(m.text()));
  page.on("pageerror", (e) => msgs.push(e.message));
  await page.goto(`${BASE}/connexion`, { timeout: 120000 });
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL(/tableau-de-bord/, { timeout: 120000 });
  msgs.length = 0;
  await page.goto(`${BASE}${PATH}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(3000);
  console.log(msgs.map((m) => m.slice(0, 2500)).join("\n----\n") || "no warnings");
} finally {
  await browser.close();
  await db.auth.admin.deleteUser(id);
}
