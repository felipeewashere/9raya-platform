import { createClient } from "@/lib/supabase/client";

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

/** The profile row of a user (RLS: a student reads only their own). */
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await createClient().from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Profile | null) ?? null;
}

export function isOnboarded(p: Pick<Profile, "onboarded" | "group_code"> | null) {
  return Boolean(p?.onboarded && p.group_code);
}

export function displayName(p: Pick<Profile, "full_name" | "username"> | null) {
  if (!p) return "Étudiant";
  return p.full_name?.split(" ")[0] || p.username || "Étudiant";
}
