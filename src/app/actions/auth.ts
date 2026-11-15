"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/supabase/env";

export type FormState = { error?: string; message?: string; fields?: Record<string, string> } | undefined;

const emailSchema = z.string().trim().toLowerCase().email("Adresse e-mail invalide.");
const passwordSchema = z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères.").max(72, "Mot de passe trop long.");

function safeNext(next: FormDataEntryValue | null) {
  const n = typeof next === "string" ? next : "";
  // only same-site relative paths
  return n.startsWith("/") && !n.startsWith("//") ? n : "/tableau-de-bord";
}

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : siteUrl();
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
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.data, password: password.data });
  if (error) return { error: frenchAuthError(error.message), fields: { email: email.data } };
  redirect(safeNext(form.get("next")));
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
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name },
      emailRedirectTo: `${await origin()}/auth/callback?suivant=/bienvenue`,
    },
  });
  if (error) return { error: frenchAuthError(error.message), fields };
  // email confirmation enabled → no session yet
  if (!data.session) return { message: `Presque fini ! Nous avons envoyé un lien de confirmation à ${parsed.data.email}. Clique dessus pour activer ton compte.` };
  redirect("/bienvenue");
}

export async function signInWithGoogle(form: FormData) {
  const supabase = await createClient();
  const next = safeNext(form.get("next"));
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await origin()}/auth/callback?suivant=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect(`/connexion?erreur=${encodeURIComponent("Connexion Google indisponible.")}`);
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  const email = emailSchema.safeParse(form.get("email"));
  if (!email.success) return { error: email.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${await origin()}/auth/callback?suivant=/auth/nouveau-mot-de-passe`,
  });
  if (error && !error.message.toLowerCase().includes("rate")) console.error(error);
  if (error?.message.toLowerCase().includes("rate")) return { error: frenchAuthError(error.message) };
  // same message whether or not the account exists (no account enumeration)
  return { message: "Si un compte existe avec cette adresse, tu vas recevoir un lien pour choisir un nouveau mot de passe." };
}

export async function updatePassword(_: FormState, form: FormData): Promise<FormState> {
  const password = passwordSchema.safeParse(form.get("password"));
  if (!password.success) return { error: password.error.issues[0].message };
  if (form.get("password") !== form.get("confirm")) return { error: "Les deux mots de passe ne correspondent pas." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return { error: error.message.toLowerCase().includes("session") ? "Le lien a expiré. Redemande un e-mail de réinitialisation." : frenchAuthError(error.message) };
  redirect("/tableau-de-bord?mdp=ok");
}
