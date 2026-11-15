/**
 * Give the admin role to an existing account (sign up on the site first).
 *   npm run admin:grant -- you@example.com
 */
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2]?.trim().toLowerCase();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!email) {
  console.error("Usage : npm run admin:grant -- ton@email.com");
  process.exit(1);
}
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants dans .env.local.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

let page = 1;
let userId: string | undefined;
while (!userId) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw error;
  userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id;
  if (data.users.length < 200) break;
  page++;
}
if (!userId) {
  console.error(`Aucun compte avec l'e-mail ${email}. Inscris-toi d'abord sur le site.`);
  process.exit(1);
}
const { error } = await db.from("profiles").update({ role: "admin" }).eq("id", userId);
if (error) throw error;
console.log(`✓ ${email} est maintenant administrateur.`);
