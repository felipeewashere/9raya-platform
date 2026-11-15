"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCourseOutline } from "@/lib/data/courses";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const TIMEZONES = new Set(Intl.supportedValuesOf("timeZone"));

const profileSchema = z.object({
  username: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_.-]{3,24}$/, "Nom d'utilisateur : 3 à 24 caractères (lettres, chiffres, . _ -)."),
  full_name: z.string().trim().max(80).optional(),
  timezone: z.string().refine((t) => TIMEZONES.has(t), "Fuseau horaire inconnu.").optional(),
  daily_goal_xp: z.coerce.number().int().min(10).max(200).optional(),
});

export async function updateProfile(input: z.input<typeof profileSchema>): Promise<Result<null>> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Session expirée." };
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", user.id);
  if (error) return { ok: false, error: error.code === "23505" ? "Ce nom d'utilisateur est déjà pris." : "Impossible d'enregistrer." };
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

const SIX = ["G1", "G2", "G3", "G4", "G5", "G6"];
const GROUPS: Record<string, Record<number, string[]>> = { AP1: { 1: SIX, 2: SIX } };

/** Saves the year / section / group chosen in the first-visit questions and marks the profile onboarded. */
export async function completeOnboarding(input: { study_year: string; section: number; group_code: string; timezone?: string }): Promise<Result<null>> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Session expirée." };
  const groups = GROUPS[input.study_year]?.[input.section];
  if (!groups || !groups.includes(input.group_code)) return { ok: false, error: "Choix invalide." };
  const timezone = input.timezone && TIMEZONES.has(input.timezone) ? input.timezone : "Africa/Casablanca";
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ study_year: input.study_year, section: input.section, group_code: input.group_code, timezone, onboarded: true })
    .eq("id", user.id);
  if (error) return { ok: false, error: "Impossible d'enregistrer." };
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

/** Upload a profile picture to the avatars bucket (folder = user id) and save its public URL. */
export async function uploadAvatar(form: FormData): Promise<Result<{ url: string }>> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Session expirée." };
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Aucun fichier." };
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return { ok: false, error: "Format accepté : PNG, JPEG ou WebP." };
  if (file.size > 2 * 1024 * 1024) return { ok: false, error: "Image trop lourde (2 Mo max)." };
  const supabase = await createClient();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${user.id}/avatar-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type, upsert: true });
  if (error) return { ok: false, error: "Échec de l'envoi de l'image." };
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", user.id);
  revalidatePath("/", "layout");
  return { ok: true, data: { url: data.publicUrl } };
}

export async function markAchievementsSeen(): Promise<void> {
  const user = await getUser();
  if (!user) return;
  const supabase = await createClient();
  await supabase.from("user_achievements").update({ seen: true }).eq("user_id", user.id).eq("seen", false);
}

/** Delete the account and all its data (profile rows cascade from auth.users). */
export async function deleteAccount(confirm: string): Promise<Result<null>> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Session expirée." };
  if (confirm !== "SUPPRIMER") return { ok: false, error: "Tape SUPPRIMER pour confirmer." };
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { ok: false, error: "Suppression impossible pour le moment." };
  const supabase = await createClient();
  await supabase.auth.signOut();
  return { ok: true, data: null };
}

export type SearchEntry = { type: "course" | "chapter" | "lesson"; title: string; subtitle: string; href: string; keywords: string };

/** Index of everything a student can open, for the search palette. */
export async function getSearchIndex(): Promise<SearchEntry[]> {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data: courses } = await supabase.from("courses").select("slug, title, status").eq("status", "published");
  const out: SearchEntry[] = [];
  for (const c of (courses ?? []) as { slug: string; title: string }[]) {
    out.push({ type: "course", title: c.title, subtitle: "Module", href: `/cours/${c.slug}`, keywords: c.title });
    const outline = await getCourseOutline(c.slug);
    for (const ch of outline?.chapters ?? []) {
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
