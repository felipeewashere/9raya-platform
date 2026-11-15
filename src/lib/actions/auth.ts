import { z } from "zod";
import { hardNavigate, siteHref } from "@/lib/base-path";
import { createClient } from "@/lib/supabase/client";

/*
 * Auth with supabase-js in the browser (session in localStorage, PKCE). Links sent by e-mail
 * and the Google redirect come back to /auth/callback/, which finishes the session.
 * The form functions keep the (state, FormData) signature so they work with useActionState.
 */

export type FormState = { error?: string; message?: string; fields?: Record<string, string> } | undefined;

const emailSchema = z.string().trim().toLowerCase().email("Adresse e-mail invalide.");
const passwordSchema = z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères.").max(72, "Mot de passe trop long.");

export function safeNext(next: unknown) {
  const n = typeof next === "string" ? next : "";
  // only same-site relative paths
  return n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : "/tableau-de-bord";
}

/** Where auth links land: /auth/callback/?suivant=<page>. */
export function callbackUrl(next: string) {
  return `${siteHref("/auth/callback/")}?suivant=${encodeURIComponent(safeNext(next))}`;
}

function frenchAuthError(message: string) {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou mot de passe incorrect.";
  if (m.includes("email not confirmed")) return "Confirme d'abord ton adresse e-mail (vérifie ta boîte de réception).";
  if (m.includes("already registered") || m.includes("already been registered")) return "Un compte existe déjà avec cette adresse.";
  if (m.includes("rate limit")) return "Trop de tentatives. Réessaie dans quelques minutes.";
  if (m.includes("weak") || m.includes("password")) return "Mot de passe trop faible. Choisis-en un plus long.";
  return "Une erreur est survenue. Réessaie.";
}

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const email = emailSchema.safeParse(form.get("email"));
  const password = z.string().min(1, "Entre ton mot de passe.").safeParse(form.get("password"));
  if (!email.success) return { error: email.error.issues[0].message, fields: { email: String(form.get("email") ?? "") } };
  if (!password.success) return { error: password.error.issues[0].message, fields: { email: email.data } };
  const { error } = await createClient().auth.signInWithPassword({ email: email.data, password: password.data });
  if (error) return { error: frenchAuthError(error.message), fields: { email: email.data } };
  hardNavigate(safeNext(form.get("next")));
  return undefined;
}

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z
    .object({
      full_name: z.string().trim().min(2, "Indique ton prénom et ton nom.").max(80),
      email: emailSchema,
      password: passwordSchema,
    })
    .safeParse({ full_name: form.get("full_name"), email: form.get("email"), password: form.get("password") });
  const fields = { full_name: String(form.get("full_name") ?? ""), email: String(form.get("email") ?? "") };
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };
  const { data, error } = await createClient().auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.full_name }, emailRedirectTo: callbackUrl("/bienvenue") },
  });
  if (error) return { error: frenchAuthError(error.message), fields };
  // email confirmation enabled → no session yet
  if (!data.session) return { message: `Presque fini ! Nous avons envoyé un lien de confirmation à ${parsed.data.email}. Clique dessus pour activer ton compte.` };
  hardNavigate("/bienvenue");
  return undefined;
}

/** Redirects the browser to Google; it comes back to /auth/callback/. */
export async function signInWithGoogle(form: FormData) {
  const { error } = await createClient().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(safeNext(form.get("next"))) },
  });
  if (error) hardNavigate(`/connexion?erreur=${encodeURIComponent("Connexion Google indisponible.")}`);
}

export async function signOut() {
  await createClient().auth.signOut({ scope: "local" });
  hardNavigate("/");
}

export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  const email = emailSchema.safeParse(form.get("email"));
  if (!email.success) return { error: email.error.issues[0].message };
  const { error } = await createClient().auth.resetPasswordForEmail(email.data, { redirectTo: callbackUrl("/auth/nouveau-mot-de-passe") });
  if (error?.message.toLowerCase().includes("rate")) return { error: frenchAuthError(error.message) };
  if (error) console.error(error);
  // same message whether or not the account exists (no account enumeration)
  return { message: "Si un compte existe avec cette adresse, tu vas recevoir un lien pour choisir un nouveau mot de passe." };
}

export async function updatePassword(_: FormState, form: FormData): Promise<FormState> {
  const password = passwordSchema.safeParse(form.get("password"));
  if (!password.success) return { error: password.error.issues[0].message };
  if (form.get("password") !== form.get("confirm")) return { error: "Les deux mots de passe ne correspondent pas." };
  const { error } = await createClient().auth.updateUser({ password: password.data });
  if (error) return { error: error.message.toLowerCase().includes("session") ? "Le lien a expiré. Redemande un e-mail de réinitialisation." : frenchAuthError(error.message) };
  hardNavigate("/tableau-de-bord?mdp=ok");
  return undefined;
}
