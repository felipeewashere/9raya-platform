import { redirect } from "next/navigation";
import { NewPasswordForm } from "@/components/auth/forms";
import { getUser } from "@/lib/supabase/server";

export const metadata = { title: "Nouveau mot de passe" };

export default async function NewPasswordPage() {
  // the reset link signs the user in through /auth/callback first
  if (!(await getUser())) redirect("/mot-de-passe-oublie");
  return <NewPasswordForm />;
}
