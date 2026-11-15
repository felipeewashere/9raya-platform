import { z } from "zod";
import { callApi, type Result } from "@/lib/api";
import { withBase } from "@/lib/base-path";
import { createClient, getUser } from "@/lib/supabase/client";

/* Profile actions: plain RLS writes on the student's own row (only the allowed columns are granted). */

const TIMEZONES = new Set(typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : []);

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
  const { error } = await createClient().from("profiles").update(parsed.data).eq("id", user.id);
  if (error) return { ok: false, error: error.code === "23505" ? "Ce nom d'utilisateur est déjà pris." : "Impossible d'enregistrer." };
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
  const { error } = await createClient()
    .from("profiles")
    .update({ study_year: input.study_year, section: input.section, group_code: input.group_code, timezone, onboarded: true })
    .eq("id", user.id);
  if (error) return { ok: false, error: "Impossible d'enregistrer." };
  return { ok: true, data: null };
}

/** Upload a profile picture to the avatars bucket (folder = user id) and save its public URL. */
export async function uploadAvatar(file: File): Promise<Result<{ url: string }>> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Session expirée." };
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return { ok: false, error: "Format accepté : PNG, JPEG ou WebP." };
  if (file.size > 2 * 1024 * 1024) return { ok: false, error: "Image trop lourde (2 Mo max)." };
  const supabase = createClient();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${user.id}/avatar-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type, upsert: true });
  if (error) return { ok: false, error: "Échec de l'envoi de l'image." };
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", user.id);
  return { ok: true, data: { url: data.publicUrl } };
}

export async function markAchievementsSeen(): Promise<void> {
  const user = await getUser();
  if (!user) return;
  await createClient().from("user_achievements").update({ seen: true }).eq("user_id", user.id).eq("seen", false);
}

/** Delete the account and all its data (Edge Function, service role), then sign out locally. */
export async function deleteAccount(confirm: string): Promise<Result<null>> {
  if (confirm !== "SUPPRIMER") return { ok: false, error: "Tape SUPPRIMER pour confirmer." };
  const r = await callApi<null>("deleteAccount", { confirm });
  if (r.ok) await createClient().auth.signOut({ scope: "local" });
  return r;
}

export type SearchEntry = { type: "course" | "chapter" | "lesson"; title: string; subtitle: string; href: string; keywords: string };

/** Index of everything a student can open, for the search palette (generated at build time). */
export async function getSearchIndex(): Promise<SearchEntry[]> {
  const res = await fetch(withBase("/search-index.json"));
  if (!res.ok) return [];
  return (await res.json()) as SearchEntry[];
}
