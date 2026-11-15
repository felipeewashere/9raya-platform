import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: "student" | "admin";
  timezone: string;
  daily_goal_xp: number;
  onboarded: boolean;
  study_year: string | null;
  section: number | null;
  group_code: string | null;
  created_at: string;
};

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return (data as Profile | null) ?? null;
});

/** For pages and actions that need a signed-in student. */
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/connexion");
  return user;
}

export async function requireProfile() {
  const profile = await getProfile();
  if (!profile) redirect("/connexion");
  return profile;
}

/** For the admin area: verified on the server from the database role, never from the client. */
export async function requireAdmin() {
  const profile = await getProfile();
  if (!profile) redirect("/connexion");
  if (profile.role !== "admin") redirect("/tableau-de-bord");
  return profile;
}

export function displayName(p: Pick<Profile, "full_name" | "username"> | null) {
  if (!p) return "Étudiant";
  return p.full_name?.split(" ")[0] || p.username || "Étudiant";
}
