import "server-only";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

/** A validation problem, located by its path in the submitted value (e.g. ["blocks", 3, "md"]). */
export type Issue = { path: (string | number)[]; message: string };

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string; issues?: Issue[] };

export type AdminDb = ReturnType<typeof createAdminClient>;

export class UserError extends Error {}

export function toIssues(e: z.ZodError): Issue[] {
  return e.issues.map((i) => ({ path: i.path.filter((p): p is string | number => typeof p !== "symbol"), message: i.message }));
}

/**
 * Runs the body of an admin server action with the service-role client.
 * Callers MUST have awaited `requireAdmin()` themselves before calling this.
 * Validation errors come back as `issues`; Next.js redirects/not-found are rethrown.
 */
export async function run<T>(body: (db: AdminDb) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const db = createAdminClient();
    return { ok: true, data: await body(db) };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof z.ZodError) {
      const issues = toIssues(e);
      return { ok: false, error: issues[0] ? `${issues[0].path.join(".") || "valeur"} : ${issues[0].message}` : "Données invalides.", issues };
    }
    if (e instanceof UserError) return { ok: false, error: e.message };
    console.error(e);
    const msg = e instanceof Error ? e.message : "Erreur inattendue.";
    return { ok: false, error: friendly(msg) };
  }
}

function friendly(msg: string) {
  if (/duplicate key|unique/i.test(msg)) return "Ce slug est déjà utilisé à cet endroit. Choisis-en un autre.";
  if (/violates foreign key/i.test(msg)) return "Impossible : d'autres éléments dépendent de celui-ci (supprime-les ou déplace-les d'abord).";
  if (/check constraint/i.test(msg)) return "Une valeur ne respecte pas les contraintes (slug en minuscules, durée…).";
  return msg;
}

export function must<T>(res: { data: T | null; error: { message: string } | null }, what = "requête"): T {
  if (res.error) throw new Error(`${what} : ${res.error.message}`);
  if (res.data === null) throw new UserError(`${what} : introuvable.`);
  return res.data;
}

export function ok(res: { error: { message: string } | null }, what = "requête") {
  if (res.error) throw new Error(`${what} : ${res.error.message}`);
}

/** Admin pages and the student site both show content: refresh both after a change. */
export function refreshContent() {
  revalidatePath("/admin", "layout");
  revalidatePath("/cours", "layout");
  revalidatePath("/tableau-de-bord");
}

// ------------------------------------------------------------------ shared zod shapes
export const id = z.guid("Identifiant invalide.");
export const slug = z
  .string()
  .trim()
  .min(1, "Slug requis.")
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug : minuscules, chiffres et tirets (ex. espaces-vectoriels).");
export const optText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));
export const optUrl = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^(https?:\/\/|\/)/.test(v), "URL invalide (http(s)://… ou /chemin).");
export const ids = z.array(id).min(1).max(500);

/** A safe object name for storage: ascii, no slashes, keeps the extension. */
export function safeFileName(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(-100);
  return base || "fichier";
}
