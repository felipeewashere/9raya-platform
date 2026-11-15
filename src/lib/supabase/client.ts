import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

let client: SupabaseClient | undefined;

/**
 * Browser Supabase client acting as the signed-in student (RLS applies).
 * The session lives in localStorage; OAuth and e-mail links use the PKCE flow and are
 * finished on /auth/callback/.
 */
export function createClient() {
  client ??= createSupabaseClient(SUPABASE_URL || "http://localhost:54321", SUPABASE_ANON_KEY || "missing", {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "9raya-auth",
    },
  });
  return client;
}

/** The signed-in user from the local session (null when signed out). RLS checks the token on every query. */
export async function getUser() {
  const { data } = await createClient().auth.getSession();
  return data.session?.user ?? null;
}
