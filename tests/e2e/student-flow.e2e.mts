/**
 * End-to-end test of the student journey on the static export (as served by GitHub Pages)
 * against the real Supabase project and its Edge Function `api`.
 *   npm run build && npm run serve:out   (in another terminal)
 *   npm run test:e2e
 *
 * Creates a throwaway confirmed account, signs in through the UI, completes onboarding,
 * answers an in-lesson checkpoint, passes a full quiz (every question kind answered through
 * the UI with the correct answer read from the database), then checks progress/XP/achievements
 * rows and deletes the account. Screenshots go to E2E_SHOTS (default: ./e2e-shots).
 */
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright-core";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000/9raya-platform";
const SHOTS = process.env.E2E_SHOTS ?? "e2e-shots";
mkdirSync(SHOTS, { recursive: true });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const email = `e2e-${Date.now()}@example.com`;
const password = "Test-e2e-" + Math.random().toString(36).slice(2, 10);
let userId = "";
const log = (s: string) => console.log("•", s);
const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });

type Q = { id: string; kind: string; data: Record<string, unknown>; answer: Record<string, unknown> };

async function questionsOf(lessonId: string, placement: "quiz" | "checkpoint"): Promise<Q[]> {
  const { data, error } = await db
    .from("questions")
    .select("id, kind, data, position, question_answers(answer)")
    .eq("lesson_id", lessonId)
    .eq("placement", placement)
    .order("position");
  if (error) throw error;
  return (data ?? []).map((q) => ({
    id: q.id,
    kind: q.kind,
    data: q.data as Record<string, unknown>,
    answer: ((Array.isArray(q.question_answers) ? q.question_answers[0] : q.question_answers) as { answer: Record<string, unknown> }).answer,
  }));
}

/** Answer the question shown inside `scope` (correctly), clicking "Vérifier" and the continue button. */
async function answer(page: Page, scope: ReturnType<Page["locator"]>, q: Q) {
  const check = () => scope.getByRole("button", { name: "Vérifier" }).click();
  const cont = async () => {
    const panel = page.getByRole("status").last();
    await panel.waitFor({ state: "visible", timeout: 30000 });
    const status = await panel.innerText();
    if (!status.toLowerCase().includes("bonne réponse")) throw new Error(`expected a correct answer for ${q.kind} ${q.id}, got: ${status.slice(0, 160)}`);
    // the last step of an in-lesson checkpoint has no continue button
    const btn = panel.getByRole("button").last();
    if (await btn.count()) await btn.click();
  };
  const fill = async (text: string) => {
    const input = scope.getByLabel("Ta réponse");
    await input.fill(text);
  };
  switch (q.kind) {
    case "mcq": {
      const opts = q.data.options as { id: string }[];
      await scope.getByRole("radio").nth(opts.findIndex((o) => o.id === q.answer.option)).click();
      await check();
      return cont();
    }
    case "true_false":
      await scope.getByRole("radio", { name: q.answer.value ? "Vrai" : "Faux" }).click();
      await check();
      return cont();
    case "fill_blank":
      await fill((q.answer.accepted as string[])[0]);
      await check();
      return cont();
    case "matching": {
      const map = q.answer.map as number[];
      for (let i = 0; i < map.length; i++) {
        await scope.locator('button[data-side="left"]').nth(i).click();
        await scope.locator('button[data-side="right"]').nth(map[i]).click();
      }
      await check();
      return cont();
    }
    case "ordering": {
      const target = q.answer.order as number[];
      const current = target.map((_, i) => i);
      for (let p = 0; p < target.length; p++) {
        let cur = current.indexOf(target[p]);
        while (cur > p) {
          await scope.getByRole("button", { name: "Monter" }).nth(cur).click();
          [current[cur - 1], current[cur]] = [current[cur], current[cur - 1]];
          cur--;
        }
      }
      await check();
      return cont();
    }
    case "steps": {
      const steps = q.answer.steps as { kind: string; option?: string; accepted?: string[] }[];
      const pub = (q.data.steps as { options?: { id: string }[] }[]);
      for (let s = 0; s < steps.length; s++) {
        const st = steps[s];
        if (st.kind === "mcq") await scope.getByRole("radio").nth(pub[s].options!.findIndex((o) => o.id === st.option)).click();
        else await fill(st.accepted![0]);
        await check();
        await cont();
      }
      return;
    }
  }
  throw new Error(`unknown kind ${q.kind}`);
}

async function main() {
  // test account (confirmed, so no e-mail round trip)
  const { data: created, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Test Parcours" } });
  if (error) throw error;
  userId = created.user.id;
  log(`account ${email}`);

  // pick the first lesson of chapter 1 that has a mcq/true_false checkpoint
  const { data: lessons } = await db.from("lessons").select("id, slug, title, position, chapter:chapters!inner(slug, number, course:courses!inner(slug))").eq("chapters.number", 1).order("position");
  let lesson: { id: string; slug: string; title: string; chapter: { slug: string } } | null = null;
  let checkpoint: Q | null = null;
  for (const l of (lessons ?? []) as unknown as { id: string; slug: string; title: string; chapter: { slug: string; course: { slug: string } } }[]) {
    if (l.chapter.course.slug !== "algebre-1") continue;
    const cps = await questionsOf(l.id, "checkpoint");
    if (cps[0] && ["mcq", "true_false"].includes(cps[0].kind)) {
      lesson = l;
      checkpoint = cps[0];
      break;
    }
  }
  if (!lesson || !checkpoint) throw new Error("no suitable lesson");
  log(`lesson ${lesson.slug}`);

  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: "fr-FR", timezoneId: "Africa/Casablanca" });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !m.text().startsWith("Failed to load resource") && errors.push(m.text()));
  page.on("response", (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url()}`));

  try {
    // sign in → onboarding → dashboard
    await page.goto(`${BASE}/connexion/`);
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Mot de passe", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await page.waitForURL(/\/bienvenue/, { timeout: 30000 });
    log("signed in → onboarding");
    // year → section → group (AP2 and later are locked)
    if (!(await page.getByRole("radio", { name: "AP2 (bientôt)" }).isDisabled())) throw new Error("AP2 should be locked");
    await page.getByRole("radio", { name: /^AP1,/ }).click();
    await page.getByRole("radio", { name: "Section 2", exact: true }).click();
    await page.getByRole("radio", { name: "G6", exact: true }).click();
    await page.waitForURL(/\/tableau-de-bord/, { timeout: 30000 });
    await page.getByRole("heading", { name: /^cours$/i }).waitFor({ timeout: 30000 });
    await page.getByRole("progressbar", { name: /Algèbre 1/ }).first().waitFor({ timeout: 30000 });
    await shot(page, "1-dashboard-new");
    log("dashboard");

    // course page
    await page.goto(`${BASE}/cours/algebre-1/`);
    await page.getByRole("heading", { name: "Algèbre 1" }).waitFor();
    await page.waitForTimeout(1500);
    await shot(page, "2-course");
    log("course page");

    // lesson + checkpoint
    const lessonUrl = `${BASE}/cours/algebre-1/${lesson.chapter.slug}/${lesson.slug}/`;
    await page.goto(lessonUrl);
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page.waitForTimeout(1000);
    await shot(page, "3-lesson");
    const cpScope = page.locator('section[aria-label="Vérifie ta compréhension"]').first();
    await cpScope.scrollIntoViewIfNeeded();
    await answer(page, cpScope, checkpoint);
    await shot(page, "4-checkpoint");
    log("checkpoint answered");

    // quiz
    const quiz = await questionsOf(lesson.id, "quiz");
    await page.goto(`${lessonUrl}quiz/`);
    await page.getByRole("button", { name: "Commencer" }).click();
    for (const [i, q] of quiz.entries()) {
      await page.getByText(`${i + 1}/${quiz.length}`, { exact: true }).waitFor({ timeout: 15000 });
      if (i === 1) await shot(page, "5-quiz-question");
      await answer(page, page.locator("main"), q);
      log(`quiz ${i + 1}/${quiz.length} (${q.kind}) ✓`);
    }
    await page.getByText(/Parfait|Quiz réussi/).waitFor({ timeout: 30000 });
    await page.waitForTimeout(1500);
    await shot(page, "6-quiz-results");
    log("quiz finished");

    // skip the next lesson: checked, no XP
    const { data: nextLesson } = await db.from("lessons").select("id, slug").eq("chapter_id", (await db.from("lessons").select("chapter_id").eq("id", lesson.id).single()).data!.chapter_id).gt("position", (await db.from("lessons").select("position").eq("id", lesson.id).single()).data!.position).order("position").limit(1).single();
    await page.goto(`${BASE}/cours/algebre-1/${lesson.chapter.slug}/${nextLesson!.slug}/`);
    await page.waitForLoadState("networkidle"); // let React hydrate before clicking
    await page.getByRole("button", { name: /Passer la leçon/i }).click();
    await page.waitForURL((u) => !u.pathname.replace(/\/$/, "").endsWith(nextLesson!.slug), { timeout: 30000 });
    log("skipped next lesson");

    // leaderboard
    await page.goto(`${BASE}/classement/?periode=jour`);
    await page.getByText("(toi)").first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(1200);
    await shot(page, "8-leaderboard");
    log("leaderboard");

    // dashboard after: the header shows the XP earned (2 + 10 + 20 + 10)
    await page.goto(`${BASE}/tableau-de-bord/`);
    await page.getByRole("heading", { name: /^cours$/i }).waitFor();
    await page.getByText("42 XP").first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(1500);
    await shot(page, "7-dashboard-after");
    log("header XP");

    // TD: statement + correction on demand
    await page.goto(`${BASE}/td/`);
    await page.getByRole("heading", { name: "TD", exact: true }).waitFor({ timeout: 30000 });
    await page.goto(`${BASE}/td/algebre-1/1/`);
    const firstEx = page.locator("article[id^=exercice-]").first();
    await firstEx.waitFor({ timeout: 30000 });
    await firstEx.getByRole("button", { name: "Voir la correction" }).click();
    await firstEx.getByRole("button", { name: "Cacher" }).waitFor();
    await shot(page, "9-td-correction");
    log("TD + correction");

    // profile, streak calendar
    await page.goto(`${BASE}/profil/`);
    await page.getByRole("grid", { name: "Calendrier d'activité" }).waitFor({ timeout: 30000 });
    await page.getByText("Niveau 1").first().waitFor();
    await shot(page, "10-profile");
    log("profile");

    // settings page loads the profile
    await page.goto(`${BASE}/parametres/`);
    await page.getByLabel("Prénom et nom").waitFor({ timeout: 30000 });
    if ((await page.getByLabel("Prénom et nom").inputValue()) !== "Test Parcours") throw new Error("settings: name not loaded");
    log("settings");

    // theme toggle
    const darkBefore = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    await page.getByRole("button", { name: /Passer en mode (sombre|clair)/ }).first().click();
    await page.waitForFunction((d) => document.documentElement.classList.contains("dark") !== d, darkBefore);
    await shot(page, "11-theme");
    log("theme toggle");

    // a lesson with a figure and a 3D simulation (first chapter of another course)
    await page.goto(`${BASE}/cours/mecanique-du-point/cinematique-du-point-materiel/repere-d-espace-et-produits-de-vecteurs/`);
    await page.getByRole("heading", { level: 1 }).waitFor({ timeout: 30000 });
    const fig = page.locator("main figure img").first();
    await fig.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
      const img = document.querySelector("main figure img") as HTMLImageElement | null;
      return !!img && img.complete && img.naturalWidth > 0;
    }, undefined, { timeout: 30000 });
    const sim = page.locator("figure", { hasText: "Simulation" }).first();
    await sim.scrollIntoViewIfNeeded();
    await sim.locator("canvas, svg").first().waitFor({ timeout: 60000 });
    await page.waitForTimeout(2000);
    await shot(page, "12-figure-simulation");
    log("figure + simulation");

    // signed-out visitors are sent to the sign-in page (client-side guard)
    const guest = await browser.newPage();
    await guest.goto(`${BASE}/tableau-de-bord/`);
    await guest.waitForURL(/\/connexion\/\?suivant=/, { timeout: 30000 });
    await guest.close();
    log("guard redirects signed-out visitors");

    // database checks
    const [{ data: prog }, { data: xp }, { data: att }, { data: ach }, { data: streak }] = await Promise.all([
      db.from("lesson_progress").select("status").eq("user_id", userId).eq("lesson_id", lesson.id).single(),
      db.from("xp_events").select("reason, amount").eq("user_id", userId),
      db.from("quiz_attempts").select("status, score, total, passed").eq("user_id", userId),
      db.from("user_achievements").select("achievement_id").eq("user_id", userId),
      db.rpc("get_streak", { p_user: userId }),
    ]);
    const total = (xp ?? []).reduce((n, r) => n + r.amount, 0);
    const { data: skippedRow } = await db.from("lesson_progress").select("status, skipped").eq("user_id", userId).eq("lesson_id", nextLesson!.id).single();
    const { data: groupRow } = await db.from("profiles").select("study_year, section, group_code").eq("id", userId).single();
    const finished = (att ?? []).filter((a) => a.status === "finished");
    const checks: [string, boolean][] = [
      ["lesson completed", prog?.status === "completed"],
      ["one finished attempt, perfect", finished.length === 1 && finished[0].score === finished[0].total && finished[0].passed],
      ["XP = 2 checkpoint + 10 lesson + 20 pass + 10 perfect", total === 42],
      ["skipped lesson checked without XP", skippedRow?.status === "completed" && skippedRow.skipped === true],
      ["achievement first-lesson", (ach ?? []).some((a) => a.achievement_id === "first-lesson")],
      ["streak = 1, active today", JSON.stringify(streak).includes('"current_streak":1') && JSON.stringify(streak).includes('"active_today":true')],
      ["no browser errors", errors.length === 0],
      ["group saved", groupRow?.study_year === "AP1" && groupRow.section === 2 && groupRow.group_code === "G6"],
    ];
    for (const [name, ok] of checks) console.log(ok ? "  ✓" : "  ✗", name);
    if (errors.length) console.log("browser errors:\n  " + errors.slice(0, 10).join("\n  "));
    console.log("XP rows:", JSON.stringify(xp));
    if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
  } catch (e) {
    await shot(page, "error").catch(() => {});
    if (errors.length) console.log("browser errors:\n  " + errors.slice(0, 10).join("\n  "));
    throw e;
  } finally {
    await browser.close();
  }
}

main()
  .catch(async (e) => {
    console.error("✗ E2E failed:", e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (userId) await db.auth.admin.deleteUser(userId);
    log("test account deleted");
  });
