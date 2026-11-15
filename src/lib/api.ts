import { createClient } from "@/lib/supabase/client";

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Calls the Supabase Edge Function `api` (grading, XP, completion, account deletion).
 * supabase-js sends the student's access token; the function verifies it.
 */
export async function callApi<T>(action: string, args: Record<string, unknown> = {}): Promise<Result<T>> {
  try {
    const { data, error } = await createClient().functions.invoke("api", { body: { action, ...args } });
    if (error) {
      const ctx = (error as { context?: Response }).context;
      try {
        const body = ctx && typeof ctx.json === "function" ? ((await ctx.json()) as { error?: string }) : null;
        if (body?.error) return { ok: false, error: body.error };
      } catch {}
      return { ok: false, error: "Connexion au serveur impossible. Réessaie." };
    }
    return data as Result<T>;
  } catch {
    return { ok: false, error: "Connexion au serveur impossible. Réessaie." };
  }
}
